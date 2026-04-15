import { BRIDGE_WINDOW, MSG } from '../shared/constants/messages.js'
import { COMMANDS } from '../shared/constants/commands.js'
import {
  PLAYER_GESTURE_MAP,
  BROWSE_GESTURE_MAP,
  DEFAULT_COOLDOWNS,
  DEFAULT_THRESHOLDS,
} from '../shared/constants/defaults.js'
import { REFINE_LANDMARKS } from '../shared/constants/mediapipe.js'
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

// Guard: bundle loads once per tab (double injection would duplicate module scope).
// SPA navigation recreates page-scoped UI via yt-navigate-finish + createPageScoped(); persistent camera/GestureEngine stay loaded.
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

/** @param {number[]} nums */
function medianOf(nums) {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

const METRICS_SEND_INTERVAL = 5
const WATCHDOG_INTERVAL_MS = 3000
const LANDMARK_TIMEOUT_MS  = 5000
const MAX_RESTART_ATTEMPTS = 3
const RESTART_COOLDOWN_MS  = 2000
const FRAME_BUDGET_MS      = 20
const INLINE_CALIBRATION_MS = 2000
const URL_HISTORY_LIMIT     = 50
const YT_ORIGIN             = 'https://www.youtube.com'

/** @type {NodexPersistent | null} */
let nodexPersistentSingleton = null

/**
 * Per-route UI and DOM observers. Recreated on `yt-navigate-finish`.
 * GestureEngine lives on {@link NodexPersistent} — routing uses `handleCommand` / `handleMetrics` (single subscriber, no duplicate listeners).
 */
class NodexPageScoped {
  /**
   * @param {NodexPersistent} persistent
   */
  constructor(persistent) {
    this._persistent = persistent
    this._destroyed = false
    this._ac = new AbortController()

    this._hud = null
    this._ytController = new YouTubeController()
    this._browseController = new BrowseController()
    this._browseMode = false
    this._manualModeOverride = false
    this._frameCount = 0

    this._lastPath = location.pathname
    this._lastHref = location.href
    this._urlHistory = []
    this._navPollTimer = null
    this._autoModeTimer = null

    this._onVisibilityChange = this._handleVisibilityChange.bind(this)
  }

  async init() {
    this._hud = new HUD()
    this._hud.mount()
    window.__nodexBrowseController = this._browseController

    document.addEventListener('visibilitychange', this._onVisibilityChange, { signal: this._ac.signal })

    this._observeNavigation()
    if (!this._manualModeOverride) this._autoSetMode()

    if (this._persistent._pendingAutoStart) {
      this._persistent._pendingAutoStart = false
      await this._persistent.start()
    }

    this._persistent._ensureGesturePipelineReady()
    this._persistent._sendStatus()
  }

  destroy() {
    if (this._destroyed) return
    this._destroyed = true

    if (this._persistent._page === this) {
      this._persistent.detachPage(this)
    }

    this._setMode(false)
    clearInterval(this._navPollTimer)
    this._navPollTimer = null
    clearTimeout(this._autoModeTimer)
    this._autoModeTimer = null

    if (window.__nodexBrowseController === this._browseController) {
      window.__nodexBrowseController = null
    }
    this._browseController?.destroy()
    this._hud?.unmount()
    this._hud = null
    this._ac.abort()
  }

  handleCommand(cmd, gesture, metrics) {
    const P = this._persistent
    if (P._tutorialMode && Date.now() > P._tutorialModeDeadline) {
      P._tutorialMode = false
    }
    if (document.visibilityState === 'hidden') return
    if (cmd === COMMANDS.NONE) return

    if (P._tutorialMode) {
      P._sendToSidePanel({
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
    } else if (cmd === COMMANDS.TOGGLE_MODE) {
      // Switch Player ↔ Browse mode via gesture.
      // _manualModeOverride prevents _autoSetMode from overriding this on next nav.
      this._manualModeOverride = true
      this._setMode(!this._browseMode)
      // Show HUD banner with the newly-active mode name (after _setMode flipped _browseMode).
      this._hud?.showCommand(this._browseMode ? 'BROWSE_ON' : 'BROWSE_OFF')
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

    P._sendToSidePanel({
      type: MSG.COMMAND_EXECUTED,
      command: cmd,
      gesture,
      applied: applied || false,
      metrics,
      browseMode: this._browseMode,
    })
  }

  handleMetrics(metrics) {
    this._frameCount++
    this._hud?.updateMetrics(metrics)

    if (this._frameCount % METRICS_SEND_INTERVAL === 0) {
      this._persistent._sendToSidePanel({
        type: MSG.METRICS_UPDATE,
        metrics,
      })
    }
  }

  _setMode(browse) {
    if (browse === this._browseMode) return
    this._browseMode = browse

    const map = browse ? this._persistent._browseGestureMap : this._persistent._playerGestureMap
    this._persistent._gestureEngine?.updateSettings({ gestureMap: map })

    if (browse) {
      const count = this._browseController.activate()
      if (count === 0) this._hud?.showCommand('NO_VIDEOS')

      // First-time Browse Mode onboarding hint — shown exactly once, persisted in storage.
      // Use an async IIFE so _setMode stays synchronous; the hint fires on the next microtask.
      // Guard: skip the hint (but still set the flag) when NO_VIDEOS is already showing —
      // the warning is more important than onboarding text.
      const hasVideos = count > 0
      ;(async () => {
        try {
          const stored = await chrome.storage.local.get('nodex_browse_hint_shown')
          if (!stored.nodex_browse_hint_shown) {
            if (hasVideos) this._hud?.showBrowseHint()
            chrome.storage.local.set({ nodex_browse_hint_shown: true })
          }
        } catch (e) {
          // Storage error is non-fatal — hint simply doesn't appear.
          console.error('[Nodex] browse hint storage check failed', e)
        }
      })()
    } else {
      this._browseController.deactivate()
    }

    this._hud?.setModeIndicator(browse)
    this._persistent._sendToSidePanel({
      type: MSG.BROWSE_MODE_CHANGED,
      browseMode: browse,
    })
  }

  _handleVisibilityChange() {
    if (this._destroyed || document.visibilityState !== 'visible') return
    if (this._browseMode) this._browseController.refreshIfActive()
  }

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

      if (!this._persistent._running) return

      this._manualModeOverride = false

      clearTimeout(this._autoModeTimer)
      this._autoModeTimer = setTimeout(() => this._autoSetMode(), 800)
    }

    try {
      if (typeof navigation !== 'undefined') {
        navigation.addEventListener('navigatesuccess', onNavigate, { signal: this._ac.signal })
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

  _safeGoBack() {
    if (this._urlHistory.length > 0) {
      const prev = this._urlHistory.pop()
      window.location.href = prev
    } else {
      window.location.href = YT_ORIGIN + '/'
    }
  }
}

/**
 * Camera bridge, GestureEngine, watchdog — one instance per tab until unload.
 */
class NodexPersistent {
  constructor() {
    this._ac = new AbortController()

    this._page = /** @type {NodexPageScoped | null} */ (null)
    this._gestureEngine = null
    this._running = false
    this._destroyed = false
    this._calibrating = false
    /** @type {ReturnType<typeof setTimeout> | null} */
    this._inlineCalibrationTimer = null
    this._tutorialMode = false
    this._tutorialModeDeadline = 0
    /** Set in init(); consumed when first {@link NodexPageScoped} mounts. */
    this._pendingAutoStart = false

    this._playerGestureMap = null
    this._browseGestureMap = null

    this._onMessage = this._handleMessage.bind(this)
    this._onWindowMessage = this._handleWindowMessage.bind(this)
    this._onBridgeRecoveryMessage = this._handleBridgeRecoveryMessage.bind(this)

    this._bridgeRecovering = false

    this._lastLandmarkTime = 0
    this._watchdogTimer = null
    this._restartAttempts = 0
    this._contextValid = true
    this._lastFrameProcessedAt = 0

    // ── Auto-pause on no face ────────────────────────────────────────────────
    /** Whether the feature is enabled (persisted in chrome.storage.local). */
    this._autoPauseEnabled = false
    /** Timestamp when face first left the frame; null = face is in frame. */
    this._noFaceStartedAt = null
    /** True if WE auto-paused — so we only auto-resume if we were the ones who paused. */
    this._autoPausedByUs = false
    /** Seconds without a face before auto-pausing. */
    this._noFaceTimeoutMs = 2000
  }

  attachPage(page) {
    if (this._page && this._page !== page) {
      void this._page.destroy()
    }
    this._page = page
  }

  detachPage(page) {
    if (this._page === page) this._page = null
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

    if (this._destroyed) return

    this._playerGestureMap = playerMap
    this._browseGestureMap = browseMap
    this._pendingAutoStart = Boolean(settings.engine_active)
    this._autoPauseEnabled = Boolean(settings.auto_pause_on_no_face)

    if (window.__nodexGestureEngine) {
      window.__nodexGestureEngine.destroy()
    }
    this._gestureEngine = new GestureEngine({
      thresholds: { ...DEFAULT_THRESHOLDS, ...settings.thresholds },
      cooldowns:  settings.cooldowns  ?? DEFAULT_COOLDOWNS,
      gestureMap: this._playerGestureMap,
      baseline:   calibration,
      onCommand:  (cmd, gesture, metrics) => {
        this._page?.handleCommand(cmd, gesture, metrics)
      },
      onMetrics:  (metrics) => {
        this._page?.handleMetrics(metrics)
      },
      onPanelNotify: (payload) => {
        this._sendToSidePanel(payload)
      },
    })
    window.__nodexGestureEngine = this._gestureEngine
    this._ensureGesturePipelineReady()

    await this._gestureEngine.loadEarCalibrationFromStorage()

    window.addEventListener('message', this._onWindowMessage, { signal: this._ac.signal })
    window.addEventListener('message', this._onBridgeRecoveryMessage, { signal: this._ac.signal })
    chrome.runtime.onMessage.addListener(this._onMessage)

    window.addEventListener('beforeunload', () => {
      void this.destroyPersistent()
    }, { signal: this._ac.signal })

    if (this._destroyed) return

    window.__nodexContentScript = this
  }

  /**
   * Production: `blocked` is not persisted — always confirm the pipeline is open after
   * init/restart so gestures work from the first frame (no stuck calibration lock).
   */
  _ensureGesturePipelineReady() {
    this._gestureEngine?.updateSettings({ blocked: false })
  }

  /**
   * MAIN-world bridge posts these while camera recovery runs; watchdog must not race getUserMedia.
   * @param {MessageEvent} e
   */
  _handleBridgeRecoveryMessage(e) {
    if (e.source !== window) return
    if (e.data?.type === BRIDGE_WINDOW.RECOVERING) this._bridgeRecovering = true
    if (e.data?.type === BRIDGE_WINDOW.RECOVERED) this._bridgeRecovering = false
  }

  async start() {
    if (this._destroyed) return
    if (this._running) {
      this._ensureGesturePipelineReady()
      this._sendStatus()
      if (this._page?._browseMode) this._page._browseController.refreshIfActive()
      return
    }
    this._running = true

    window.postMessage({
      type: 'NODEX_START_CAMERA',
      extensionBaseUrl: chrome.runtime.getURL(''),
    }, '*')

    this._page?._hud?.show()
    this._startWatchdog()
    if (this._page && !this._page._manualModeOverride) this._page._autoSetMode()
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
    this._gestureEngine?.stopCalibrationWizard()
    // Cancel any in-progress inline calibration so its timer can't fire after stop()
    // and attempt to save a baseline that was collected while the engine is no longer running.
    this._calibrating = false
    clearTimeout(this._inlineCalibrationTimer)
    this._inlineCalibrationTimer = null
    this._stopWatchdog()
    this._running = false

    this._page?._setMode(false)

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')

    this._page?._hud?.hide()
    await saveSettings({ engine_active: false }).catch(() => {})
    this._sendStatus()
  }

  async destroyPersistent() {
    if (this._destroyed) return
    this._stopWatchdog()
    this._destroyed = true

    if (window.__nodexContentScript === this) {
      window.__nodexContentScript = undefined
    }
    if (window.__nodexOrchestrator) {
      try {
        window.__nodexOrchestrator.destroy()
      } catch (_e) {
        /* ignore */
      }
      window.__nodexOrchestrator = null
    }
    if (window.__nodexPersistent) {
      window.__nodexPersistent = null
    }
    nodexPersistentSingleton = null

    this._page?.destroy()
    this._page = null

    clearTimeout(this._inlineCalibrationTimer)
    this._inlineCalibrationTimer = null

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')

    chrome.runtime.onMessage.removeListener(this._onMessage)

    if (window.__nodexGestureEngine === this._gestureEngine) {
      window.__nodexGestureEngine = undefined
    }
    this._gestureEngine?.destroy()

    this._ac.abort()

    this._gestureEngine = null
  }

  _handleWindowMessage(e) {
    if (e.source !== window) return

    if (e.data?.type === 'NODEX_LANDMARKS') {
      if (!this._running || this._destroyed) return
      if (!isValidLandmarkBatch(e.data.data)) return
      this._lastLandmarkTime = Date.now()

      // ── Face returned ────────────────────────────────────────────────────
      // Reset no-face timer; if we auto-paused, resume playback now.
      if (this._noFaceStartedAt !== null) {
        this._noFaceStartedAt = null
        if (this._autoPausedByUs) {
          this._autoPausedByUs = false
          // Resume only if video is still paused (user might have resumed manually).
          const video = document.querySelector('video')
          if (video?.paused) {
            this._page?._ytController?.execute(COMMANDS.PLAY_PAUSE)
            this._page?._hud?.showCommand(COMMANDS.PLAY)
          }
        }
      }

      const now = performance.now()
      if (now - this._lastFrameProcessedAt < FRAME_BUDGET_MS) return
      this._lastFrameProcessedAt = now

      this._gestureEngine?.processFrame(e.data.data)
    }

    // ── No face in frame ─────────────────────────────────────────────────────
    if (e.data?.type === BRIDGE_WINDOW.NO_FACE) {
      if (!this._running || !this._autoPauseEnabled || this._autoPausedByUs) return

      const now = Date.now()
      if (this._noFaceStartedAt === null) {
        this._noFaceStartedAt = now
        return
      }

      if (now - this._noFaceStartedAt >= this._noFaceTimeoutMs) {
        // Only auto-pause if the video is actually playing.
        const video = document.querySelector('video')
        if (video && !video.paused) {
          this._autoPausedByUs = true
          this._page?._ytController?.execute(COMMANDS.PLAY_PAUSE)
          this._page?._hud?.showWarning('Auto-paused — no face detected')
        }
      }
    }

    if (e.data?.type === 'NODEX_CAMERA_DENIED') {
      this._running = false
      this._stopWatchdog()
      console.warn('[Nodex] Camera access denied')
      this._page?._hud?.showWarning(
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
      this._page?._hud?.showWarning(e.data.error ?? 'Unknown error')
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

  _handleMessage(message, _sender, sendResponse) {
    const page = this._page
    switch (message.type) {
      case MSG.START_ENGINE:
        this.start()
        break

      case MSG.STOP_ENGINE:
        this.stop()
        break

      case MSG.SET_AUTO_PAUSE: {
        const enabled = Boolean(message.enabled)
        this._autoPauseEnabled = enabled
        // Reset state when toggling off so we don't leave a stale pause.
        if (!enabled) {
          this._noFaceStartedAt = null
          // If we had auto-paused and user disables the feature, resume.
          if (this._autoPausedByUs) {
            this._autoPausedByUs = false
            const video = document.querySelector('video')
            if (video?.paused) {
              this._page?._ytController?.execute(COMMANDS.PLAY_PAUSE)
            }
          }
        }
        saveSettings({ auto_pause_on_no_face: enabled }).catch(console.error)
        break
      }

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
        if (page?._browseMode) page._browseController.refreshIfActive()
        break

      case MSG.SAVE_CALIBRATION:
        if (message.baseline) {
          saveCalibration(message.baseline)
            .then(() => {
              this._gestureEngine?.updateSettings({ baseline: message.baseline, blocked: false })
              if (page?._browseMode) page._browseController.refreshIfActive()
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
        const activeMap = page?._browseMode ? this._browseGestureMap : this._playerGestureMap
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
        if (page) {
          page._manualModeOverride = true
          page._setMode(!page._browseMode)
          page._hud?.showCommand(page._browseMode ? 'BROWSE_ON' : 'BROWSE_OFF')
        }
        break

      case MSG.WIZARD_START:
        this._gestureEngine?.startCalibrationWizard(message.mode ?? 'full')
        break

      case MSG.WIZARD_ENTER_TEST:
        // Apply the newly collected calibration immediately so the test phase
        // detects blinks with the right threshold, and adjustBlinkThreshold() can
        // read _blinkCalibration.range (otherwise it early-returns on first run).
        if (message.earCalibration) {
          this._gestureEngine?.setBlinkCalibration(message.earCalibration)
        }
        this._gestureEngine?.enterWizardTestPhase()
        break

      case MSG.WIZARD_CANCEL:
        this._gestureEngine?.stopCalibrationWizard()
        break

      case MSG.CALIBRATION_COMPLETE:
        void this._handleCalibrationComplete(message)
        break

      case MSG.BLINK_THRESHOLD_ADJUST:
        if (typeof message.delta === 'number') {
          this._gestureEngine?.adjustBlinkThreshold(message.delta)
        }
        break

      case MSG.BLINK_THRESHOLD_UPDATED:
        if (
          typeof message.threshold === 'number' &&
          typeof message.exitThreshold === 'number'
        ) {
          this._gestureEngine?.applyBlinkThresholdUpdate({
            threshold: message.threshold,
            exitThreshold: message.exitThreshold,
          })
        }
        break

      default:
        break
    }

    sendResponse?.({ ok: true })
  }

  // --- Inline calibration via long blink ---
  // Subscribes GestureEngine._onMetrics — must always restore via restoreInlineCalibration() (try/finally below).

  _startInlineCalibration() {
    if (this._calibrating) return
    const ge = this._gestureEngine
    if (!ge) return

    this._calibrating = true

    const originalOnMetrics = ge._onMetrics
    const frames = []
    const started = Date.now()
    let finishScheduled = false
    let restored = false

    const restoreInlineCalibration = () => {
      if (restored) return
      restored = true
      if (this._inlineCalibrationTimer != null) {
        clearTimeout(this._inlineCalibrationTimer)
        this._inlineCalibrationTimer = null
      }
      ge._onMetrics = originalOnMetrics
    }

    try {
      this._page?._hud?.showWarning('Calibrating… Look straight ahead (2 sec)')
      ge.updateSettings({ blocked: true })

      ge._onMetrics = (metrics) => {
        try {
          frames.push(metrics)
          originalOnMetrics?.(metrics)

          if (
            !finishScheduled &&
            Date.now() - started >= INLINE_CALIBRATION_MS &&
            frames.length > 0
          ) {
            finishScheduled = true
            ge._onMetrics = originalOnMetrics
            void this._finishInlineCalibration(frames)
              .catch((err) => {
                console.error('[Nodex] inline calibration finish:', err)
                ge.updateSettings({ blocked: false })
              })
              .finally(() => {
                this._calibrating = false
                restoreInlineCalibration()
              })
          }
        } catch (err) {
          console.error('[Nodex] inline calibration metrics:', err)
          if (!finishScheduled) {
            finishScheduled = true
            this._calibrating = false
            ge.updateSettings({ blocked: false })
            restoreInlineCalibration()
          }
        }
      }

      this._inlineCalibrationTimer = setTimeout(() => {
        try {
          if (!this._calibrating || finishScheduled) {
            restoreInlineCalibration()
            return
          }
          ge._onMetrics = originalOnMetrics
          if (frames.length > 0) {
            finishScheduled = true
            void this._finishInlineCalibration(frames)
              .catch((err) => {
                console.error('[Nodex] inline calibration finish:', err)
                ge.updateSettings({ blocked: false })
              })
              .finally(() => {
                this._calibrating = false
                restoreInlineCalibration()
              })
          } else {
            this._calibrating = false
            ge.updateSettings({ blocked: false })
            this._page?._hud?.showWarning('Calibration failed')
            restoreInlineCalibration()
          }
        } catch (err) {
          console.error('[Nodex] inline calibration timer:', err)
          this._calibrating = false
          ge.updateSettings({ blocked: false })
          restoreInlineCalibration()
        }
      }, INLINE_CALIBRATION_MS + 2000)
    } catch (err) {
      console.error('[Nodex] inline calibration start:', err)
      this._calibrating = false
      ge.updateSettings({ blocked: false })
      restoreInlineCalibration()
    }
  }

  async _finishInlineCalibration(frames) {
    try {
      if (!this._calibrating) return
      if (!frames?.length) {
        this._gestureEngine?.updateSettings({ blocked: false })
        return
      }

      const earSamples = frames
        .map((f) => f.ear)
        .filter(
          (e) => typeof e === 'number' && Number.isFinite(e) && e > 0.015 && e < 0.55,
        )
      const earMedian =
        earSamples.length > 0
          ? medianOf(earSamples)
          : frames.reduce((s, f) => s + (f.ear ?? 0), 0) / frames.length

      const yawSamples = frames
        .map((f) => f.yaw)
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
      const pitchSamples = frames
        .map((f) => f.pitch)
        .filter((v) => typeof v === 'number' && Number.isFinite(v))
      const rollSamples = frames
        .map((f) => f.roll)
        .filter((v) => typeof v === 'number' && Number.isFinite(v))

      const baseline = {
        yaw:   yawSamples.length ? medianOf(yawSamples) : 0,
        pitch: pitchSamples.length ? medianOf(pitchSamples) : 0,
        roll:  rollSamples.length ? medianOf(rollSamples) : 0,
        ear:   earMedian,
      }

      try {
        await saveCalibration(baseline)
      } catch (e) {
        console.error('[Nodex]', e)
      } finally {
        this._gestureEngine?.updateSettings({ baseline, blocked: false })
      }

      this._page?._hud?.showCommand('CALIBRATED')

      this._sendToSidePanel({
        type: MSG.SAVE_CALIBRATION,
        baseline,
      })
    } catch (err) {
      console.error('[Nodex] inline calibration processing:', err)
      this._gestureEngine?.updateSettings({ blocked: false })
    }
  }

  _startWatchdog() {
    clearInterval(this._watchdogTimer)
    this._lastLandmarkTime = Date.now()
    this._restartAttempts = 0
    this._watchdogTimer = setInterval(() => { void this._watchdogCheck() }, WATCHDOG_INTERVAL_MS)
  }

  _stopWatchdog() {
    clearInterval(this._watchdogTimer)
    this._watchdogTimer = null
  }

  /**
   * MAIN-world bridge answers with video track state (ISOLATED cannot read bridge videoEl).
   * @returns {Promise<{ hasStream?: boolean, trackState?: string, paused?: boolean, requestId?: string } | null>}
   */
  _requestBridgeHealth() {
    return new Promise((resolve) => {
      const requestId = crypto.randomUUID()
      const timeoutMs = 400
      const timeout = setTimeout(() => {
        window.removeEventListener('message', handler)
        resolve(null)
      }, timeoutMs)
      const handler = (e) => {
        if (e.source !== window) return
        if (e.data?.type !== BRIDGE_WINDOW.HEALTH_CHECK_RESULT) return
        if (e.data.requestId !== requestId) return
        clearTimeout(timeout)
        window.removeEventListener('message', handler)
        resolve(e.data)
      }
      window.addEventListener('message', handler)
      window.postMessage({ type: BRIDGE_WINDOW.HEALTH_CHECK, requestId }, '*')
    })
  }

  async _watchdogCheck() {
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

    if (this._bridgeRecovering) return

    this._restartAttempts++

    if (this._restartAttempts > MAX_RESTART_ATTEMPTS) {
      this._page?._hud?.showWarning('Camera lost. Reload the page.')
      this.stop()
      this._sendToSidePanel({
        type: MSG.ENGINE_STATUS,
        running: false,
        error: 'bridge_dead',
      })
      return
    }

    const health = await this._requestBridgeHealth()
    if (health && health.trackState !== 'live') {
      console.warn('[Nodex] Watchdog: camera track not live; skipping blind bridge restart')
      this._restartAttempts = 0
      this._page?._hud?.showWarning('Camera lost. Stop, then Start the engine.')
      void this.stop()
      return
    }

    console.warn(
      `[Nodex] Watchdog: no landmarks for ${elapsed}ms, restarting bridge ` +
      `(attempt ${this._restartAttempts}/${MAX_RESTART_ATTEMPTS})`,
    )
    this._page?._hud?.showWarning('Reconnecting camera…')
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
    this._page?._hud?.showWarning('Extension updated. Reload the page.')
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

  /**
   * Persist wizard payloads and sync {@link GestureEngine}.
   * @param {object} message
   */
  async _handleCalibrationComplete(message) {
    const ge = this._gestureEngine
    if (!ge || this._destroyed) return
    try {
      const hasPose =
        typeof message.yawBaseline === 'number' &&
        Number.isFinite(message.yawBaseline) &&
        typeof message.pitchBaseline === 'number' &&
        Number.isFinite(message.pitchBaseline)

      if (hasPose) {
        const prev = await loadCalibration()
        const roll = typeof message.rollBaseline === 'number' && Number.isFinite(message.rollBaseline)
          ? message.rollBaseline
          : (prev?.roll ?? 0)
        const baseline = {
          ...(prev && typeof prev === 'object' ? prev : {}),
          yaw: message.yawBaseline,
          pitch: message.pitchBaseline,
          roll,
          ear:
            typeof message.earFromPose === 'number' && Number.isFinite(message.earFromPose)
              ? message.earFromPose
              : (prev?.ear ?? message.earCalibration?.earOpen),
        }
        ge.setNeutralPose({
          yawBaseline: message.yawBaseline,
          pitchBaseline: message.pitchBaseline,
          rollBaseline: roll,
        })
        await saveCalibration(baseline)
        ge.updateSettings({ baseline })
      }

      if (
        message.earCalibration &&
        typeof message.earCalibration === 'object' &&
        ((REFINE_LANDMARKS && message.earCalibration.signalType === 'iris') ||
          (!REFINE_LANDMARKS && message.earCalibration.signalType === 'ear'))
      ) {
        await chrome.storage.local.set({ earCalibration: message.earCalibration })
        ge.setBlinkCalibration(message.earCalibration)
      }

      await chrome.storage.local.set({
        calibrationCompleted: true,
        calibrationCompletedAt: Date.now(),
      })
    } catch (err) {
      console.error('[Nodex] CALIBRATION_COMPLETE failed:', err)
    } finally {
      ge.stopCalibrationWizard()
    }
  }
}

/**
 * Camera, GestureEngine, MAIN-world landmark listener, watchdog — once per tab until unload.
 * Idempotent: repeated calls return the same facade and never restart the camera.
 * @returns {typeof window.__nodexPersistent}
 */
function createPersistent() {
  if (window.__nodexPersistent != null) {
    return window.__nodexPersistent
  }

  const np = new NodexPersistent()
  nodexPersistentSingleton = np
  const initPromise = np.init()
  initPromise.catch((err) => {
    console.error('[Nodex] persistent init failed:', err)
  })

  window.__nodexPersistent = {
    get gestureEngine() {
      return np._gestureEngine
    },
    /** MediaPipe bridge runs in MAIN world via `postMessage`; no ISOLATED handle. */
    bridge: null,
    get watchdog() {
      return { running: np._watchdogTimer != null }
    },
    destroy() {
      np.destroyPersistent()
    },
    _initPromise: initPromise,
  }

  return window.__nodexPersistent
}

/**
 * BrowseController, YouTubeController, HUD, URL history — recreated on each `yt-navigate-finish`.
 * Wires to the existing {@link GestureEngine} via callbacks on {@link NodexPersistent} (`_page`).
 */
async function createPageScoped() {
  const np = nodexPersistentSingleton
  if (!np || np._destroyed) {
    console.error('[Nodex] createPageScoped: persistent missing')
    return
  }

  if (window.__nodexOrchestrator) {
    try {
      window.__nodexOrchestrator.destroy()
    } catch (_e) {
      /* ignore */
    }
    window.__nodexOrchestrator = null
  }

  const page = new NodexPageScoped(np)
  np.attachPage(page)
  await page.init()

  window.__nodexOrchestrator = {
    browseController: page._browseController,
    youTubeController: page._ytController,
    hud: page._hud,
    destroy() {
      page.destroy()
    },
  }
}

/**
 * YouTube fires this on document after in-app navigation finishes (new route painted).
 * Recreate page-scoped controllers only; GestureEngine and camera stay alive.
 */
function onYtNavigateFinish() {
  setTimeout(() => {
    void createPageScoped()
  }, 100)
}

document.addEventListener('yt-navigate-finish', onYtNavigateFinish)

const _nodexPersistentFacade = createPersistent()
void _nodexPersistentFacade._initPromise.then(() => createPageScoped())
} // end of __nodexLoaded guard
