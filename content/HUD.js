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
  [COMMANDS.BACK]:       '↩ Назад',
  BROWSE_ON:             '🔍 Навигация',
  BROWSE_OFF:            '▶️ Плеер',
  NO_VIDEOS:             '⚠ Нет видео на странице',
  CALIBRATED:            '✓ Калибровка сохранена',
})

const BROWSE_COMMAND_LABELS = Object.freeze({
  [COMMANDS.REWIND]:     '← Влево',
  [COMMANDS.SKIP]:       '→ Вправо',
  [COMMANDS.VOL_UP]:     '↑ Вверх',
  [COMMANDS.VOL_DOWN]:   '↓ Вниз',
  [COMMANDS.PLAY_PAUSE]: '✓ Выбрать',
  [COMMANDS.BACK]:       '↩ Назад',
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

  .nodex-toast.warning {
    border: 1px solid #ef4444;
    background: rgba(40, 10, 10, 0.92);
    font-size: 13px;
  }

  .nodex-mode-badge {
    background: rgba(10, 10, 10, 0.85);
    padding: 4px 10px;
    border-radius: 12px;
    font-size: 11px;
    font-weight: 600;
    backdrop-filter: blur(6px);
    align-self: flex-end;
    transition: background 0.2s ease, color 0.2s ease;
  }

  .hidden {
    display: none !important;
  }
`

export class HUD {
  constructor() {
    this._host       = null
    this._shadow     = null
    this._container  = null
    this._metrics    = null
    this._toast      = null
    this._toastTimer = null
    this._modeBadge  = null
  }

  mount() {
    this._host = document.createElement('div')
    this._host.id = 'nodex-hud-host'
    this._shadow = this._host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = HUD_STYLES
    this._shadow.appendChild(style)

    this._container = document.createElement('div')
    this._container.className = 'nodex-container'

    this._metrics = this._buildMetrics()

    this._toast = document.createElement('div')
    this._toast.className = 'nodex-toast'

    this._modeBadge = document.createElement('div')
    this._modeBadge.className = 'nodex-mode-badge'
    this._modeBadge.textContent = '▶️ Плеер'

    this._container.appendChild(this._modeBadge)
    this._container.appendChild(this._metrics)
    this._shadow.appendChild(this._container)
    this._shadow.appendChild(this._toast)

    document.body.appendChild(this._host)
  }

  show() {
    if (this._container) this._container.classList.remove('hidden')
  }

  hide() {
    if (this._container) this._container.classList.add('hidden')
  }

  showCommand(command, browseMode = false) {
    if (!this._toast) return

    this._toast.classList.remove('warning')
    const labels = browseMode ? BROWSE_COMMAND_LABELS : COMMAND_LABELS
    const label = labels[command] ?? COMMAND_LABELS[command] ?? command
    this._toast.textContent = label
    this._toast.classList.add('visible')

    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible')
    }, TOAST_DURATION_MS)
  }

  setModeIndicator(browseMode) {
    if (!this._modeBadge) return
    this._modeBadge.textContent = browseMode ? '🔍 Навигация' : '▶️ Плеер'
    this._modeBadge.style.background = browseMode ? '#00e5ff' : ''
    this._modeBadge.style.color = browseMode ? '#0a0a0a' : ''
  }

  showWarning(message) {
    if (!this._toast) return

    this._toast.textContent = message
    this._toast.classList.add('visible', 'warning')

    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible', 'warning')
    }, 5000)
  }

  updateMetrics(metrics) {
    if (!this._metrics) return
    this._setMetric('yaw',   metrics.yaw)
    this._setMetric('pitch', metrics.pitch)
    this._setMetric('ear',   metrics.ear)
  }

  unmount() {
    clearTimeout(this._toastTimer)

    if (this._host?.parentNode) {
      this._host.parentNode.removeChild(this._host)
    }

    this._host      = null
    this._shadow    = null
    this._container = null
    this._metrics   = null
    this._toast     = null
    this._modeBadge = null
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
}
