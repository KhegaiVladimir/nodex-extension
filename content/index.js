import { MSG } from '../shared/constants/messages.js'
import {
  DEFAULT_GESTURE_MAP,
  DEFAULT_COOLDOWNS,
  DEFAULT_THRESHOLDS,
} from '../shared/constants/defaults.js'
import {
  loadCalibration,
  loadSettings,
  loadGestureMap,
  saveCalibration,
  saveSettings,
} from '../shared/storage.js'

import { HUD } from './HUD.js'
import { GestureEngine } from './GestureEngine.js'
import { YouTubeController } from './YouTubeController.js'

// Guard against re-injection (e.g. after extension update or SPA navigation).
// Must come AFTER imports — ES module imports are hoisted and cannot be inside blocks.
if (window.__nodexLoaded) {
  // Already loaded — skip silently.
  // Do NOT throw: throwing breaks subsequent injections and leaves the page broken.
} else {
window.__nodexLoaded = true

const METRICS_SEND_INTERVAL = 3

class NodexContentScript {
  constructor() {
    this._hud            = null
    this._gestureEngine  = null
    this._ytController   = new YouTubeController()
    this._running        = false
    this._frameCount     = 0
    this._destroyed      = false

    this._onMessage       = this._handleMessage.bind(this)
    this._onWindowMessage = this._handleWindowMessage.bind(this)
  }

  async init() {
    const [calibration, settings, gestureMap] = await Promise.all([
      loadCalibration(),
      loadSettings({
        thresholds:    DEFAULT_THRESHOLDS,
        cooldowns:     DEFAULT_COOLDOWNS,
        engine_active: false,
      }),
      loadGestureMap(DEFAULT_GESTURE_MAP),
    ])

    this._hud = new HUD()
    await this._hud.mount()

    this._gestureEngine = new GestureEngine({
      thresholds: settings.thresholds ?? DEFAULT_THRESHOLDS,
      cooldowns:  settings.cooldowns  ?? DEFAULT_COOLDOWNS,
      gestureMap,
      baseline:   calibration,
      onCommand:  (cmd, gesture, metrics) => this._handleCommand(cmd, gesture, metrics),
      onMetrics:  (metrics) => this._handleMetrics(metrics),
    })

    window.addEventListener('message', this._onWindowMessage)
    chrome.runtime.onMessage.addListener(this._onMessage)

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
    await saveSettings({ engine_active: true }).catch(() => {})
    this._sendStatus()
  }

  async stop() {
    if (!this._running) return
    this._running = false

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')

    this._hud?.hide()
    await saveSettings({ engine_active: false }).catch(() => {})
    this._sendStatus()
  }

  async destroy() {
    if (this._destroyed) return
    this._destroyed = true

    window.postMessage({ type: 'NODEX_STOP_CAMERA' }, '*')
    window.removeEventListener('message', this._onWindowMessage)
    chrome.runtime.onMessage.removeListener(this._onMessage)

    this._gestureEngine?.destroy()
    this._hud?.unmount()

    this._gestureEngine = null
    this._hud           = null
  }

  _handleWindowMessage(e) {
    if (e.source !== window) return

    if (e.data?.type === 'NODEX_LANDMARKS') {
      if (!this._running || this._destroyed) return
      this._gestureEngine?.processFrame(e.data.data)
    }

    if (e.data?.type === 'NODEX_BRIDGE_ERROR') {
      console.error('[Nodex] Bridge error:', e.data.error)
    }

    /**
     * Мост (MAIN world) не может вызвать chrome.scripting напрямую.
     * Он шлёт сюда запрос, мы проксируем в service worker.
     * Оборачиваем в try/catch — если контекст расширения протух
     * (Extension context invalidated), просто молча выходим.
     */
    if (e.data?.type === 'NODEX_INJECT_MEDIAPIPE') {
      try {
        chrome.runtime.sendMessage({ type: 'INJECT_MEDIAPIPE' }, (response) => {
          if (chrome.runtime.lastError) {
            // Context invalidated or SW not responding — notify bridge so it doesn't hang
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
        // Extension context invalidated — swallow silently
        window.postMessage({
          type: 'NODEX_INJECT_MEDIAPIPE_RESULT',
          ok: false,
          error: err.message,
        }, '*')
      }
    }
  }

  _handleCommand(cmd, gesture, metrics) {
    const applied = this._ytController.execute(cmd)
    this._hud?.showCommand(cmd)

    this._sendToSidePanel({
      type: MSG.COMMAND_EXECUTED,
      command: cmd,
      gesture,
      applied,
      metrics,
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
        this._gestureEngine?.updateSettings(patch)
        break
      }

      case MSG.REQUEST_STATUS:
        this._sendStatus()
        break

      default:
        break
    }

    sendResponse?.({ ok: true })
  }

  _sendToSidePanel(payload) {
    try {
      chrome.runtime.sendMessage({
        type: MSG.CONTENT_TO_SIDEPANEL,
        ...payload,
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
