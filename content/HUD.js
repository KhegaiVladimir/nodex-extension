import { COMMANDS } from '../shared/constants/commands.js'

const TOAST_VISIBLE_MS  = 1400
const TOAST_FADE_MS     = 200

// ─── Inline SVG icons ────────────────────────────────────────────────────────
// viewBox="0 0 24 24", stroke-based, no fill unless noted.
const ICONS = Object.freeze({
  play: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="5,3 19,12 5,21" fill="currentColor" stroke="none"/></svg>`,

  pause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="6" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4" width="4" height="16" rx="1" fill="currentColor" stroke="none"/></svg>`,

  playpause: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,3 14,12 3,21" fill="currentColor" stroke="none"/><rect x="16" y="4" width="3" height="16" rx="1" fill="currentColor" stroke="none"/><rect x="20.5" y="4" width="3" height="16" rx="1" fill="currentColor" stroke="none"/></svg>`,

  volUp: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><path d="M17 9a4 4 0 0 1 0 6"/><path d="M19.5 6.5a8 8 0 0 1 0 11"/></svg>`,

  volDown: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><path d="M17 9a4 4 0 0 1 0 6"/></svg>`,

  mute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,7 3,17 8,17 14,21 14,3 8,7" fill="currentColor" stroke="none"/><line x1="17" y1="9" x2="23" y2="15"/><line x1="23" y1="9" x2="17" y2="15"/></svg>`,

  rewind: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="13,19 2,12 13,5" fill="currentColor" stroke="none"/><polygon points="22,19 11,12 22,5" fill="currentColor" stroke="none"/></svg>`,

  skip: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="2,5 13,12 2,19" fill="currentColor" stroke="none"/><polygon points="11,5 22,12 11,19" fill="currentColor" stroke="none"/></svg>`,

  next: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="3,5 16,12 3,19" fill="currentColor" stroke="none"/><line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2"/></svg>`,

  prev: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polygon points="21,5 8,12 21,19" fill="currentColor" stroke="none"/><line x1="5" y1="5" x2="5" y2="19" stroke="currentColor" stroke-width="2"/></svg>`,

  back: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-1"/></svg>`,

  browse: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`,

  player: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polygon points="10,9 10,15 15,12" fill="currentColor" stroke="none"/></svg>`,

  warning: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5"/></svg>`,

  check: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,

  arrowLeft:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18 9 12l6-6"/></svg>`,
  arrowRight: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18 15 12 9 6"/></svg>`,
  arrowUp:    `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 15 12 9l-6 6"/></svg>`,
  arrowDown:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>`,
  select:     `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`,
})

// ─── Command → { icon, label } ───────────────────────────────────────────────
const COMMAND_META = Object.freeze({
  [COMMANDS.PLAY]:       { icon: ICONS.play,      label: 'Play'       },
  [COMMANDS.PAUSE]:      { icon: ICONS.pause,     label: 'Pause'      },
  [COMMANDS.PLAY_PAUSE]: { icon: ICONS.playpause, label: 'Play / Pause' },
  [COMMANDS.VOL_UP]:     { icon: ICONS.volUp,     label: 'Volume Up'  },
  [COMMANDS.VOL_DOWN]:   { icon: ICONS.volDown,   label: 'Volume Down' },
  [COMMANDS.MUTE]:       { icon: ICONS.mute,      label: 'Mute'       },
  [COMMANDS.REWIND]:     { icon: ICONS.rewind,    label: 'Rewind'     },
  [COMMANDS.SKIP]:       { icon: ICONS.skip,      label: 'Skip'       },
  [COMMANDS.NEXT]:       { icon: ICONS.next,      label: 'Next'       },
  [COMMANDS.PREV]:       { icon: ICONS.prev,      label: 'Previous'   },
  [COMMANDS.BACK]:       { icon: ICONS.back,      label: 'Back'       },
  BROWSE_ON:             { icon: ICONS.browse,    label: 'Browse Mode' },
  BROWSE_OFF:            { icon: ICONS.player,    label: 'Player Mode' },
  NO_VIDEOS:             { icon: ICONS.warning,   label: 'No videos found', warning: true },
  CALIBRATED:            { icon: ICONS.check,     label: 'Calibration saved' },
})

const BROWSE_COMMAND_META = Object.freeze({
  [COMMANDS.REWIND]:     { icon: ICONS.arrowLeft,  label: 'Left'   },
  [COMMANDS.SKIP]:       { icon: ICONS.arrowRight, label: 'Right'  },
  [COMMANDS.VOL_UP]:     { icon: ICONS.arrowUp,    label: 'Up'     },
  [COMMANDS.VOL_DOWN]:   { icon: ICONS.arrowDown,  label: 'Down'   },
  [COMMANDS.PLAY_PAUSE]: { icon: ICONS.select,     label: 'Select' },
  [COMMANDS.BACK]:       { icon: ICONS.back,       label: 'Back'   },
})

// ─── Styles ───────────────────────────────────────────────────────────────────
const HUD_STYLES = /* css */`
  :host {
    all: initial;
    position: fixed;
    z-index: 2147483647;
    pointer-events: none;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
  }

  /* ── Toast ─────────────────────────────────────────────── */
  .toast {
    position: fixed;
    top: 68px;
    left: 50%;
    transform: translateX(-50%) scale(0.88);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 20px 10px 12px;
    background: rgba(8, 8, 12, 0.72);
    backdrop-filter: blur(20px) saturate(160%);
    -webkit-backdrop-filter: blur(20px) saturate(160%);
    border: 1px solid rgba(255, 255, 255, 0.10);
    border-radius: 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255,255,255,0.06) inset;
    opacity: 0;
    pointer-events: none;
    white-space: nowrap;
    transition: opacity ${TOAST_FADE_MS}ms ease, transform ${TOAST_FADE_MS}ms ease;
  }

  .toast.visible {
    opacity: 1;
    transform: translateX(-50%) scale(1);
  }

  .toast.warning {
    background: rgba(30, 8, 8, 0.82);
    border-color: rgba(255, 80, 80, 0.25);
    box-shadow: 0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,80,80,0.12) inset;
  }

  .toast-icon {
    width: 32px;
    height: 32px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(255, 255, 255, 0.08);
    border-radius: 10px;
    color: #ffffff;
  }

  .toast.warning .toast-icon {
    color: #ff6b6b;
    background: rgba(255, 80, 80, 0.12);
  }

  .toast-icon svg {
    width: 18px;
    height: 18px;
    display: block;
  }

  .toast-label {
    font-size: 14px;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.92);
    letter-spacing: 0.01em;
  }

  /* ── Metrics ────────────────────────────────────────────── */
  .panel {
    position: fixed;
    bottom: 16px;
    right: 16px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 6px;
  }

  .metrics {
    display: flex;
    gap: 1px;
    background: rgba(255,255,255,0.06);
    border-radius: 12px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
    backdrop-filter: blur(16px) saturate(140%);
    -webkit-backdrop-filter: blur(16px) saturate(140%);
  }

  .metric {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 5px 10px;
    background: rgba(8, 8, 12, 0.65);
    min-width: 42px;
    gap: 1px;
  }

  .metric:first-child { border-radius: 11px 0 0 11px; }
  .metric:last-child  { border-radius: 0 11px 11px 0; }

  /* EAR status dot: shows closed/open eye state in real time */
  .ear-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #64FFDA;
    transition: background 0.1s;
    flex-shrink: 0;
  }
  .ear-dot.closed {
    background: #ff6b6b;
  }

  .metric-label {
    font-size: 8px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255, 255, 255, 0.35);
  }

  .metric-value {
    font-size: 12px;
    font-weight: 600;
    font-family: ui-monospace, 'SF Mono', 'Cascadia Mono', 'Courier New', monospace;
    color: #64FFDA;
    letter-spacing: -0.02em;
  }

  /* ── Mode badge ──────────────────────────────────────────── */
  .mode-badge {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px 3px 6px;
    border-radius: 20px;
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.02em;
    backdrop-filter: blur(16px);
    -webkit-backdrop-filter: blur(16px);
    border: 1px solid rgba(255,255,255,0.08);
    transition: background 0.25s ease, color 0.25s ease, border-color 0.25s ease;
    background: rgba(8, 8, 12, 0.65);
    color: rgba(255,255,255,0.5);
  }

  .mode-badge.browse {
    background: rgba(100, 255, 218, 0.12);
    color: #64FFDA;
    border-color: rgba(100, 255, 218, 0.3);
  }

  .mode-badge svg {
    width: 10px;
    height: 10px;
    display: block;
    flex-shrink: 0;
  }

  .hidden { display: none !important; }
`

// ─── HUD class ────────────────────────────────────────────────────────────────
export class HUD {
  constructor() {
    this._host        = null
    this._shadow      = null
    this._toast       = null
    this._toastIcon   = null
    this._toastLabel  = null
    this._modeBadge   = null
    this._modeBadgeSvg = null
    this._modeBadgeLabel = null
    this._panel       = null
    this._toastTimer  = null
    // Cached metric value elements — avoid querySelector every frame
    this._metricYaw   = null
    this._metricPitch = null
    this._metricRoll  = null
    this._metricEar   = null
    this._earDot      = null
  }

  mount() {
    this._host = document.createElement('div')
    this._host.id = 'nodex-hud'
    this._shadow = this._host.attachShadow({ mode: 'closed' })

    const style = document.createElement('style')
    style.textContent = HUD_STYLES
    this._shadow.appendChild(style)

    this._buildToast()
    this._buildPanel()

    document.body.appendChild(this._host)
  }

  show() {
    if (this._panel) this._panel.classList.remove('hidden')
  }

  hide() {
    if (this._panel) this._panel.classList.add('hidden')
  }

  showCommand(command, browseMode = false) {
    if (!this._toast) return
    const meta =
      (browseMode ? BROWSE_COMMAND_META[command] : null) ??
      COMMAND_META[command]
    if (!meta) return

    this._toastIcon.innerHTML  = meta.icon
    this._toastLabel.textContent = meta.label

    if (meta.warning) {
      this._toast.classList.add('warning')
    } else {
      this._toast.classList.remove('warning')
    }

    this._toast.classList.add('visible')
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible')
    }, TOAST_VISIBLE_MS)
  }

  showWarning(message) {
    if (!this._toast) return
    this._toastIcon.innerHTML   = ICONS.warning
    this._toastLabel.textContent = message
    this._toast.classList.add('visible', 'warning')
    clearTimeout(this._toastTimer)
    this._toastTimer = setTimeout(() => {
      this._toast.classList.remove('visible', 'warning')
    }, 5000)
  }

  setModeIndicator(browseMode) {
    if (!this._modeBadge) return
    this._modeBadgeSvg.innerHTML   = browseMode ? ICONS.browse : ICONS.player
    this._modeBadgeLabel.textContent = browseMode ? 'Browse' : 'Player'
    if (browseMode) {
      this._modeBadge.classList.add('browse')
    } else {
      this._modeBadge.classList.remove('browse')
    }
  }

  // Called ~30fps — only mutates textContent / className, no layout queries
  updateMetrics(metrics) {
    if (!this._metricYaw) return
    this._metricYaw.textContent   = typeof metrics.yaw   === 'number' ? metrics.yaw.toFixed(1)   : '—'
    this._metricPitch.textContent = typeof metrics.pitch === 'number' ? metrics.pitch.toFixed(1) : '—'
    this._metricRoll.textContent  = typeof metrics.roll  === 'number' ? metrics.roll.toFixed(1)  : '—'
    this._metricEar.textContent   = typeof metrics.ear   === 'number' ? metrics.ear.toFixed(2)   : '—'

    // EAR dot: red when eyes appear closed (ear < 0.15), teal when open.
    // Threshold is intentionally loose — just for visual feedback, not for gesture logic.
    if (this._earDot && typeof metrics.ear === 'number') {
      if (metrics.ear < 0.15) {
        this._earDot.classList.add('closed')
      } else {
        this._earDot.classList.remove('closed')
      }
    }
  }

  unmount() {
    clearTimeout(this._toastTimer)
    this._host?.parentNode?.removeChild(this._host)
    this._host = this._shadow = this._toast = this._toastIcon =
      this._toastLabel = this._modeBadge = this._modeBadgeSvg =
      this._modeBadgeLabel = this._panel =
      this._metricYaw = this._metricPitch = this._metricRoll =
      this._metricEar = this._earDot = null
  }

  // ─── builders ──────────────────────────────────────────────

  _buildToast() {
    this._toast = document.createElement('div')
    this._toast.className = 'toast'

    this._toastIcon = document.createElement('div')
    this._toastIcon.className = 'toast-icon'

    this._toastLabel = document.createElement('span')
    this._toastLabel.className = 'toast-label'

    this._toast.appendChild(this._toastIcon)
    this._toast.appendChild(this._toastLabel)
    this._shadow.appendChild(this._toast)
  }

  _buildPanel() {
    this._panel = document.createElement('div')
    this._panel.className = 'panel'

    // Mode badge
    this._modeBadge = document.createElement('div')
    this._modeBadge.className = 'mode-badge'

    this._modeBadgeSvg = document.createElement('span')
    this._modeBadgeSvg.innerHTML = ICONS.player

    this._modeBadgeLabel = document.createElement('span')
    this._modeBadgeLabel.textContent = 'Player'

    this._modeBadge.appendChild(this._modeBadgeSvg)
    this._modeBadge.appendChild(this._modeBadgeLabel)

    // Metrics row
    const metricsEl = document.createElement('div')
    metricsEl.className = 'metrics'

    const defs = [
      { key: 'yaw',   label: 'YAW'   },
      { key: 'pitch', label: 'PITCH' },
      { key: 'roll',  label: 'ROLL'  },
      { key: 'ear',   label: 'EAR'   },
    ]

    for (const { key, label } of defs) {
      const col = document.createElement('div')
      col.className = 'metric'

      const lbl = document.createElement('span')
      lbl.className = 'metric-label'
      lbl.textContent = label

      const val = document.createElement('span')
      val.className = 'metric-value'
      val.textContent = '—'

      if (key === 'yaw')   this._metricYaw   = val
      if (key === 'pitch') this._metricPitch  = val
      if (key === 'roll')  this._metricRoll   = val
      if (key === 'ear') {
        this._metricEar = val
        // EAR status dot sits inline next to the value
        this._earDot = document.createElement('div')
        this._earDot.className = 'ear-dot'
        col.appendChild(lbl)
        col.appendChild(val)
        col.appendChild(this._earDot)
        metricsEl.appendChild(col)
        continue
      }

      col.appendChild(lbl)
      col.appendChild(val)
      metricsEl.appendChild(col)
    }

    this._panel.appendChild(this._modeBadge)
    this._panel.appendChild(metricsEl)
    this._shadow.appendChild(this._panel)
  }
}
