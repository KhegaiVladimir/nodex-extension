import { COMMANDS } from '../shared/constants/commands.js'

const TOAST_DURATION_MS = 1500

const COMMAND_LABELS = Object.freeze({
  [COMMANDS.PLAY]:       '▶ Воспроизведение',
  [COMMANDS.PAUSE]:      '⏸ Пауза',
  [COMMANDS.PLAY_PAUSE]: '⏯ Плей / Пауза',
  [COMMANDS.VOL_UP]:     '🔊 Громче',
  [COMMANDS.VOL_DOWN]:   '🔉 Тише',
  [COMMANDS.MUTE]:       '🔇 Без звука',
  [COMMANDS.REWIND]:     '⏪ Назад',
  [COMMANDS.SKIP]:       '⏩ Вперёд',
  [COMMANDS.NEXT]:       '⏭ Следующее',
  [COMMANDS.PREV]:       '⏮ Предыдущее',
})

const HUD_STYLES = /* css */ `
  :host {
    all: initial;
    position: fixed;
    bottom: 16px;
    right: 16px;
    z-index: 2147483647;
    font-family: 'DM Mono', 'Courier New', monospace;
    font-size: 12px;
    color: #f5f3ee;
    pointer-events: none;
  }

  .nodex-container {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }

  .nodex-video {
    width: 160px;
    height: 120px;
    border-radius: 8px;
    border: 2px solid #c8f55a;
    object-fit: cover;
    background: #000;
    transform: scaleX(-1);
  }

  .nodex-metrics {
    display: flex;
    gap: 8px;
    background: rgba(10, 10, 10, 0.85);
    padding: 6px 10px;
    border-radius: 6px;
    backdrop-filter: blur(6px);
  }

  .nodex-metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 40px;
  }

  .nodex-metric-label {
    font-size: 9px;
    text-transform: uppercase;
    opacity: 0.6;
    margin-bottom: 2px;
  }

  .nodex-metric-value {
    font-size: 13px;
    font-weight: bold;
    color: #c8f55a;
  }

  .nodex-toast {
    position: fixed;
    top: 60px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(10, 10, 10, 0.9);
    color: #f5f3ee;
    padding: 10px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: 600;
    border: 1px solid #c8f55a;
    backdrop-filter: blur(8px);
    opacity: 0;
    transition: opacity 0.2s ease;
    pointer-events: none;
  }

  .nodex-toast.visible {
    opacity: 1;
  }

  .hidden {
    display: none !important;
  }
`

export class HUD {
  constructor() {
    this._host      = null
    this._shadow    = null
    this._videoEl   = null
    this._container = null
    this._metrics   = null
    this._toast     = null
    this._toastTimer = null
    this._stream    = null
  }

  /**
   * Creates the Shadow DOM host, requests camera, returns the video element
   * that FaceEngine will use.
   * @returns {Promise<HTMLVideoElement>}
   */
  async mount() {
    this._host = document.createElement('div')
    this._host.id = 'nodex-hud-host'
    this._shadow = this._host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = HUD_STYLES
    this._shadow.appendChild(style)

    this._container = document.createElement('div')
    this._container.className = 'nodex-container'

    this._videoEl = document.createElement('video')
    this._videoEl.className = 'nodex-video'
    this._videoEl.setAttribute('playsinline', '')
    this._videoEl.setAttribute('autoplay', '')
    this._videoEl.muted = true

    this._metrics = this._buildMetrics()

    this._toast = document.createElement('div')
    this._toast.className = 'nodex-toast'

    this._container.appendChild(this._videoEl)
    this._container.appendChild(this._metrics)
    this._shadow.appendChild(this._container)
    this._shadow.appendChild(this._toast)

    document.body.appendChild(this._host)

    this._stream = await this._requestCamera()
    this._videoEl.srcObject = this._stream
    await this._videoEl.play()

    return this._videoEl
  }

  show() {
    if (this._container) this._container.classList.remove('hidden')
  }

  hide() {
    if (this._container) this._container.classList.add('hidden')
  }

  /**
   * Shows a toast with a human-readable Russian label for the command.
   */
  showCommand(command) {
    if (!this._toast) return

    const label = COMMAND_LABELS[command] ?? command
    this._toast.textContent = label
    this._toast.classList.add('visible')

    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible')
    }, TOAST_DURATION_MS)
  }

  /**
   * Updates the yaw / pitch / EAR indicator values.
   * @param {{ yaw: number, pitch: number, roll: number, ear: number, mouth: number }} metrics
   */
  updateMetrics(metrics) {
    if (!this._metrics) return
    this._setMetric('yaw',   metrics.yaw)
    this._setMetric('pitch', metrics.pitch)
    this._setMetric('ear',   metrics.ear)
  }

  /**
   * Stops all camera tracks and removes the HUD from the DOM.
   */
  unmount() {
    clearTimeout(this._toastTimer)

    if (this._stream) {
      for (const track of this._stream.getTracks()) track.stop()
      this._stream = null
    }

    if (this._videoEl) {
      this._videoEl.srcObject = null
      this._videoEl = null
    }

    if (this._host?.parentNode) {
      this._host.parentNode.removeChild(this._host)
    }

    this._host      = null
    this._shadow    = null
    this._container = null
    this._metrics   = null
    this._toast     = null
  }

  // --- internals ---

  _buildMetrics() {
    const wrap = document.createElement('div')
    wrap.className = 'nodex-metrics'

    for (const key of ['yaw', 'pitch', 'ear']) {
      const col = document.createElement('div')
      col.className = 'nodex-metric'

      const lbl = document.createElement('span')
      lbl.className = 'nodex-metric-label'
      lbl.textContent = key

      const val = document.createElement('span')
      val.className = 'nodex-metric-value'
      val.dataset.metric = key
      val.textContent = '—'

      col.appendChild(lbl)
      col.appendChild(val)
      wrap.appendChild(col)
    }

    return wrap
  }

  _setMetric(key, value) {
    const el = this._metrics?.querySelector(`[data-metric="${key}"]`)
    if (!el) return
    el.textContent = typeof value === 'number' ? value.toFixed(1) : '—'
  }

  /**
   * Requests the user-facing camera.
   * Provides clear error messages for common failure modes.
   * @returns {Promise<MediaStream>}
   */
  async _requestCamera() {
    try {
      return await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 },
        audio: false,
      })
    } catch (err) {
      if (err.name === 'NotAllowedError') {
        throw new Error(
          'Доступ к камере запрещён. Разрешите доступ в настройках браузера и перезагрузите страницу.'
        )
      }
      if (err.name === 'NotFoundError') {
        throw new Error(
          'Камера не найдена. Подключите камеру и перезагрузите страницу.'
        )
      }
      throw new Error(`Ошибка камеры: ${err.message}`)
    }
  }
}
