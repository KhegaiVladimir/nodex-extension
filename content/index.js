import { MSG } from '../shared/constants/messages.js'
import { COMMANDS } from '../shared/constants/commands.js'
import {
  PLAYER_GESTURE_MAP,
  BROWSE_GESTURE_MAP,
  DEFAULT_COOLDOWNS,
  DEFAULT_THRESHOLDS,
} from '../shared/constants/defaults.js'
import {
  loadCalibration,
  loadSettings,
  loadPlayerGestureMap,
  loadBrowseGestureMap,
  savePlayerGestureMap,
  saveBrowseGestureMap,
  saveCalibration,
  saveSettings,
} from '../shared/storage.js'

import { HUD } from './HUD.js'
import { GestureEngine } from './GestureEngine.js'
import { YouTubeController } from './YouTubeController.js'
import { BrowseController } from './BrowseController.js'

// Guard against re-injection (e.g. after extension update or SPA navigation).
// Must come AFTER imports — ES module imports are hoisted and cannot be inside blocks.
if (window.__nodexLoaded) {
  // Already loaded — skip silently.
  // Do NOT throw: throwing breaks subsequent injections and leaves the page broken.
} else {
window.__nodexLoaded = true

/** @param {unknown} data */
function isValidLandmarkBatch(data) {
  if (!Array.isArray(data) || data.length !== 468) return false
  for (let i = 0; i < data.length; i++) {
    const p = data[i]
    if (!p || typeof p.x !== 'number' || typeof p.y !== 'number' || typeof p.z !== 'number') {
      return false
    }
  }
  return true
}

const METRICS_SEND_INTERVAL = 5
const WATCHDOG_INTERVAL_MS = 3000
const LANDMARK_TIMEOUT_MS  = 5000
const MAX_RESTART_ATTEMPTS = 3
const RESTART_COOLDOWN_MS  = 2000
const FRAME_BUDGET_MS      = 20
const INLINE_CALIBRATION_MS = 3000
const URL_HISTORY_LIMIT     = 50
const YT_ORIGIN             = 'https://www.youtube.com'

class NodexContentScript {
  constructor() {
    this._hud              = null
    this._gestureEngine    = null
    this._ytController     = new YouTubeController()
    this._browseController = new BrowseController()
    this._browseMode       = false
    this._manualModeOverride = false
    this._running          = false
    this._frameCount       = 0
    this._destroyed        = false
    this._calibrating      = false
    this._tutorialMode     = false
    this._tutorialModeDeadline = 0

    this._playerGestureMap = null
    this._browseGestureMap = null

    this._onMessage          = this._handleMessage.bind(this)
    this._onWindowMessage    = this._handleWindowMessage.bind(this)
    this._onVisibilityChange = this._handleVisibilityChange.bind(this)

    this._lastLandmarkTime    = 0
    this._watchdogTimer       = null
    this._restartAttempts     = 0
    this._contextValid        = true
    this._lastFrameProcessedAt = 0
    this._lastPath            = location.pathname
    this._lastHref            = location.href
    this._navPollTimer        = null
    this._autoModeTimer       = null
    this._urlHistory          = []
  }

  async init() {
    const [calibration, settings, playerMap, browseMap] = await Promise.all([
      loadCalibration(),
      loadSettings({
        thresholds:    DEFAULT_THRESHOLDS,
        cooldowns:     DEFAULT_COOLDOWNS,
        engine_active: false,
      }),
      loadPlayerGestureMap(PLAYER_GESTURE_MAP),
      loadBrowseGestureMap(BROWSE_GESTURE_MAP),
    ])

    this._playerGestureMap = playerMap
    this._browseGestureMap = browseMap

    this._hud = new HUD()
    this._hud.mount()

    this._gestureEngine = new GestureEngine({
      thresholds: settings.thresholds ?? DEFAULT_THRESHOLDS,
      cooldowns:  settings.cooldowns  ?? DEFAULT_COOLDOWNS,
      gestureMap: this._browseMode ? this._browseGestureMap : this._playerGestureMap,
      baseline:   calibration,
      onCommand:  (cmd, gesture, metrics) => this._handleCommand(cmd, gesture, metrics),
      onMetrics:  (metrics) => this._handleMetrics(metrics),
    })
    this._ensureGesturePipelineReady()

    window.addEventListener('message', this._onWindowMessage)
    chrome.runtime.onMessage.addListener(this._onMessage)
    document.addEventListener('visibilitychange', this._onVisibilityChange)

    this._observeNavigation()

    if (settings.engine_active) {
      await this.start()
    }

    this._ensureGesturePipelineReady()
    this._sendStatus()
  }

  /**
   * Production: `blocked` is not persisted — always confirm the pipeline is open after
   * init/restart so gestures work from the first frame (no stuck calibration lock).
   */
  _ensureGesturePipelineReady() {
    this._gestureEngine?.updateSettings({ blocked: false })
  }

  async start() {
    if (this._destroyed) return
    // If engine is already running, still broadcast status so any newly-opened
    // side panel can sync its UI state. Without this, Step 2 of onboarding
    // hangs on "waiting" for 10 seconds and times out.
    if (this._running) {
      this._ensureGesturePipelineReady()
      this._sendStatus()
      if (this._browseMode) this._browseController.refreshIfActive()
      return
    }
    this._running = true

    window.postMessage({
      type: 'NODEX_START_CAMERA',
      extensionBaseUrl: chrome.runtime.getURL(''),
    }, '*')

    this._hud.show()
    this._startWatchdog()
    if (!this._manualModeOverride) this._autoSetMode()
    this._ensureGesturePipelineReady()
    await saveSettings({ engine_active: true }).catch(() => {})
    this._sendStatus()
  }

  async stop() {
    if (this._destroyed) return
    if (!this._running) {
      this._sendStatus()
      return
    }
    this._stopWatchdog()
    this._running = false

    this._setMode(false)

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')

    this._hud?.hide()
    await saveSettings({ engine_active: false }).catch(() => {})
    this._sendStatus()
  }

  async destroy() {
    if (this._destroyed) return
    this._stopWatchdog()
    this._destroyed = true

    this._setMode(false)
    clearInterval(this._navPollTimer)
    clearTimeout(this._autoModeTimer)

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')
    window.removeEventListener('message', this._onWindowMessage)
    chrome.runtime.onMessage.removeListener(this._onMessage)
    document.removeEventListener('visibilitychange', this._onVisibilityChange)

    this._gestureEngine?.destroy()
    this._hud?.unmount()

    this._gestureEngine = null
    this._hud           = null
  }

  // --- Single entry point for mode changes ---

  _handleVisibilityChange() {
    if (this._destroyed || document.visibilityState !== 'visible') return
    if (this._browseMode) this._browseController.refreshIfActive()
  }

  _setMode(browse) {
    if (browse === this._browseMode) return
    this._browseMode = browse

    const map = browse ? this._browseGestureMap : this._playerGestureMap
    this._gestureEngine?.updateSettings({ gestureMap: map })

    if (browse) {
      const count = this._browseController.activate()
      if (count === 0) this._hud?.showCommand('NO_VIDEOS')
    } else {
      this._browseController.deactivate()
    }

    this._hud?.setModeIndicator(browse)
    this._sendToSidePanel({
      type: MSG.BROWSE_MODE_CHANGED,
      browseMode: browse,
    })
  }

  _handleWindowMessage(e) {
    if (e.source !== window) return

    if (e.data?.type === 'NODEX_LANDMARKS') {
      if (!this._running || this._destroyed) return
      if (!isValidLandmarkBatch(e.data.data)) return
      this._lastLandmarkTime = Date.now()

      const now = performance.now()
      if (now - this._lastFrameProcessedAt < FRAME_BUDGET_MS) return
      this._lastFrameProcessedAt = now

      this._gestureEngine?.processFrame(e.data.data)
    }

    if (e.data?.type === 'NODEX_CAMERA_DENIED') {
      this._running = false
      this._stopWatchdog()
      console.warn('[Nodex] Camera access denied')
      this._hud?.showWarning(
        'Camera access denied. Click the camera icon in the address bar to enable.',
      )
      void saveSettings({ engine_active: false }).catch(() => {})
      this._sendStatus()
      return
    }

    if (e.data?.type === 'NODEX_BRIDGE_ERROR') {
      console.error('[Nodex] Bridge error:', e.data.error)
      this._running = false
      this._stopWatchdog()
      this._hud?.showWarning(e.data.error ?? 'Unknown error')
      void saveSettings({ engine_active: false }).catch(() => {})
      this._sendStatus()
    }

    if (e.data?.type === 'NODEX_INJECT_MEDIAPIPE') {
      try {
        chrome.runtime.sendMessage({ type: 'INJECT_MEDIAPIPE' }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type:  'NODEX_INJECT_MEDIAPIPE_RESULT',
              ok:    false,
              error: chrome.runtime.lastError.message,
            }, '*')
            return
          }
          window.postMessage({
            type:  'NODEX_INJECT_MEDIAPIPE_RESULT',
            ok:    response?.ok ?? false,
            error: response?.error ?? null,
          }, '*')
        })
      } catch (err) {
        window.postMessage({
          type: 'NODEX_INJECT_MEDIAPIPE_RESULT',
          ok: false,
          error: err.message,
        }, '*')
      }
    }

    if (e.data?.type === 'NODEX_INJECT_SCRIPT') {
      const { path, requestId } = e.data
      try {
        chrome.runtime.sendMessage({ type: 'INJECT_SCRIPT', path, requestId }, (response) => {
          if (chrome.runtime.lastError) {
            window.postMessage({
              type: 'NODEX_INJECT_SCRIPT_RESULT',
              ok: false,
              requestId,
              error: chrome.runtime.lastError.message,
            }, '*')
            return
          }
          window.postMessage({
            type: 'NODEX_INJECT_SCRIPT_RESULT',
            ok: response?.ok ?? false,
            requestId,
            error: response?.error ?? null,
          }, '*')
        })
      } catch (err) {
        window.postMessage({
          type: 'NODEX_INJECT_SCRIPT_RESULT',
          ok: false,
          requestId,
          error: err.message,
        }, '*')
      }
    }
  }

  _handleCommand(cmd, gesture, metrics) {
    if (this._tutorialMode && Date.now() > this._tutorialModeDeadline) {
      this._tutorialMode = false
    }
    if (document.visibilityState === 'hidden') return
    if (cmd === COMMANDS.NONE) return

    // Tutorial mode: notify side panel so checkmarks work, but NEVER execute command.
    // This prevents real YouTube video from reacting while user is practicing gestures.
    if (this._tutorialMode) {
      this._sendToSidePanel({
        type: MSG.COMMAND_EXECUTED,
        command: cmd,
        gesture,
        applied: false,
        metrics,
        browseMode: this._browseMode,
        tutorial: true,
      })
      return
    }

    let applied = false

    if (cmd === COMMANDS.BACK || cmd === COMMANDS.PREV) {
      this._safeGoBack()
      applied = true
    } else {
      const controller = this._browseMode ? this._browseController : this._ytController
      const result = controller.execute(cmd)
      if (result === 'edge') {
        this._hud?.showCommand(cmd, this._browseMode)
        applied = false
      } else {
        applied = !!result
      }
    }

    if (applied) {
      this._hud?.showCommand(cmd, this._browseMode)
    }

    this._sendToSidePanel({
      type: MSG.COMMAND_EXECUTED,
      command: cmd,
      gesture,
      applied: applied || false,
      metrics,
      browseMode: this._browseMode,
    })
  }

  _safeGoBack() {
    if (this._urlHistory.length > 0) {
      const prev = this._urlHistory.pop()
      window.location.href = prev
    } else {
      window.location.href = YT_ORIGIN + '/'
    }
  }

  _handleMetrics(metrics) {
    this._frameCount++
    this._hud?.updateMetrics(metrics)

    if (this._frameCount % METRICS_SEND_INTERVAL === 0) {
      this._sendToSidePanel({
        type: MSG.METRICS_UPDATE,
        metrics,
      })
    }
  }

  _handleMessage(message, _sender, sendResponse) {
    switch (message.type) {
      case MSG.START_ENGINE:
        this.start()
        break

      case MSG.STOP_ENGINE:
        this.stop()
        break

      case MSG.CALIBRATION_START:
        this._gestureEngine?.updateSettings({ blocked: true })
        break

      case MSG.CALIBRATION_CANCEL:
        this._gestureEngine?.updateSettings({ blocked: false })
        break

      case MSG.TUTORIAL_START:
        this._tutorialMode = true
        this._tutorialModeDeadline = Date.now() + 5 * 60 * 1000  // max 5 minutes
        break

      case MSG.TUTORIAL_END:
        this._tutorialMode = false
        if (this._browseMode) this._browseController.refreshIfActive()
        break

      case MSG.SAVE_CALIBRATION:
        if (message.baseline) {
          saveCalibration(message.baseline)
            .then(() => {
              this._gestureEngine?.updateSettings({ baseline: message.baseline, blocked: false })
              if (this._browseMode) this._browseController.refreshIfActive()
            })
            .catch((err) => {
              console.error(err)
              this._gestureEngine?.updateSettings({ blocked: false })
            })
        } else {
          this._gestureEngine?.updateSettings({ blocked: false })
        }
        break

      case MSG.UPDATE_SETTINGS: {
        const patch = message.settings ?? {}
        saveSettings(patch).catch(console.error)
        if (patch.playerGestureMap) {
          this._playerGestureMap = patch.playerGestureMap
          savePlayerGestureMap(patch.playerGestureMap).catch(console.error)
        }
        if (patch.browseGestureMap) {
          this._browseGestureMap = patch.browseGestureMap
          saveBrowseGestureMap(patch.browseGestureMap).catch(console.error)
        }
        const activeMap = this._browseMode ? this._browseGestureMap : this._playerGestureMap
        this._gestureEngine?.updateSettings({
          ...patch,
          gestureMap: activeMap,
        })
        break
      }

      case MSG.REQUEST_STATUS:
        this._sendStatus()
        break

      case MSG.TOGGLE_BROWSE_MODE:
        this._manualModeOverride = true
        this._setMode(!this._browseMode)
        this._hud?.showCommand(this._browseMode ? 'BROWSE_ON' : 'BROWSE_OFF')
        break

      default:
        break
    }

    sendResponse?.({ ok: true })
  }

  // --- Inline calibration via long blink ---

  _startInlineCalibration() {
    if (this._calibrating) return
    this._calibrating = true

    this._hud?.showWarning('Calibrating… Look straight ahead (3 sec)')
    this._gestureEngine?.updateSettings({ blocked: true })

    const frames = []
    const started = Date.now()
    let finishScheduled = false

    const originalOnMetrics = this._gestureEngine._onMetrics
    this._gestureEngine._onMetrics = (metrics) => {
      frames.push(metrics)
      originalOnMetrics?.(metrics)

      if (
        !finishScheduled &&
        Date.now() - started >= INLINE_CALIBRATION_MS &&
        frames.length > 0
      ) {
        finishScheduled = true
        this._gestureEngine._onMetrics = originalOnMetrics
        this._finishInlineCalibration(frames)
      }
    }

    setTimeout(() => {
      if (!this._calibrating || finishScheduled) return
      this._gestureEngine._onMetrics = originalOnMetrics
      if (frames.length > 0) {
        finishScheduled = true
        this._finishInlineCalibration(frames)
      } else {
        this._calibrating = false
        this._gestureEngine?.updateSettings({ blocked: false })
        this._hud?.showWarning('Calibration failed')
      }
    }, INLINE_CALIBRATION_MS + 2000)
  }

  async _finishInlineCalibration(frames) {
    if (!this._calibrating) return
    if (!frames?.length) {
      this._calibrating = false
      this._gestureEngine?.updateSettings({ blocked: false })
      return
    }
    this._calibrating = false

    const baseline = {
      yaw:   frames.reduce((s, f) => s + (f.yaw ?? 0), 0) / frames.length,
      pitch: frames.reduce((s, f) => s + (f.pitch ?? 0), 0) / frames.length,
      roll:  frames.reduce((s, f) => s + (f.roll ?? 0), 0) / frames.length,
      ear:   frames.reduce((s, f) => s + (f.ear ?? 0), 0) / frames.length,
    }

    try {
      await saveCalibration(baseline)
    } catch (e) {
      console.error('[Nodex]', e)
    } finally {
      this._gestureEngine?.updateSettings({ baseline, blocked: false })
    }

    this._hud?.showCommand('CALIBRATED')

    this._sendToSidePanel({
      type: MSG.SAVE_CALIBRATION,
      baseline,
    })
  }

  // --- Navigation observation ---

  _observeNavigation() {
    const onNavigate = () => {
      const currentPath = location.pathname
      if (this._lastPath === currentPath) return

      this._urlHistory.push(this._lastHref)
      if (this._urlHistory.length > URL_HISTORY_LIMIT) {
        this._urlHistory.splice(0, this._urlHistory.length - URL_HISTORY_LIMIT)
      }
      this._lastPath = currentPath
      this._lastHref = location.href

      if (!this._running) return

      this._manualModeOverride = false

      clearTimeout(this._autoModeTimer)
      this._autoModeTimer = setTimeout(() => this._autoSetMode(), 800)
    }

    try {
      if (typeof navigation !== 'undefined') {
        navigation.addEventListener('navigatesuccess', onNavigate)
      }
    } catch (_e) { /* navigation API unavailable */ }

    this._navPollTimer = setInterval(onNavigate, 1000)
  }

  _autoSetMode() {
    if (this._manualModeOverride) return

    const path = location.pathname
    const isPlayerPage = /^\/(watch|shorts\/|live\/|clip\/|embed\/)/.test(path)
    this._setMode(!isPlayerPage)
  }

  _startWatchdog() {
    clearInterval(this._watchdogTimer)
    this._lastLandmarkTime = Date.now()
    this._restartAttempts = 0
    this._watchdogTimer = setInterval(() => this._watchdogCheck(), WATCHDOG_INTERVAL_MS)
  }

  _stopWatchdog() {
    clearInterval(this._watchdogTimer)
    this._watchdogTimer = null
  }

  _watchdogCheck() {
    if (!this._running || this._destroyed) return

    try { chrome.runtime.getURL('') } catch (_e) {
      this._handleContextInvalidated()
      return
    }

    const elapsed = Date.now() - this._lastLandmarkTime
    if (elapsed < LANDMARK_TIMEOUT_MS) {
      this._restartAttempts = 0
      return
    }

    this._restartAttempts++

    if (this._restartAttempts > MAX_RESTART_ATTEMPTS) {
      this._hud?.showWarning('Camera lost. Reload the page.')
      this.stop()
      this._sendToSidePanel({
        type: MSG.ENGINE_STATUS,
        running: false,
        error: 'bridge_dead',
      })
      return
    }

    console.warn(
      `[Nodex] Watchdog: no landmarks for ${elapsed}ms, restarting bridge ` +
      `(attempt ${this._restartAttempts}/${MAX_RESTART_ATTEMPTS})`,
    )
    this._hud?.showWarning('Reconnecting camera…')
    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')
    this._lastLandmarkTime = Date.now()
    setTimeout(() => {
      if (!this._running || this._destroyed) return
      window.postMessage({
        type: 'NODEX_START_CAMERA',
        extensionBaseUrl: chrome.runtime.getURL(''),
      }, '*')
    }, RESTART_COOLDOWN_MS)
  }

  _handleContextInvalidated() {
    this._contextValid = false
    this._hud?.showWarning('Extension updated. Reload the page.')
    this._stopWatchdog()
  }

  _sendToSidePanel(payload) {
    if (!this._contextValid) return
    try {
      chrome.runtime.sendMessage({
        type: MSG.CONTENT_TO_SIDEPANEL,
        payload,
      }).catch(() => {})
    } catch (_e) {
      // Extension context invalidated — ignore
    }
  }

  _sendStatus() {
    this._sendToSidePanel({
      type:    MSG.ENGINE_STATUS,
      running: this._running,
    })
  }
}

const nodex = new NodexContentScript()
nodex.init().catch((err) => console.error('[Nodex] init failed:', err))

window.addEventListener('beforeunload', () => {
  nodex.destroy()
})
} // end of __nodexLoaded guard
