import React, { useState, useEffect, useRef, useCallback } from 'react'
import { MSG } from '../shared/constants/messages.js'
import { GESTURES } from '../shared/constants/gestures.js'
import { COMMANDS } from '../shared/constants/commands.js'
import {
  PLAYER_GESTURE_MAP,
  BROWSE_GESTURE_MAP,
  DEFAULT_THRESHOLDS,
  SENSITIVITY_PRESETS,
} from '../shared/constants/defaults.js'
import {
  savePlayerGestureMap,
  saveBrowseGestureMap,
  saveSettings,
  loadPlayerGestureMap,
  loadBrowseGestureMap,
  loadSettings,
  loadCalibration,
} from '../shared/storage.js'
import CalibrationWizard from './CalibrationWizard.jsx'

/* ──────────────────────────────────────────────────────
   ICON SYSTEM  (thin-stroke, 24×24 viewBox)
────────────────────────────────────────────────────── */

const Icon = ({ size = 16, sw = 1.5, children, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"
    style={{ display: 'block', ...style }}>
    {children}
  </svg>
)

const IconPlay       = (p) => <Icon {...p}><path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none"/></Icon>
const IconPause      = (p) => <Icon {...p}><rect x="7" y="5" width="3" height="14" rx="0.5" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3" height="14" rx="0.5" fill="currentColor" stroke="none"/></Icon>
const IconVolUp      = (p) => <Icon {...p}><path d="M4 10v4h3l4 4V6l-4 4H4z"/><path d="M16 8a5 5 0 010 8M19 5a8 8 0 010 14"/></Icon>
const IconSkip       = (p) => <Icon {...p}><path d="M13 5l7 7-7 7V5zM4 5l7 7-7 7V5z" fill="currentColor" stroke="none"/></Icon>
const IconRewind     = (p) => <Icon {...p}><path d="M11 19L4 12l7-7v14zM20 19l-7-7 7-7v14z" fill="currentColor" stroke="none"/></Icon>
const IconBack       = (p) => <Icon {...p}><path d="M11 17l-5-5 5-5M6 12h13"/></Icon>
const IconBrowse     = (p) => <Icon {...p}><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></Icon>
const IconPlayer     = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/></Icon>
const IconWarning    = (p) => <Icon {...p}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.5" fill="currentColor"/></Icon>
const IconCheck      = (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>
const IconArrowLeft  = (p) => <Icon {...p}><path d="M14 6l-6 6 6 6"/></Icon>
const IconArrowRight = (p) => <Icon {...p}><path d="M10 6l6 6-6 6"/></Icon>
const IconCamera     = (p) => <Icon {...p}><path d="M4 7h4l2-2h4l2 2h4v12H4V7z"/><circle cx="12" cy="13" r="3.5"/></Icon>
const IconSun        = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></Icon>
const IconMoon       = (p) => <Icon {...p}><path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z"/></Icon>
const IconMonitor    = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></Icon>
const IconFace       = (p) => <Icon {...p}><circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="10.5" r="0.6" fill="currentColor" stroke="none"/><circle cx="14.5" cy="10.5" r="0.6" fill="currentColor" stroke="none"/><path d="M9 15c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4"/></Icon>
const IconNodLR      = (p) => <Icon {...p}><circle cx="12" cy="9" r="3.5"/><path d="M5 14l-2 2 2 2M19 14l2 2-2 2M3 16h18"/></Icon>
const IconNodUD      = (p) => <Icon {...p}><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M10 5l2-2 2 2M10 19l2 2 2-2"/></Icon>
const IconTilt       = (p) => <Icon {...p}><circle cx="12" cy="12" r="3.5"/><path d="M5 17c2-3 4-4.5 7-4.5s5 1.5 7 4.5"/></Icon>
const IconBlink      = (p) => <Icon {...p}><path d="M2 12c2-3.5 6-5.5 10-5.5s8 2 10 5.5"/><path d="M2 12c2 3.5 6 5.5 10 5.5s8-2 10-5.5"/></Icon>
const IconShield     = (p) => <Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></Icon>
const IconClose      = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>
const IconClock      = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>
const IconChevronDown = (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>
const IconChevronRight = (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>
const IconSettings   = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></Icon>
const IconVolDown    = (p) => <Icon {...p}><path d="M4 10v4h3l4 4V6l-4 4H4z"/><path d="M16 10l4 4M20 10l-4 4"/></Icon>
const IconEye        = (p) => <Icon {...p}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></Icon>
const IconInfo       = (p) => <Icon {...p}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/></Icon>

/* Nodex logo mark — accent-tinted face node icon */
const NodexLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block', flexShrink: 0 }}>
    <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" opacity="0.08"/>
    <rect x="1" y="1" width="22" height="22" rx="6" stroke="var(--accent)" strokeWidth="1" opacity="0.35"/>
    <path d="M8 8c0-1.5 1.2-2.5 3-2.5 4 0 5 3 5 5.5v3c0 .5-.3.8-.8.8H14.5c0 1.8-1 3-2.5 3H9.5"
      stroke="var(--accent)" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="13" cy="11" r="0.9" fill="var(--accent)"/>
  </svg>
)

/* ──────────────────────────────────────────────────────
   THEME / ACCENT HELPERS
   (OKLCH → sRGB conversion, system theme hook)
────────────────────────────────────────────────────── */

function oklchToHex(l, c, h) {
  const hr = h * Math.PI / 180
  const a = c * Math.cos(hr), b = c * Math.sin(hr)
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b
  const L = l_ ** 3, M = m_ ** 3, S = s_ ** 3
  let r  =  4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S
  let g  = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S
  let bl = -0.0041960863 * L - 0.7034186147 * M + 1.7076147010 * S
  const gm = x => x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(Math.max(0, x), 1 / 2.4) - 0.055
  r = Math.max(0, Math.min(1, gm(r))); g = Math.max(0, Math.min(1, gm(g))); bl = Math.max(0, Math.min(1, gm(bl)))
  const toH = v => Math.round(v * 255).toString(16).padStart(2, '0')
  return `#${toH(r)}${toH(g)}${toH(bl)}`
}

const hexToRgb = h => ({
  r: parseInt(h.slice(1, 3), 16),
  g: parseInt(h.slice(3, 5), 16),
  b: parseInt(h.slice(5, 7), 16),
})

function useSystemTheme() {
  const [sys, setSys] = useState(
    () => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const h = e => setSys(e.matches ? 'dark' : 'light')
    mq.addEventListener?.('change', h)
    return () => mq.removeEventListener?.('change', h)
  }, [])
  return sys
}

/* ──────────────────────────────────────────────────────
   CHROME MESSAGING HELPERS  (unchanged from v1.1)
────────────────────────────────────────────────────── */

/**
 * Active YouTube tab in the current window — synced from App via useEffect.
 * Module-level so onMessage callbacks never read a stale tab id.
 * @type {{ current: number | null }}
 */
const activeYouTubeTabIdRef = { current: null }

function shouldIgnoreSidePanelMessage(message) {
  if (!message || typeof message !== 'object') return false
  const id = /** @type {{ __sourceTabId?: number }} */ (message).__sourceTabId
  if (id == null) return false
  return id !== activeYouTubeTabIdRef.current
}

async function queryActiveYouTubeTabId() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (tab?.id != null && typeof tab.url === 'string' && tab.url.startsWith('https://www.youtube.com/')) {
      return tab.id
    }
    return null
  } catch (e) {
    console.error('[Nodex] tabs.query failed:', e)
    return null
  }
}

async function sendToContent(payload) {
  const tabId = activeYouTubeTabIdRef.current
  if (tabId == null) return
  try {
    await chrome.runtime.sendMessage({
      type: MSG.SIDEPANEL_TO_CONTENT,
      tabId,
      inner: payload,
    })
  } catch {
    /* tab gone or SW busy */
  }
}

async function requestEngineStatus() {
  const tabId = activeYouTubeTabIdRef.current
  if (tabId == null) return
  try {
    await chrome.runtime.sendMessage({ type: MSG.REQUEST_STATUS, tabId })
  } catch { /* ignore */ }
}

/* ──────────────────────────────────────────────────────
   LABEL MAPS  (unchanged)
────────────────────────────────────────────────────── */

const GESTURE_LABELS = {
  [GESTURES.HEAD_LEFT]:   'Head Left',
  [GESTURES.HEAD_RIGHT]:  'Head Right',
  [GESTURES.HEAD_UP]:     'Head Up',
  [GESTURES.HEAD_DOWN]:   'Head Down',
  [GESTURES.TILT_LEFT]:   'Tilt Left',
  [GESTURES.TILT_RIGHT]:  'Tilt Right',
  [GESTURES.EYES_CLOSED]: 'Eyes Closed',
  [GESTURES.EYES_HOLD]:   'Eyes Hold',
  [GESTURES.MOUTH_OPEN]:  'Mouth Open',
}

/* Small 16×16 SVG icons for each gesture, thin stroke to match design system */
const G_ICON = (paths) => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
)

const GESTURE_ICONS = {
  [GESTURES.HEAD_LEFT]:   G_ICON(<><path d="M15 18 9 12l6-6"/><path d="M21 12H9"/></>),
  [GESTURES.HEAD_RIGHT]:  G_ICON(<><path d="M9 18l6-6-6-6"/><path d="M3 12h12"/></>),
  [GESTURES.HEAD_UP]:     G_ICON(<><path d="M18 15l-6-6-6 6"/><path d="M12 21V9"/></>),
  [GESTURES.HEAD_DOWN]:   G_ICON(<><path d="M6 9l6 6 6-6"/><path d="M12 3v12"/></>),
  [GESTURES.TILT_LEFT]:   G_ICON(<><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 7v5h5"/></>),
  [GESTURES.TILT_RIGHT]:  G_ICON(<><path d="M21 12a9 9 0 1 1-9-9"/><path d="M21 7v5h-5"/></>),
  [GESTURES.EYES_CLOSED]: G_ICON(<><path d="M2 12s3.6-7 10-7 10 7 10 7"/><path d="M2 16s3.6-4 10-4 10 4 10 4"/><line x1="4" y1="21" x2="6" y2="17"/><line x1="12" y1="22" x2="12" y2="18"/><line x1="20" y1="21" x2="18" y2="17"/></>),
  [GESTURES.EYES_HOLD]:   G_ICON(<><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/><line x1="12" y1="5" x2="12" y2="2"/><line x1="12" y1="22" x2="12" y2="19"/></>),
  [GESTURES.MOUTH_OPEN]:  G_ICON(<><path d="M8 14s1.5 2 4 2 4-2 4-2"/><circle cx="12" cy="12" r="9"/><line x1="9" y1="10" x2="9.01" y2="10" strokeWidth="2.5"/><line x1="15" y1="10" x2="15.01" y2="10" strokeWidth="2.5"/></>),
}

const COMMAND_LABELS = {
  [COMMANDS.PLAY]:        'Play',
  [COMMANDS.PAUSE]:       'Pause',
  [COMMANDS.PLAY_PAUSE]:  'Play / Pause',
  [COMMANDS.VOL_UP]:      'Volume Up',
  [COMMANDS.VOL_DOWN]:    'Volume Down',
  [COMMANDS.MUTE]:        'Mute',
  [COMMANDS.REWIND]:      'Rewind −10s',
  [COMMANDS.SKIP]:        'Skip +10s',
  [COMMANDS.NEXT]:        'Next Video',
  [COMMANDS.PREV]:        'Prev Video',
  [COMMANDS.BACK]:        'Go Back',
  [COMMANDS.TOGGLE_MODE]: 'Switch Mode',
  [COMMANDS.NONE]:        '—',
}

const BROWSE_COMMAND_LABELS = {
  [COMMANDS.REWIND]:      'Left',
  [COMMANDS.SKIP]:        'Right',
  [COMMANDS.VOL_UP]:      'Up',
  [COMMANDS.VOL_DOWN]:    'Down',
  [COMMANDS.PLAY_PAUSE]:  'Select',
  [COMMANDS.BACK]:        'Go Back',
  [COMMANDS.TOGGLE_MODE]: 'Switch Mode',
  [COMMANDS.NONE]:        '—',
}

const BROWSE_COMMANDS = [
  COMMANDS.REWIND, COMMANDS.SKIP,
  COMMANDS.VOL_UP, COMMANDS.VOL_DOWN,
  COMMANDS.PLAY_PAUSE, COMMANDS.BACK, COMMANDS.TOGGLE_MODE, COMMANDS.NONE,
]

/* ──────────────────────────────────────────────────────
   NEW UI PRIMITIVES
────────────────────────────────────────────────────── */

/* Pulsing status dot */
const StatusDot = ({ state = 'active' }) => {
  const color =
    state === 'active'  ? 'var(--green)'  :
    state === 'warning' ? 'var(--amber)'  : 'var(--muted)'
  return (
    <span style={{
      display: 'inline-block',
      width: 6, height: 6, borderRadius: '50%',
      background: color, color,
      flexShrink: 0,
      animation: state === 'active' ? 'pulse-dot 1.8s infinite' : 'none',
    }}/>
  )
}

/* Inline tracking status chip */
const TrackingChip = ({ running, browseMode, isLoading }) => {
  const state = isLoading ? 'warning' : running ? 'active' : 'idle'
  const label = isLoading ? 'Starting…' : running ? 'Tracking' : 'Idle'
  const mode  = browseMode ? 'Browse' : 'Player'
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 8,
      padding: '5px 11px 5px 9px', borderRadius: 999,
      background: running ? 'var(--accent-dim)' : 'var(--surface-2)',
      border: '1px solid ' + (running ? 'rgba(var(--accent-rgb),0.22)' : 'var(--border)'),
      fontSize: 11.5, fontWeight: 500,
      color: running ? 'var(--accent)' : 'var(--text-2)',
      transition: 'all 200ms var(--ease-out)',
    }}>
      <StatusDot state={state}/>
      <span>{label}</span>
      {running && !isLoading && <>
        <span style={{ width: 1, height: 10, background: 'currentColor', opacity: 0.2 }}/>
        <span style={{ opacity: 0.7 }}>{mode}</span>
      </>}
    </div>
  )
}

/* Live face position visualizer */
const FaceViz = ({ metrics, running }) => {
  const [smooth, setSmooth] = useState({ x: 0, y: 0 })
  const rafRef = useRef(null)
  const lastRef = useRef(performance.now())

  useEffect(() => {
    const tick = (now) => {
      const dt = Math.min(0.05, (now - lastRef.current) / 1000)
      lastRef.current = now
      if (metrics) {
        setSmooth(prev => ({
          x: prev.x + (metrics.yaw   - prev.x) * Math.min(1, dt * 8),
          y: prev.y + (metrics.pitch - prev.y) * Math.min(1, dt * 8),
        }))
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [metrics])

  return (
    <div style={{
      position: 'relative',
      aspectRatio: '2 / 1',
      borderRadius: 12,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* dot grid background */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.45 }}>
        <defs>
          <pattern id="fv-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="var(--text-3)" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fv-dots)"/>
      </svg>

      {/* face circle + dot */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {/* outer guide circle */}
        <div style={{
          width: '52%', aspectRatio: '1/1', borderRadius: '50%',
          border: '1px solid var(--accent)',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.05), transparent 70%)',
          position: 'absolute',
        }}/>
        {/* moving dot */}
        <div style={{
          transform: `translate(${smooth.x * 2.4}px, ${-smooth.y * 2.4}px)`,
          transition: 'transform 40ms linear',
        }}>
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px rgba(var(--accent-rgb), 0.55)',
            animation: running && metrics ? 'pose-breathe 3s ease-in-out infinite' : 'none',
          }}/>
        </div>
      </div>

      {/* corner label */}
      <span style={{
        position: 'absolute', top: 9, left: 12,
        fontSize: 10, color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
      }}>POSE</span>
    </div>
  )
}

/* Thin threshold gauge bar */
const ThresholdBar = ({ value, max, threshold, type = 'centered', triggerBelow = false }) => {
  const pct = Math.max(-1, Math.min(1, value / max))
  const absPct = Math.min(1, Math.abs(value) / max)
  const triggered = triggerBelow ? value <= threshold : Math.abs(value) >= threshold
  const near = triggerBelow
    ? value <= threshold * 1.3
    : Math.abs(value) >= threshold * 0.7
  const tPct = Math.min(1, threshold / max)
  const color = triggered ? 'var(--accent)' : near ? 'var(--accent)' : 'var(--text-2)'
  const opacity = triggered ? 1 : near ? 0.7 : 0.4

  return (
    <div style={{
      position: 'relative', height: 4, borderRadius: 999,
      background: 'var(--surface-3)', overflow: 'visible',
    }}>
      {type === 'centered' ? (
        <>
          <div style={{
            position: 'absolute', top: 0, bottom: 0,
            left: pct >= 0 ? '50%' : `${50 + pct * 50}%`,
            width: `${absPct * 50}%`,
            background: color, opacity,
            borderRadius: 999,
            transition: 'left 60ms linear, width 60ms linear, opacity 180ms',
          }}/>
          {/* center tick */}
          <div style={{ position: 'absolute', top: -1, bottom: -1, left: '50%', width: 1, background: 'var(--border-light)' }}/>
          {/* threshold markers */}
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${50 + tPct * 50}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${50 - tPct * 50}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
        </>
      ) : (
        <>
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: 0,
            width: `${Math.max(0, Math.min(1, value / max)) * 100}%`,
            background: color, opacity,
            borderRadius: 999,
            transition: 'width 60ms linear, opacity 180ms',
          }}/>
          <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${tPct * 100}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
        </>
      )}
    </div>
  )
}

/* Metric row: label + value + gauge */
const MetricRow = ({ label, value, max, threshold, type = 'centered', unit = '°', triggerBelow = false }) => {
  const triggered = triggerBelow ? value <= threshold : Math.abs(value) >= threshold
  const display = type === 'centered'
    ? (value >= 0 ? '+' : '') + value.toFixed(1) + unit
    : value.toFixed(2)
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6, gap: 12 }}>
        <span style={{ fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1 }}/>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500,
          color: triggered ? 'var(--accent)' : 'var(--text)',
          fontFeatureSettings: "'tnum'",
          transition: 'color 180ms',
          whiteSpace: 'nowrap',
        }}>{display}</span>
      </div>
      <ThresholdBar value={value} max={max} threshold={threshold} type={type} triggerBelow={triggerBelow}/>
    </div>
  )
}

/* Toggle switch (button-based, no hidden input) */
const Toggle = ({ on, onChange }) => (
  <button
    onClick={() => onChange(!on)}
    aria-pressed={on}
    style={{
      width: 32, height: 19, borderRadius: 999, padding: 0, flexShrink: 0,
      background: on ? 'var(--accent)' : 'var(--surface-3)',
      border: '1px solid ' + (on ? 'rgba(var(--accent-rgb),0.3)' : 'var(--border-mid)'),
      position: 'relative',
      transition: 'background 200ms var(--ease-out), border-color 200ms',
    }}
  >
    <span style={{
      position: 'absolute', top: 2, left: on ? 13 : 2,
      width: 13, height: 13, borderRadius: '50%',
      background: on ? 'var(--accent-ink)' : 'var(--text-2)',
      transition: 'left 200ms var(--ease-out)',
    }}/>
  </button>
)

/* Settings card wrapper */
const SectionCard = ({ title, desc, children }) => (
  <div style={{
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    overflow: 'hidden',
    animation: 'fade-in 220ms var(--ease-out) both',
  }}>
    <div style={{ padding: '11px 14px 10px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{desc}</div>}
    </div>
    {children}
  </div>
)

/* Settings row inside SectionCard */
const SettingsRow = ({ title, desc, children, first = false }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '11px 14px',
    borderTop: first ? 'none' : '1px solid var(--border)',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{title}</div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{desc}</div>}
    </div>
    {children}
  </div>
)

/* Animated custom dropdown — replaces native <select> for binding rows */
const Dropdown = ({ value, options, labels, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  const displayLabel = labels[value] ?? value
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: '5px 8px 5px 10px',
        background: open ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text)',
        border: '1px solid ' + (open ? 'var(--border-light)' : 'var(--border)'),
        borderRadius: 7, fontSize: 12, fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 140ms var(--ease-out)', textAlign: 'left',
        cursor: 'pointer',
      }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayLabel}</span>
        <IconChevronDown size={11} sw={1.7} style={{ color: 'var(--text-3)', flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}/>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 8,
          padding: 3, zIndex: 20, boxShadow: 'var(--shadow-card)',
          maxHeight: 240, overflowY: 'auto', animation: 'soft-in 160ms var(--ease-out)',
        }}>
          {options.map(o => {
            const label = labels[o] ?? o
            const active = o === value
            return (
              <button key={o} onClick={() => { onChange(o); setOpen(false) }} style={{
                width: '100%', padding: '6px 9px', borderRadius: 5,
                textAlign: 'left', fontSize: 12,
                background: active ? 'var(--accent-dim)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text)',
                transition: 'background 100ms', cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'var(--surface-2)' }}
              onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}>
                {label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

/* Gesture binding row */
const BindingRow = ({ gesture, icon, value, options, labels, onChange, first = false }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '20px 1fr 148px',
    alignItems: 'center', gap: 10,
    padding: '9px 14px',
    borderTop: first ? 'none' : '1px solid var(--border)',
  }}>
    <span style={{ color: 'var(--text-2)', display: 'flex', justifyContent: 'center' }}>
      {icon}
    </span>
    <span style={{ fontSize: 12.5 }}>{gesture}</span>
    <Dropdown value={value} options={options} labels={labels} onChange={onChange}/>
  </div>
)

/* Theme picker (Light / Dark / System) */
const ThemePicker = ({ theme, setTheme }) => {
  const opts = [
    { k: 'light', l: 'Light' },
    { k: 'dark',  l: 'Dark'  },
    { k: 'system', l: 'System' },
  ]
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      {opts.map(o => (
        <button key={o.k} onClick={() => setTheme(o.k)} style={{
          flex: 1, padding: '6px 8px', borderRadius: 5,
          background: theme === o.k ? 'var(--surface)' : 'transparent',
          color: theme === o.k ? 'var(--text)' : 'var(--text-2)',
          boxShadow: theme === o.k ? 'var(--shadow-soft)' : 'none',
          fontSize: 11.5, fontWeight: 500,
          transition: 'all 160ms var(--ease-out)',
        }}>{o.l}</button>
      ))}
    </div>
  )
}

/* Accent color picker */
const ACCENT_PRESETS = [
  { id: 170, label: 'Mint'   },
  { id: 125, label: 'Lime'   },
  { id: 80,  label: 'Yellow' },
  { id: 230, label: 'Blue'   },
  { id: 40,  label: 'Peach'  },
  { id: 350, label: 'Pink'   },
]

function accentPreview(hue, effectiveTheme) {
  return oklchToHex(effectiveTheme === 'light' ? 0.55 : 0.8, 0.14, hue)
}

const AccentPicker = ({ mode, hue, setMode, setHue, effectiveTheme }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
    {ACCENT_PRESETS.map(p => {
      const active = mode === 'color' && Math.abs(hue - p.id) < 5
      const preview = accentPreview(p.id, effectiveTheme)
      return (
        <button key={p.id} onClick={() => { setMode('color'); setHue(p.id) }} title={p.label} style={{
          aspectRatio: '1/1', borderRadius: 8,
          background: preview,
          border: '2px solid ' + (active ? preview : 'transparent'),
          outline: active ? '2px solid var(--bg)' : 'none',
          outlineOffset: -4,
          transform: active ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 140ms var(--ease-out), outline 140ms',
        }}/>
      )
    })}
    {/* Minimal (monochrome) swatch */}
    {(() => {
      const active = mode === 'minimal'
      const bg = effectiveTheme === 'light' ? '#1a1d21' : '#f0f1f3'
      return (
        <button onClick={() => setMode('minimal')} title="Minimal" style={{
          aspectRatio: '1/1', borderRadius: 8,
          background: bg,
          border: '2px solid ' + (active ? bg : 'transparent'),
          outline: active ? '2px solid var(--bg)' : 'none',
          outlineOffset: -4,
          display: 'grid', placeItems: 'center',
          fontSize: 9, fontWeight: 700,
          color: effectiveTheme === 'light' ? '#fff' : '#0a0b0d',
          transform: active ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 140ms var(--ease-out), outline 140ms',
        }}>Aa</button>
      )
    })()}
  </div>
)

/* ──────────────────────────────────────────────────────
   APP ROOT
────────────────────────────────────────────────────── */

export default function App() {
  /* ── Theme / accent ── */
  const [theme, setThemeState] = useState('dark')           // 'light' | 'dark' | 'system'
  const [accentMode, setAccentModeState] = useState('minimal') // 'minimal' | 'color'
  const [accentHue, setAccentHueState] = useState(170)
  const sys = useSystemTheme()
  const effectiveTheme = theme === 'system' ? sys : theme

  useEffect(() => {
    chrome.storage.local
      .get(['nodex_theme', 'nodex_accent_mode', 'nodex_accent_hue'])
      .then(r => {
        if (r.nodex_theme) setThemeState(r.nodex_theme)
        if (r.nodex_accent_mode) setAccentModeState(r.nodex_accent_mode)
        if (typeof r.nodex_accent_hue === 'number') setAccentHueState(r.nodex_accent_hue)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme)
  }, [effectiveTheme])

  useEffect(() => {
    const root = document.documentElement
    if (accentMode === 'minimal') {
      root.style.removeProperty('--accent')
      root.style.removeProperty('--accent-rgb')
      root.style.removeProperty('--accent-ink')
    } else {
      const hex = oklchToHex(effectiveTheme === 'light' ? 0.55 : 0.82, 0.14, accentHue)
      const rgb = hexToRgb(hex)
      root.style.setProperty('--accent', hex)
      root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`)
      root.style.setProperty('--accent-ink', effectiveTheme === 'light' ? '#ffffff' : '#060709')
    }
  }, [accentMode, accentHue, effectiveTheme])

  const handleSetTheme = useCallback((t) => {
    setThemeState(t)
    chrome.storage.local.set({ nodex_theme: t }).catch(() => {})
  }, [])
  const handleSetAccentMode = useCallback((m) => {
    setAccentModeState(m)
    chrome.storage.local.set({ nodex_accent_mode: m }).catch(() => {})
  }, [])
  const handleSetAccentHue = useCallback((h) => {
    setAccentHueState(h)
    chrome.storage.local.set({ nodex_accent_hue: h }).catch(() => {})
  }, [])

  /* ── Engine / tab state (unchanged from v1.1) ── */
  const [firstRunWizard, setFirstRunWizard] = useState(false)
  const [screen, setScreen] = useState('main')
  const [running, setRunning] = useState(false)
  const [browseMode, setBrowseMode] = useState(false)
  const [modeChanging, setModeChanging] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [lastCommand, setLastCommand] = useState(null)
  const [activeTabId, setActiveTabId] = useState(/** @type {number | null} */ (null))
  const activeTabIdRef = useRef(/** @type {number | null} */ (null))
  const [autoPause, setAutoPause] = useState(false)
  const [blinkCalibNeeded, setBlinkCalibNeeded] = useState(false)
  const [launchCount, setLaunchCount] = useState(/** @type {number|null} */ (null))
  const launchCountRef          = useRef(0)
  const launchPrevRunningRef    = useRef(false)
  const launchHasIncrementedRef = useRef(false)
  const [firstLaunchHintDismissed, setFirstLaunchHintDismissed] = useState(false)
  const autoNavFiredRef = useRef(false)

  useEffect(() => {
    activeTabIdRef.current = activeTabId
    activeYouTubeTabIdRef.current = activeTabId
  }, [activeTabId])

  useEffect(() => {
    let cancelled = false
    const refresh = async () => {
      const id = await queryActiveYouTubeTabId()
      if (!cancelled) setActiveTabId(id)
    }
    void refresh()
    const onActivated = () => { void refresh() }
    const onFocusChanged = (windowId) => {
      if (windowId === chrome.windows.WINDOW_ID_NONE) return
      void refresh()
    }
    chrome.tabs.onActivated.addListener(onActivated)
    chrome.windows.onFocusChanged.addListener(onFocusChanged)
    return () => {
      cancelled = true
      chrome.tabs.onActivated.removeListener(onActivated)
      chrome.windows.onFocusChanged.removeListener(onFocusChanged)
    }
  }, [])

  useEffect(() => {
    if (activeTabId == null) {
      setRunning(false); setBrowseMode(false); setModeChanging(false)
      setMetrics(null); setLastCommand(null)
      return
    }
    void requestEngineStatus()
  }, [activeTabId])

  useEffect(() => {
    chrome.storage.local.get(['calibrationCompleted']).then(({ calibrationCompleted }) => {
      if (!calibrationCompleted) setFirstRunWizard(true)
    })
    const onCh = (changes, area) => {
      if (area === 'local' && changes.calibrationCompleted?.newValue) setFirstRunWizard(false)
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  useEffect(() => {
    loadSettings({}).then((settings) => { setAutoPause(Boolean(settings.auto_pause_on_no_face)) })
  }, [])

  useEffect(() => {
    chrome.storage.local.get('nodex_start_count')
      .then(({ nodex_start_count }) => {
        const c = nodex_start_count ?? 0
        launchCountRef.current = c
        setLaunchCount(c)
      })
      .catch(() => setLaunchCount(0))
  }, [])

  useEffect(() => {
    if (running && !launchPrevRunningRef.current) {
      if (!launchHasIncrementedRef.current) {
        launchHasIncrementedRef.current = true
        const next = launchCountRef.current + 1
        launchCountRef.current = next
        setLaunchCount(next)
        chrome.storage.local.set({ nodex_start_count: next }).catch(() => {})
      }
    }
    launchPrevRunningRef.current = running
  }, [running])

  const handleAutoPauseToggle = useCallback((value) => {
    setAutoPause(value)
    sendToContent({ type: MSG.SET_AUTO_PAUSE, enabled: value })
  }, [])

  const handleGoCalibrate = useCallback(() => {
    setBlinkCalibNeeded(false)
    setScreen('calibration')
  }, [])

  useEffect(() => {
    const listener = (message) => {
      if (!message || typeof message.type !== 'string') return
      if (shouldIgnoreSidePanelMessage(message)) return
      switch (message.type) {
        case MSG.ENGINE_STATUS:
          setRunning(message.running)
          if (!message.running) setBrowseMode(false)
          break
        case MSG.METRICS_UPDATE:
          setMetrics(message.metrics)
          break
        case MSG.COMMAND_EXECUTED:
          setLastCommand({ command: message.command, gesture: message.gesture })
          if (message.browseMode !== undefined) setBrowseMode(message.browseMode)
          break
        case MSG.BROWSE_MODE_CHANGED:
          setBrowseMode(message.browseMode)
          setModeChanging(false)
          break
        case MSG.BLINK_CALIB_NEEDED:
          setBlinkCalibNeeded(true)
          break
        default:
          break
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  useEffect(() => {
    const onCh = (changes, area) => {
      if (area !== 'local') return
      if (changes.earCalibration?.newValue != null) setBlinkCalibNeeded(false)
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  const isFirstLaunch = launchCount != null && launchCount <= 1

  /* ── Render ── */
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)' }}>
      {firstRunWizard && (
        <CalibrationWizard
          mode="full"
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          onClose={() => setFirstRunWizard(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '17px 20px 14px' }}>
        <NodexLogo size={22}/>
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text)' }}>Nodex</span>
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', marginLeft: 1 }}>v1.1</span>
      </div>

      {/* ── Nav (underline tabs) ── */}
      <div style={{ display: 'flex', gap: 20, padding: '0 20px', borderBottom: '1px solid var(--border)' }}>
        {[
          ['main',        'Home'],
          ['calibration', 'Calibrate'],
          ['settings',    'Settings'],
        ].map(([s, l]) => (
          <button
            key={s}
            onClick={() => {
              if (s === 'calibration') setBlinkCalibNeeded(false)
              setScreen(s)
            }}
            style={{
              padding: '10px 0 12px', position: 'relative',
              color: screen === s ? 'var(--text)' : 'var(--text-2)',
              fontSize: 13, fontWeight: 500,
              transition: 'color 150ms',
            }}
          >
            {l}
            <span style={{
              position: 'absolute', left: 0, right: 0, bottom: -1, height: 1.5,
              background: screen === s ? 'var(--accent)' : 'transparent',
              borderRadius: 2,
              transition: 'background 150ms',
            }}/>
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {screen === 'main' && activeTabId === null && <NoTabState />}
        {screen === 'main' && activeTabId !== null && (
          <MainScreen
            running={running}
            browseMode={browseMode}
            modeChanging={modeChanging}
            onModeToggle={() => {
              if (modeChanging) return
              setModeChanging(true)
              sendToContent({ type: MSG.TOGGLE_BROWSE_MODE })
              setTimeout(() => setModeChanging(false), 2000)
            }}
            metrics={metrics}
            lastCommand={lastCommand}
            blinkCalibNeeded={blinkCalibNeeded}
            onDismissBlinkAlert={() => setBlinkCalibNeeded(false)}
            onGoCalibrate={handleGoCalibrate}
            isFirstLaunch={isFirstLaunch}
            firstLaunchHintDismissed={firstLaunchHintDismissed}
            onDismissFirstLaunchHint={() => setFirstLaunchHintDismissed(true)}
            autoNavFiredRef={autoNavFiredRef}
          />
        )}
        {screen === 'calibration' && (
          <CalibrationScreen running={running} sendToContent={sendToContent} />
        )}
        {screen === 'settings' && (
          <SettingsScreen
            autoPause={autoPause}
            onAutoPauseToggle={handleAutoPauseToggle}
            theme={theme}
            setTheme={handleSetTheme}
            accentMode={accentMode}
            setAccentMode={handleSetAccentMode}
            accentHue={accentHue}
            setAccentHue={handleSetAccentHue}
            effectiveTheme={effectiveTheme}
          />
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   NO TAB STATE
────────────────────────────────────────────────────── */

function NoTabState() {
  return (
    <div className="fade-in" style={{
      padding: '40px 20px 32px',
      display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 10,
        background: 'var(--surface)', border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: 'var(--text-2)',
        marginBottom: 18,
      }}>
        <IconPlayer size={20} sw={1.5}/>
      </div>
      <div style={{ fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 6 }}>
        Open a video to begin
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 28, lineHeight: 1.55, maxWidth: 240 }}>
        Nodex runs on YouTube tabs. Navigate to a video, then return here to start tracking.
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, overflow: 'hidden', width: '100%',
      }}>
        {[
          ['01', 'Open youtube.com in any tab'],
          ['02', 'Click Start here in Nodex'],
          ['03', 'Nod your head to control playback'],
        ].map(([num, text], i, arr) => (
          <div key={num} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            padding: '11px 14px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: 'var(--accent)', fontWeight: 700, flexShrink: 0, opacity: 0.8,
            }}>{num}</span>
            <span style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.4 }}>{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   MAIN SCREEN
────────────────────────────────────────────────────── */

function MainScreen({
  running, browseMode, modeChanging, onModeToggle,
  metrics, lastCommand,
  blinkCalibNeeded, onDismissBlinkAlert, onGoCalibrate,
  isFirstLaunch, firstLaunchHintDismissed, onDismissFirstLaunchHint,
  autoNavFiredRef,
}) {
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState(/** @type {string|null} */ (null))
  const startTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))

  const [modelReady, setModelReady] = useState(false)
  const modelReadyTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))

  useEffect(() => {
    if (running) {
      setModelReady(false)
      modelReadyTimerRef.current = setTimeout(() => setModelReady(true), 5000)
    } else {
      clearTimeout(modelReadyTimerRef.current)
      modelReadyTimerRef.current = null
      setModelReady(false)
    }
    return () => { clearTimeout(modelReadyTimerRef.current); modelReadyTimerRef.current = null }
  }, [running])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (metrics != null && running && !modelReady) {
      clearTimeout(modelReadyTimerRef.current)
      modelReadyTimerRef.current = null
      setModelReady(true)
    }
  }, [metrics, running])

  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [calibratedEar, setCalibratedEar] = useState(/** @type {number|null} */ (null))
  const [hasAnyEarCalibration, setHasAnyEarCalibration] = useState(true)

  useEffect(() => {
    Promise.all([
      loadSettings({ thresholds: DEFAULT_THRESHOLDS }),
      chrome.storage.local.get('earCalibration'),
    ]).then(([s, { earCalibration }]) => {
      setThresholds({ ...DEFAULT_THRESHOLDS, ...(s.thresholds ?? {}) })
      const th = earCalibration?.threshold
      setCalibratedEar(typeof th === 'number' && Number.isFinite(th) ? th : null)
      setHasAnyEarCalibration(earCalibration != null)
    })
    const onChanged = (changes, area) => {
      if (area !== 'local') return
      if (changes.nodex_settings) {
        const next = changes.nodex_settings.newValue
        if (next?.thresholds) setThresholds({ ...DEFAULT_THRESHOLDS, ...next.thresholds })
      }
      if (changes.earCalibration) {
        const cal = changes.earCalibration.newValue
        const th = cal?.threshold
        setCalibratedEar(typeof th === 'number' && Number.isFinite(th) ? th : null)
        setHasAnyEarCalibration(cal != null)
      }
    }
    chrome.storage.onChanged.addListener(onChanged)
    return () => chrome.storage.onChanged.removeListener(onChanged)
  }, [])

  const clearStartTimer = useCallback(() => {
    if (startTimerRef.current) { clearTimeout(startTimerRef.current); startTimerRef.current = null }
  }, [])

  useEffect(() => {
    if (running) { clearStartTimer(); setIsStarting(false); setStartError(null) }
  }, [running, clearStartTimer])

  useEffect(() => () => clearStartTimer(), [clearStartTimer])

  const handleToggle = () => {
    if (running) {
      clearStartTimer(); setIsStarting(false); setStartError(null)
      sendToContent({ type: MSG.STOP_ENGINE })
    } else {
      setStartError(null); setIsStarting(true)
      sendToContent({ type: MSG.START_ENGINE })
      startTimerRef.current = setTimeout(() => {
        setIsStarting(false)
        setStartError('Camera did not start. Make sure a webcam is connected and that Chrome has camera permission for this site.')
        startTimerRef.current = null
      }, 9000)
    }
  }

  const onGoCalibrateRef = useRef(onGoCalibrate)
  onGoCalibrateRef.current = onGoCalibrate
  useEffect(() => {
    if (
      running && isFirstLaunch && blinkCalibNeeded &&
      !hasAnyEarCalibration && !firstLaunchHintDismissed && !autoNavFiredRef.current
    ) {
      autoNavFiredRef.current = true
      const t = setTimeout(() => onGoCalibrateRef.current(), 800)
      return () => clearTimeout(t)
    }
  }, [running, isFirstLaunch, blinkCalibNeeded, hasAnyEarCalibration, firstLaunchHintDismissed])

  const cmdLabels = browseMode ? BROWSE_COMMAND_LABELS : COMMAND_LABELS
  const isLoading = isStarting || (running && !modelReady)

  return (
    <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── Blink calibration alert ── */}
      {blinkCalibNeeded && (
        hasAnyEarCalibration ? (
          <div className="fade-in" style={{
            background: 'var(--surface)', border: '1px solid var(--border-mid)',
            borderRadius: 12, padding: '12px 14px',
            display: 'flex', alignItems: 'flex-start', gap: 10,
          }}>
            <IconInfo size={14} sw={2} style={{ flexShrink: 0, marginTop: 2, color: 'var(--amber)' }}/>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', marginBottom: 3 }}>
                Blink calibration expired
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5, marginBottom: 8 }}>
                Recalibrate for accurate eye-close detection.
              </div>
              <button onClick={onGoCalibrate} style={{
                fontSize: 11.5, fontWeight: 600,
                background: 'var(--surface-3)', color: 'var(--text)',
                border: '1px solid var(--border-mid)', borderRadius: 6,
                padding: '5px 12px',
              }}>Recalibrate →</button>
            </div>
            <button onClick={onDismissBlinkAlert} aria-label="Dismiss" style={{
              color: 'var(--text-3)', fontSize: 18, lineHeight: 1, flexShrink: 0,
            }}>×</button>
          </div>
        ) : (
          <div className="fade-in" style={{
            background: 'var(--accent-dim)',
            border: '1px solid rgba(var(--accent-rgb),0.2)',
            borderRadius: 12, padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <IconEye size={14} sw={2} style={{ color: 'var(--accent)' }}/>
              <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                Eye blink not configured
              </span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 12 }}>
              30-second calibration makes blink detection reliable for your eyes.
            </div>
            <button onClick={onGoCalibrate} style={{
              width: '100%', fontSize: 12.5, fontWeight: 600,
              background: 'var(--accent)', color: 'var(--accent-ink)',
              border: 'none', borderRadius: 8, padding: '9px 0',
            }}>Set up eye blink — 30 sec</button>
            <button onClick={onDismissBlinkAlert} style={{
              display: 'block', margin: '8px auto 0',
              fontFamily: 'var(--font-mono)', fontSize: 10.5,
              color: 'var(--text-3)', letterSpacing: '0.03em',
            }}>skip for now</button>
          </div>
        )
      )}

      {/* ── Tracking chip + start/stop ── */}
      <div>
        <TrackingChip running={running && modelReady} browseMode={browseMode} isLoading={isLoading}/>
      </div>

      {/* ── Face visualizer ── */}
      <FaceViz metrics={metrics ?? { yaw: 0, pitch: 0, roll: 0 }} running={running && modelReady}/>

      {/* ── Camera error ── */}
      {startError && (
        <div style={{
          background: 'var(--red-dim)', border: '1px solid rgba(var(--red),0.2)',
          borderRadius: 10, padding: '10px 13px',
          display: 'flex', gap: 9, alignItems: 'flex-start',
        }}>
          <IconInfo size={13} sw={2} style={{ flexShrink: 0, marginTop: 1, color: 'var(--red)' }}/>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--red)', marginBottom: 3 }}>Camera error</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>{startError}</div>
          </div>
        </div>
      )}

      {/* ── Start / Stop buttons ── */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button
          onClick={handleToggle}
          disabled={isStarting}
          style={{
            flex: 1, height: 40, borderRadius: 10,
            background: running ? 'var(--surface-3)' : 'var(--accent)',
            color: running ? 'var(--text-2)' : 'var(--accent-ink)',
            border: running ? '1px solid var(--border-mid)' : 'none',
            fontSize: 13.5, fontWeight: 600,
            opacity: isLoading ? 0.55 : 1,
            transition: 'all 150ms var(--ease-out)',
          }}
        >
          {running ? (modelReady ? 'Stop' : 'Loading…') : isStarting ? 'Starting…' : 'Start'}
        </button>

        {running && (
          <button
            onClick={onModeToggle}
            disabled={modeChanging}
            style={{
              height: 40, padding: '0 14px', borderRadius: 10,
              background: browseMode ? 'var(--accent-dim)' : 'var(--surface-2)',
              color: browseMode ? 'var(--accent)' : 'var(--text-2)',
              border: '1px solid ' + (browseMode ? 'rgba(var(--accent-rgb),0.22)' : 'var(--border)'),
              fontSize: 12.5, fontWeight: 500,
              opacity: modeChanging ? 0.45 : 1,
              transition: 'all 150ms var(--ease-out)',
            }}
          >
            {browseMode ? 'Player' : 'Browse'}
          </button>
        )}
      </div>

      {/* ── First-launch hint (when no calibration yet) ── */}
      {!running && !isStarting && !startError &&
        isFirstLaunch && !hasAnyEarCalibration && !firstLaunchHintDismissed && !blinkCalibNeeded && (
        <FirstLaunchHint onCalibrate={onGoCalibrate} onSkip={onDismissFirstLaunchHint}/>
      )}

      {/* ── Idle: default gesture reference ── */}
      {!running && !isStarting && !lastCommand && !startError && (
        <div style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <div style={{
            padding: '9px 14px', borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 600, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', textTransform: 'uppercase',
          }}>Default gestures</div>
          {[
            ['Head left / right', '← Rewind / Skip →'],
            ['Head up / down',    '↑↓ Volume'],
            ['Tilt left / right', 'Prev / Next'],
            ['Eyes closed',       'Play / Pause'],
          ].map(([gesture, cmd], i, arr) => (
            <div key={gesture} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '9px 14px',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>{gesture}</span>
              <span style={{ fontSize: 11.5, color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{cmd}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Last command flash ── */}
      {lastCommand && (
        <div key={`${lastCommand.command}-${lastCommand.gesture}`} className="cmd-flash" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '13px 14px',
          background: 'var(--surface)', border: '1px solid var(--border-mid)',
          borderRadius: 12,
        }}>
          <div>
            <div style={{
              fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
              letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 4,
            }}>Last gesture</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--accent)' }}>
              {cmdLabels[lastCommand.command] ?? COMMAND_LABELS[lastCommand.command] ?? lastCommand.command}
            </div>
          </div>
          <span style={{
            fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 5, padding: '3px 8px', letterSpacing: '0.03em',
          }}>
            {GESTURE_LABELS[lastCommand.gesture] ?? lastCommand.gesture}
          </span>
        </div>
      )}

      {/* ── Live metrics ── */}
      {metrics && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <MetricRow label="Yaw"   value={metrics.yaw}   max={60}   threshold={thresholds.yaw}                         type="centered" unit="°"/>
          <MetricRow label="Pitch" value={metrics.pitch} max={45}   threshold={thresholds.pitch}                       type="centered" unit="°"/>
          <MetricRow label="Roll"  value={metrics.roll}  max={45}   threshold={thresholds.roll}                        type="centered" unit="°"/>
          <MetricRow label="EAR"   value={metrics.ear}   max={0.40} threshold={calibratedEar ?? thresholds.earClose}  type="fill"     unit=""  triggerBelow/>
          <MetricRow label="Mouth" value={metrics.mouth} max={1.0}  threshold={thresholds.mouthOpen}                  type="fill"     unit=""/>
        </div>
      )}
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   FIRST-LAUNCH HINT
────────────────────────────────────────────────────── */

function FirstLaunchHint({ onCalibrate, onSkip }) {
  return (
    <div className="fade-in" style={{
      background: 'var(--accent-dim)',
      border: '1px solid rgba(var(--accent-rgb),0.18)',
      borderRadius: 12, padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <IconEye size={14} sw={2} style={{ color: 'var(--accent)' }}/>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--accent)' }}>
          Set up blink detection first
        </span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.6, margin: '0 0 12px' }}>
        30-second calibration makes eye-close detection reliable for your eyes.
      </p>
      <button onClick={onCalibrate} style={{
        width: '100%', fontSize: 12.5, fontWeight: 600,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        border: 'none', borderRadius: 8, padding: '9px 0', marginBottom: 8,
      }}>Calibrate now — 30 sec</button>
      <button onClick={onSkip} style={{
        display: 'block', width: '100%',
        fontFamily: 'var(--font-mono)', fontSize: 10.5,
        color: 'var(--text-3)', letterSpacing: '0.03em', padding: '2px 0',
        textAlign: 'center',
      }}>Skip for now</button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   CALIBRATION SCREEN
────────────────────────────────────────────────────── */

function CalibrationScreen({ running, sendToContent }) {
  const [wizardMode, setWizardMode] = useState(/** @type {null | 'full' | 'neutral_only' | 'blink_only'} */ (null))
  const [summary, setSummary] = useState({
    cal: null,
    ear: null,
    at: null,
  })

  const refreshSummary = useCallback(() => {
    void Promise.all([
      loadCalibration(),
      chrome.storage.local.get(['earCalibration', 'calibrationCompletedAt']),
    ]).then(([cal, { earCalibration, calibrationCompletedAt }]) => {
      const at =
        typeof calibrationCompletedAt === 'number' && Number.isFinite(calibrationCompletedAt)
          ? calibrationCompletedAt
          : typeof earCalibration?.calibratedAt === 'number'
            ? earCalibration.calibratedAt
            : null
      setSummary({
        cal: cal && typeof cal === 'object' ? cal : null,
        ear: earCalibration && typeof earCalibration === 'object' ? earCalibration : null,
        at,
      })
    })
  }, [])

  useEffect(() => {
    refreshSummary()
    const onCh = (changes, area) => {
      if (area !== 'local') return
      if (changes.nodex_calibration || changes.earCalibration || changes.calibrationCompletedAt) {
        refreshSummary()
      }
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [refreshSummary])

  const dateStr =
    summary.at != null
      ? new Date(summary.at).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
      : '—'
  const yawStr =
    summary.cal?.yaw != null && Number.isFinite(summary.cal.yaw)
      ? `${summary.cal.yaw.toFixed(1)}°` : '—'
  const pitchStr =
    summary.cal?.pitch != null && Number.isFinite(summary.cal.pitch)
      ? `${summary.cal.pitch.toFixed(1)}°` : '—'
  const thStr =
    summary.ear?.threshold != null && Number.isFinite(summary.ear.threshold)
      ? summary.ear.threshold.toFixed(2) : '—'

  return (
    <div style={{ padding: '20px 20px 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {wizardMode && (
        <CalibrationWizard
          mode={wizardMode}
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          onClose={() => { setWizardMode(null); refreshSummary() }}
        />
      )}

      {/* ── Calibration data card ── */}
      <SectionCard title="Calibration data">
        {/* Metric tiles */}
        <div style={{ padding: '12px 14px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
          {[['YAW', yawStr], ['PITCH', pitchStr], ['EAR', thStr]].map(([label, val]) => (
            <div key={label} style={{
              background: 'var(--bg)', border: '1px solid var(--border)',
              borderRadius: 8, padding: '8px 10px',
            }}>
              <div style={{
                fontSize: 10, color: 'var(--text-3)',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.07em', marginBottom: 3,
              }}>{label}</div>
              <div style={{
                fontSize: 12, fontWeight: 600, color: 'var(--accent)',
                fontFamily: 'var(--font-mono)',
              }}>{val}</div>
            </div>
          ))}
        </div>

        {/* Timestamp */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '0 14px 12px',
        }}>
          <IconClock size={11} sw={2} style={{ color: 'var(--text-3)' }}/>
          <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-3)' }}>
            {dateStr}
          </span>
        </div>

        {/* Warning when engine is stopped */}
        {!running && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            margin: '0 14px 12px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '9px 11px',
          }}>
            <IconInfo size={13} sw={2} style={{ flexShrink: 0, marginTop: 1, color: 'var(--amber)' }}/>
            <span style={{ fontSize: 11.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
              Start the camera from Home — calibration needs a live face feed.
            </span>
          </div>
        )}

        {/* Calibration buttons */}
        <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <button
            style={{
              width: '100%', height: 38, borderRadius: 9,
              background: 'var(--accent)', color: 'var(--accent-ink)',
              fontSize: 13, fontWeight: 600,
              opacity: running ? 1 : 0.35,
              transition: 'opacity 150ms',
            }}
            disabled={!running} onClick={() => setWizardMode('neutral_only')}
          >Neutral pose</button>
          <button
            style={{
              width: '100%', height: 38, borderRadius: 9,
              background: 'var(--surface-3)', color: 'var(--text-2)',
              border: '1px solid var(--border-mid)', fontSize: 13, fontWeight: 500,
              opacity: running ? 1 : 0.35,
              transition: 'opacity 150ms',
            }}
            disabled={!running} onClick={() => setWizardMode('blink_only')}
          >Blink detection</button>
          <button
            style={{
              width: '100%', height: 38, borderRadius: 9,
              background: 'transparent', color: 'var(--text-3)',
              border: '1px solid var(--border)', fontSize: 13, fontWeight: 500,
              opacity: running ? 1 : 0.35,
              transition: 'opacity 150ms',
            }}
            disabled={!running} onClick={() => setWizardMode('full')}
          >Full recalibration</button>
        </div>
      </SectionCard>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   SETTINGS SCREEN
────────────────────────────────────────────────────── */

function SettingsScreen({
  autoPause, onAutoPauseToggle,
  theme, setTheme, accentMode, setAccentMode, accentHue, setAccentHue, effectiveTheme,
}) {
  const [editingMode, setEditingMode] = useState('player')
  const [playerMap, setPlayerMap] = useState({ ...PLAYER_GESTURE_MAP })
  const [browseMap, setBrowseMap] = useState({ ...BROWSE_GESTURE_MAP })
  const [preset, setPreset] = useState('medium')
  const [saved, setSaved] = useState(false)
  const [refineLandmarks, setRefineLandmarks] = useState(false)
  const [clearConfirm, setClearConfirm] = useState(false)
  const clearConfirmTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))

  useEffect(() => {
    ;(async () => {
      const pm = await loadPlayerGestureMap(PLAYER_GESTURE_MAP)
      const bm = await loadBrowseGestureMap(BROWSE_GESTURE_MAP)
      setPlayerMap(pm); setBrowseMap(bm)
      const settings = await loadSettings({ thresholds: DEFAULT_THRESHOLDS })
      const th = { ...DEFAULT_THRESHOLDS, ...(settings.thresholds ?? {}) }
      for (const [key, val] of Object.entries(SENSITIVITY_PRESETS)) {
        if (
          val.yaw === th.yaw && val.pitch === th.pitch &&
          (val.hysteresisYaw ?? 7) === (th.hysteresisYaw ?? 7) &&
          (val.hysteresisPitch ?? 7) === (th.hysteresisPitch ?? 7)
        ) { setPreset(key); break }
      }
      const { nodex_refine_landmarks } = await chrome.storage.local.get('nodex_refine_landmarks')
      setRefineLandmarks(nodex_refine_landmarks === true)
    })()
  }, [])

  const currentMap = editingMode === 'player' ? playerMap : browseMap
  const setCurrentMap = editingMode === 'player' ? setPlayerMap : setBrowseMap

  const handleGestureChange = (gesture, command) => {
    setCurrentMap(prev => ({ ...prev, [gesture]: command }))
    setSaved(false)
  }

  const handleSave = async () => {
    const thresholds = SENSITIVITY_PRESETS[preset] ?? DEFAULT_THRESHOLDS
    await savePlayerGestureMap(playerMap)
    await saveBrowseGestureMap(browseMap)
    await saveSettings({ thresholds })
    await sendToContent({
      type: MSG.UPDATE_SETTINGS,
      settings: { thresholds, playerGestureMap: playerMap, browseGestureMap: browseMap },
    })
    setSaved(true)
  }

  const handleRefineLandmarksToggle = async (value) => {
    setRefineLandmarks(value)
    await chrome.storage.local.set({ nodex_refine_landmarks: value }).catch(() => {})
  }

  const handleClearData = async () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      if (clearConfirmTimerRef.current) clearTimeout(clearConfirmTimerRef.current)
      clearConfirmTimerRef.current = setTimeout(() => {
        clearConfirmTimerRef.current = null
        setClearConfirm(false)
      }, 4000)
      return
    }
    if (clearConfirmTimerRef.current) { clearTimeout(clearConfirmTimerRef.current); clearConfirmTimerRef.current = null }
    await chrome.storage.local.clear().catch(() => {})
    window.location.reload()
  }

  useEffect(() => () => {
    if (clearConfirmTimerRef.current) clearTimeout(clearConfirmTimerRef.current)
  }, [])

  const mappableGestures = Object.values(GESTURES).filter(g => g !== GESTURES.NONE)
  const isBrowse = editingMode === 'browse'
  const commandOptions = isBrowse ? BROWSE_COMMANDS : Object.values(COMMANDS)
  const labels = isBrowse ? BROWSE_COMMAND_LABELS : COMMAND_LABELS

  return (
    <div style={{ padding: '18px 20px 28px', display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Interface ── */}
      <SectionCard title="Interface" desc="Appearance and accent color">
        <SettingsRow title="Theme" desc="Light, dark, or follow system" first>
          <div style={{ width: 178 }}>
            <ThemePicker theme={theme} setTheme={setTheme}/>
          </div>
        </SettingsRow>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Accent</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>
              Focus ring, active states, and live indicators
            </div>
          </div>
          <AccentPicker
            mode={accentMode} hue={accentHue}
            setMode={setAccentMode} setHue={setAccentHue}
            effectiveTheme={effectiveTheme}
          />
        </div>
      </SectionCard>

      {/* ── Gesture mapping ── */}
      <SectionCard title="Gesture Mapping" desc="Assign an action to each gesture">
        {/* Player / Browse sub-tabs */}
        <div style={{
          display: 'flex', gap: 3, padding: 3,
          margin: '10px 14px 0',
          background: 'var(--surface-2)', borderRadius: 8,
        }}>
          {['player', 'browse'].map(m => (
            <button key={m} onClick={() => setEditingMode(m)} style={{
              flex: 1, padding: '6px 10px', borderRadius: 5,
              background: editingMode === m ? 'var(--surface)' : 'transparent',
              color: editingMode === m ? 'var(--text)' : 'var(--text-2)',
              boxShadow: editingMode === m ? 'var(--shadow-soft)' : 'none',
              fontSize: 12, fontWeight: 500,
              textTransform: 'capitalize',
              transition: 'all 160ms var(--ease-out)',
            }}>{m}</button>
          ))}
        </div>

        <div style={{ marginTop: 8 }} key={editingMode}>
          {mappableGestures.map((g, i) => (
            <BindingRow
              key={g}
              first={i === 0}
              gesture={GESTURE_LABELS[g] ?? g}
              icon={GESTURE_ICONS[g]}
              value={currentMap[g] ?? COMMANDS.NONE}
              options={commandOptions}
              labels={labels}
              onChange={cmd => handleGestureChange(g, cmd)}
            />
          ))}
        </div>
      </SectionCard>

      {/* ── Sensitivity ── */}
      <SectionCard title="Sensitivity" desc="How easily gestures are triggered">
        <SettingsRow title="Detection sensitivity" desc="Affects all gestures globally" first>
          <select
            value={preset}
            onChange={e => { setPreset(e.target.value); setSaved(false) }}
            style={{
              fontSize: 12, fontFamily: 'var(--font-ui)',
              background: 'var(--surface-2)', color: 'var(--text)',
              border: '1px solid var(--border)', borderRadius: 6,
              padding: '5px 8px', outline: 'none', width: 140,
            }}
          >
            <option value="low">Low — large movements</option>
            <option value="medium">Medium (default)</option>
            <option value="high">High — small movements</option>
          </select>
        </SettingsRow>
      </SectionCard>

      {/* ── Smart features ── */}
      <SectionCard title="Smart Features" desc="Advanced behavior">
        <SettingsRow
          title="Auto-pause when you leave"
          desc="Pauses video if no face detected for 2 seconds"
          first
        >
          <Toggle on={autoPause} onChange={onAutoPauseToggle}/>
        </SettingsRow>
        <SettingsRow
          title="High-precision landmarks"
          desc="478-point mesh. Applies after reloading YouTube tab."
        >
          <Toggle on={refineLandmarks} onChange={handleRefineLandmarksToggle}/>
        </SettingsRow>
      </SectionCard>

      {/* ── Data ── */}
      <SectionCard title="Data" desc="Your information stays on this device">
        <div style={{ padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconShield size={13} sw={1.8} style={{ color: 'var(--text-3)', flexShrink: 0 }}/>
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', flex: 1 }}>
            All data stored locally — nothing sent to any server.
          </span>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <button
            onClick={handleClearData}
            style={{
              width: '100%', height: 34, borderRadius: 8,
              background: clearConfirm ? 'var(--red-dim)' : 'transparent',
              color: 'var(--red)',
              border: '1px solid ' + (clearConfirm ? 'rgba(208,72,72,0.3)' : 'rgba(208,72,72,0.22)'),
              fontSize: 12, fontWeight: 500,
              transition: 'all 160ms',
            }}
          >
            {clearConfirm ? '⚠ Tap again to confirm — cannot be undone' : 'Clear all Nodex data'}
          </button>
        </div>
      </SectionCard>

      {/* ── Save button ── */}
      <button
        onClick={handleSave}
        style={{
          width: '100%', height: 40, borderRadius: 10,
          background: saved ? 'transparent' : 'var(--accent)',
          color: saved ? 'var(--accent)' : 'var(--accent-ink)',
          border: saved ? '1px solid rgba(var(--accent-rgb),0.3)' : 'none',
          fontSize: 13.5, fontWeight: 600,
          transition: 'all 200ms var(--ease-out)',
          marginTop: 4,
        }}
      >
        {saved ? '✓ Saved' : 'Save settings'}
      </button>
    </div>
  )
}
