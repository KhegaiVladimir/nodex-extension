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

const METRICS_SEND_INTERVAL = 3
const WATCHDOG_INTERVAL_MS = 3000
const LANDMARK_TIMEOUT_MS  = 5000
const MAX_RESTART_ATTEMPTS = 3
const RESTART_COOLDOWN_MS  = 2000
const FRAME_BUDGET_MS      = 38
const INLINE_CALIBRATION_MS = 3000

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

    this._playerGestureMap = null
    this._browseGestureMap = null

    this._onMessage       = this._handleMessage.bind(this)
    this._onWindowMessage = this._handleWindowMessage.bind(this)

    this._lastLandmarkTime    = 0
    this._watchdogTimer       = null
    this._restartAttempts     = 0
    this._contextValid        = true
    this._lastFrameProcessedAt = 0
    this._lastPath            = location.pathname
    this._navPollTimer        = null
    this._autoModeTimer       = null
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
      onCalibrationRequest: () => this._startInlineCalibration(),
    })

    window.addEventListener('message', this._onWindowMessage)
    chrome.runtime.onMessage.addListener(this._onMessage)

    this._observeNavigation()

    if (settings.engine_active) {
      await this.start()
    }

    this._sendStatus()
  }

  async start() {
    if (this._running || this._destroyed) return
    this._running = true

    window.postMessage({
      type: 'NODEX_START_CAMERA',
      extensionBaseUrl: chrome.runtime.getURL(''),
    }, '*')

    this._hud.show()
    this._startWatchdog()
    if (!this._manualModeOverride) this._autoSetMode()
    await saveSettings({ engine_active: true }).catch(() => {})
    this._sendStatus()
  }

  async stop() {
    if (!this._running) return
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

    this._gestureEngine?.destroy()
    this._hud?.unmount()

    this._gestureEngine = null
    this._hud           = null
  }

  // --- Single entry point for mode changes ---

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
      this._lastLandmarkTime = Date.now()

      const now = performance.now()
      if (now - this._lastFrameProcessedAt < FRAME_BUDGET_MS) return
      this._lastFrameProcessedAt = now

      this._gestureEngine?.processFrame(e.data.data)
    }

    if (e.data?.type === 'NODEX_BRIDGE_ERROR') {
      console.error('[Nodex] Bridge error:', e.data.error)
      this._hud?.showWarning('Ошибка камеры: ' + (e.data.error ?? 'неизвестно'))
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
    if (document.visibilityState === 'hidden') return
    if (cmd === COMMANDS.NONE) return

    const controller = this._browseMode ? this._browseController : this._ytController
    const applied = controller.execute(cmd)

    if (applied) {
      this._hud?.showCommand(cmd, this._browseMode)
    }

    this._sendToSidePanel({
      type: MSG.COMMAND_EXECUTED,
      command: cmd,
      gesture,
      applied,
      metrics,
      browseMode: this._browseMode,
    })
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

      case MSG.SAVE_CALIBRATION:
        if (message.baseline) {
          saveCalibration(message.baseline)
            .then(() => this._gestureEngine?.updateSettings({ baseline: message.baseline }))
            .catch(console.error)
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

    this._hud?.showWarning('Калибровка... Смотрите прямо (3 сек)')
    this._gestureEngine?.updateSettings({ blocked: true })

    const frames = []
    const started = Date.now()

    const originalOnMetrics = this._gestureEngine._onMetrics
    this._gestureEngine._onMetrics = (metrics) => {
      frames.push(metrics)
      originalOnMetrics?.(metrics)

      if (Date.now() - started >= INLINE_CALIBRATION_MS && frames.length > 0) {
        this._gestureEngine._onMetrics = originalOnMetrics
        this._finishInlineCalibration(frames)
      }
    }

    setTimeout(() => {
      if (!this._calibrating) return
      this._gestureEngine._onMetrics = originalOnMetrics
      if (frames.length > 0) {
        this._finishInlineCalibration(frames)
      } else {
        this._calibrating = false
        this._gestureEngine?.updateSettings({ blocked: false })
        this._hud?.showWarning('Калибровка не удалась')
      }
    }, INLINE_CALIBRATION_MS + 2000)
  }

  async _finishInlineCalibration(frames) {
    if (!this._calibrating) return
    const baseline = {
      yaw:   frames.reduce((s, f) => s + (f.yaw ?? 0), 0) / frames.length,
      pitch: frames.reduce((s, f) => s + (f.pitch ?? 0), 0) / frames.length,
      roll:  frames.reduce((s, f) => s + (f.roll ?? 0), 0) / frames.length,
      ear:   frames.reduce((s, f) => s + (f.ear ?? 0), 0) / frames.length,
    }

    await saveCalibration(baseline).catch(console.error)
    this._gestureEngine?.updateSettings({ baseline, blocked: false })
    this._calibrating = false
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
      this._lastPath = currentPath
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
      this._hud?.showWarning('Камера потеряна. Перезагрузите страницу.')
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
    this._hud?.showWarning('Переподключение камеры...')
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
    this._hud?.showWarning('Расширение обновлено. Перезагрузите страницу.')
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
