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
import MetricBar from './MetricBar.jsx'

/* ── helpers ── */

/**
 * Active YouTube tab in the current window — synced from App via useEffect (same role as useRef).
 * Module-level sendToContent and filters read `.current` so onMessage never uses a stale tab id.
 * @type {{ current: number | null }}
 */
const activeYouTubeTabIdRef = { current: null }

/**
 * Ignore relayed content messages when they come from a tab other than the one the user is viewing.
 * Legacy messages without __sourceTabId are always applied.
 * @param {unknown} message
 */
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

/** Ask a specific tab's content script for ENGINE_STATUS (via service worker). */
async function requestEngineStatus() {
  const tabId = activeYouTubeTabIdRef.current
  if (tabId == null) return
  try {
    await chrome.runtime.sendMessage({
      type: MSG.REQUEST_STATUS,
      tabId,
    })
  } catch {
    /* ignore */
  }
}

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

/* ── styles ── */

const S = {
  app: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100vh',
    background: 'var(--bg)',
  },

  // ── Header bar ──
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 16px 0',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  logoMark: {
    width: '22px',
    height: '22px',
    borderRadius: '6px',
    background: 'var(--accent)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '14px',
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '0.06em',
  },
  versionBadge: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    color: 'var(--muted)',
    background: 'var(--surface-2)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '2px 6px',
    letterSpacing: '0.02em',
  },

  // ── Nav tabs ──
  navWrap: {
    padding: '12px 16px 0',
  },
  nav: {
    display: 'flex',
    gap: '2px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '3px',
  },
  navBtn: {
    flex: 1,
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 500,
    padding: '7px 0',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.18s',
    letterSpacing: '0.01em',
  },
  navBtnActive: {
    background: 'var(--surface-3)',
    color: 'var(--text)',
    fontWeight: 600,
    boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
  },

  // ── Content area ──
  content: {
    padding: '12px 16px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    flex: 1,
  },

  // ── Cards ──
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
  },
  cardFlush: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    overflow: 'hidden',
  },

  // ── Section labels ──
  sectionLabel: {
    fontFamily: 'var(--font-mono)',
    fontSize: '10px',
    fontWeight: 600,
    color: 'var(--muted)',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
    marginBottom: '10px',
  },

  // ── Buttons ──
  btn: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 0',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s, background 0.15s',
    letterSpacing: '0.01em',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#060f0c',
  },
  btnStop: {
    background: 'var(--surface-3)',
    color: 'var(--text-2)',
    border: '1px solid var(--border-mid)',
  },
  btnSecondary: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
  },
  btnGhost: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '9px 14px',
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
    letterSpacing: '0.01em',
  },

  // ── Status dot ──
  dot: (isActive, isLoading = false) => ({
    display: 'inline-block',
    width: '7px',
    height: '7px',
    borderRadius: '50%',
    flexShrink: 0,
    background: isActive ? 'var(--green)' : isLoading ? 'var(--amber)' : 'var(--muted)',
    animation: isActive ? 'pulse-dot 2.4s ease-in-out infinite' : 'none',
  }),

  // ── Metric tiles ──
  metricLabel: { color: 'var(--muted)', fontSize: '10px', fontFamily: 'var(--font-mono)', letterSpacing: '0.04em' },
  metricValue: {
    color: 'var(--accent)',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  metricTile: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '8px 10px',
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },

  // ── Select ──
  select: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    padding: '6px 8px',
    width: '100%',
    outline: 'none',
    transition: 'border-color 0.15s',
  },

  // ── Gesture table ──
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '8px 0',
    borderBottom: '1px solid var(--border)',
  },
  gestureLabel: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    flex: '1 1 auto',
    whiteSpace: 'nowrap',
    color: 'var(--text-2)',
  },
  gestureSelect: { flex: '0 0 128px' },

  // ── Divider ──
  divider: {
    height: '1px',
    background: 'var(--border)',
    margin: '12px 0',
  },

  // ── Progress ──
  progressBar: {
    width: '100%', height: '3px',
    background: 'var(--border)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '10px',
  },
  progressFill: (pct) => ({
    width: `${pct}%`, height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.2s',
    borderRadius: '2px',
  }),
}

/* ── App ── */

export default function App() {
  const [firstRunWizard, setFirstRunWizard] = useState(false)
  const [screen, setScreen] = useState('main')
  const [running, setRunning] = useState(false)
  const [browseMode, setBrowseMode] = useState(false)
  const [modeChanging, setModeChanging] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [lastCommand, setLastCommand] = useState(null)

  const [activeTabId, setActiveTabId] = useState(/** @type {number | null} */ (null))
  /** Keeps `activeYouTubeTabIdRef` in sync for filters/sendToContent (avoids stale closure in onMessage). */
  const activeTabIdRef = useRef(/** @type {number | null} */ (null))

  const [autoPause, setAutoPause] = useState(false)
  const [blinkCalibNeeded, setBlinkCalibNeeded] = useState(false)

  // Total number of times the user has started the engine (persisted across sessions).
  // Used to detect first-launch and show the calibration nudge.
  const [launchCount, setLaunchCount] = useState(/** @type {number|null} */ (null))
  const launchCountRef          = useRef(0)
  const launchPrevRunningRef    = useRef(false)
  const launchHasIncrementedRef = useRef(false)

  // Lifted to App so they survive MainScreen unmount/remount (screen tab changes).
  // firstLaunchHintDismissed: user explicitly chose "Start without calibrating".
  // autoNavFiredRef: prevents the auto-navigate from re-triggering after it fires once.
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

    const onActivated = () => {
      void refresh()
    }
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
      setRunning(false)
      setBrowseMode(false)
      setModeChanging(false)
      setMetrics(null)
      setLastCommand(null)
      return
    }
    void requestEngineStatus()
  }, [activeTabId])

  useEffect(() => {
    chrome.storage.local.get(['calibrationCompleted']).then(({ calibrationCompleted }) => {
      if (!calibrationCompleted) setFirstRunWizard(true)
    })
    const onCh = (changes, area) => {
      if (area === 'local' && changes.calibrationCompleted?.newValue) {
        setFirstRunWizard(false)
      }
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  useEffect(() => {
    loadSettings({}).then((settings) => {
      setAutoPause(Boolean(settings.auto_pause_on_no_face))
    })
  }, [])

  // Load engine-start count from storage (0 for brand-new installs).
  useEffect(() => {
    chrome.storage.local.get('nodex_start_count')
      .then(({ nodex_start_count }) => {
        const c = nodex_start_count ?? 0
        launchCountRef.current = c
        setLaunchCount(c)
      })
      .catch(() => setLaunchCount(0))
  }, [])

  // Increment the counter once per side-panel session when the engine starts.
  // A ref guard prevents inflate from start→stop→start within one session.
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

  const handleAutoPauseToggle = useCallback((e) => {
    const enabled = e.target.checked
    setAutoPause(enabled)
    sendToContent({ type: MSG.SET_AUTO_PAUSE, enabled })
  }, [])

  // Stable callback so MainScreen's auto-navigate effect doesn't re-fire on every render.
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

  // Auto-clear blink alert when a fresh calibration is saved to storage.
  // Covers the case where the user navigates to Calibrate manually (without
  // clicking the alert button), completes calibration, then returns to Home —
  // without this, the stale blinkCalibNeeded=true would show a confusing
  // "Re-calibrate" banner immediately after a successful calibration.
  useEffect(() => {
    const onCh = (changes, area) => {
      if (area !== 'local') return
      if (changes.earCalibration?.newValue != null) {
        setBlinkCalibNeeded(false)
      }
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  // First launch: user has started the engine ≤1 time ever.
  // launchCount=0 before the first start; =1 right after; >1 for returning users.
  const isFirstLaunch = launchCount != null && launchCount <= 1

  return (
    <div style={S.app}>
      {firstRunWizard && (
        <CalibrationWizard
          mode="full"
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          onClose={() => setFirstRunWizard(false)}
        />
      )}

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.logo}>
          <div style={S.logoMark}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5z" fill="#060f0c" strokeWidth="0"/>
              <path d="M2 17l10 5 10-5" stroke="#060f0c" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M2 12l10 5 10-5" stroke="#060f0c" strokeWidth="2.5" strokeLinecap="round"/>
            </svg>
          </div>
          <span style={S.logoText}>NODEX</span>
        </div>
        <span style={S.versionBadge}>v1.1</span>
      </div>

      {/* ── Nav ── */}
      <div style={S.navWrap}>
        <div style={S.nav}>
          {['main', 'calibration', 'settings'].map((s) => (
            <button
              key={s}
              style={{ ...S.navBtn, ...(screen === s ? S.navBtnActive : {}) }}
              onClick={() => {
                if (s === 'calibration') setBlinkCalibNeeded(false)
                setScreen(s)
              }}
            >
              {{ main: 'Home', calibration: 'Calibrate', settings: 'Settings' }[s]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ── */}
      <div style={S.content}>
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
          <SettingsScreen autoPause={autoPause} onAutoPauseToggle={handleAutoPauseToggle} />
        )}
      </div>
    </div>
  )
}

/* ── No YouTube Tab empty state ── */

function NoTabState() {
  return (
    <div className="fade-in" style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 140px)',
      gap: '20px', textAlign: 'center',
    }}>
      <div style={{
        width: '56px', height: '56px',
        background: 'var(--surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: '16px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>

      <div>
        <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)', margin: '0 0 6px' }}>
          No YouTube tab open
        </p>
        <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, maxWidth: '200px', margin: '0 auto' }}>
          Switch to a YouTube tab to activate Nodex.
        </p>
      </div>

      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)', width: '100%', overflow: 'hidden',
      }}>
        {[
          ['01', 'Open youtube.com in any tab'],
          ['02', 'Click Start here in Nodex'],
          ['03', 'Nod your head to control playback'],
        ].map(([num, text], i, arr) => (
          <div key={num} style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            padding: '11px 14px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: '10px',
              color: 'var(--accent)', fontWeight: 700, flexShrink: 0,
              opacity: 0.7,
            }}>{num}</span>
            <span style={{ fontSize: '12px', color: 'var(--text-2)', lineHeight: 1.4, textAlign: 'left' }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Main Screen ── */

function MainScreen({
  running, browseMode, modeChanging, onModeToggle,
  metrics, lastCommand,
  blinkCalibNeeded, onDismissBlinkAlert, onGoCalibrate,
  isFirstLaunch,
  firstLaunchHintDismissed, onDismissFirstLaunchHint,
  autoNavFiredRef,
}) {
  const [isStarting, setIsStarting] = useState(false)
  const [startError, setStartError] = useState(/** @type {string|null} */ (null))
  const startTimerRef = useRef(/** @type {ReturnType<typeof setTimeout>|null} */ (null))

  // modelReady: true once the first METRICS_UPDATE has arrived (landmark received),
  // meaning MediaPipe WASM is loaded and the camera is delivering frames.
  // Falls back to true after 5 s so a user not in frame doesn't see "Loading…" forever.
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
    return () => {
      clearTimeout(modelReadyTimerRef.current)
      modelReadyTimerRef.current = null
    }
  }, [running])

  // First landmark received → model is definitely loaded.
  // modelReady deliberately excluded from deps: we only need to react to metrics
  // or running changing. Including modelReady would cause a redundant re-run
  // after setModelReady(true) fires, with no effect (condition is then false).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (metrics != null && running && !modelReady) {
      clearTimeout(modelReadyTimerRef.current)
      modelReadyTimerRef.current = null
      setModelReady(true)
    }
  }, [metrics, running])

  // Load sensitivity thresholds and personal EAR calibration so MetricBar
  // shows the correct trigger lines. Falls back to DEFAULT_THRESHOLDS / default
  // earClose if nothing is saved yet.
  const [thresholds, setThresholds] = useState(DEFAULT_THRESHOLDS)
  const [calibratedEar, setCalibratedEar] = useState(/** @type {number|null} */ (null))
  // true  → calibration record exists (may be expired/mismatched — "re-calibrate" case)
  // false → never calibrated — blink gesture effectively disabled until auto-EMA warms up
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

  // Camera came up → clear pending error / spinner
  useEffect(() => {
    if (running) { clearStartTimer(); setIsStarting(false); setStartError(null) }
  }, [running, clearStartTimer])

  // Cleanup on unmount
  useEffect(() => () => clearStartTimer(), [clearStartTimer])

  const handleToggle = () => {
    if (running) {
      clearStartTimer()
      setIsStarting(false)
      setStartError(null)
      sendToContent({ type: MSG.STOP_ENGINE })
    } else {
      setStartError(null)
      setIsStarting(true)
      sendToContent({ type: MSG.START_ENGINE })
      // 9 s timeout — if engine hasn't reported running by then, surface an actionable error
      startTimerRef.current = setTimeout(() => {
        setIsStarting(false)
        setStartError(
          'Camera did not start. Make sure a webcam is connected and that Chrome has camera permission for this site.',
        )
        startTimerRef.current = null
      }, 9000)
    }
  }

  // Auto-navigate to the Calibration screen ~800 ms after the engine starts
  // on the very first launch when no blink calibration exists.
  // Cancelled if the user dismisses the blink alert or the pre-start hint.
  // autoNavFiredRef and firstLaunchHintDismissed are lifted to App so they
  // survive MainScreen unmount/remount caused by tab navigation.
  const onGoCalibrateRef = useRef(onGoCalibrate)
  onGoCalibrateRef.current = onGoCalibrate
  useEffect(() => {
    if (
      running &&
      isFirstLaunch &&
      blinkCalibNeeded &&
      !hasAnyEarCalibration &&
      !firstLaunchHintDismissed &&
      !autoNavFiredRef.current
    ) {
      autoNavFiredRef.current = true
      const t = setTimeout(() => onGoCalibrateRef.current(), 800)
      return () => clearTimeout(t)
    }
  }, [running, isFirstLaunch, blinkCalibNeeded, hasAnyEarCalibration, firstLaunchHintDismissed])

  const cmdLabels = browseMode ? BROWSE_COMMAND_LABELS : COMMAND_LABELS

  return (
    <>
      {/* ── Blink calibration alert ── */}
      {blinkCalibNeeded && (
        hasAnyEarCalibration ? (
          <div className="fade-in" style={{
            background: 'var(--surface)',
            border: '1px solid var(--border-mid)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
            display: 'flex', alignItems: 'flex-start', gap: '10px',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: '2px' }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/>
            </svg>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
                Blink calibration expired
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '8px' }}>
                Recalibrate for accurate eye-close detection.
              </div>
              <button onClick={onGoCalibrate} style={{
                fontFamily: 'var(--font-ui)', fontSize: '11px', fontWeight: 600,
                background: 'var(--surface-3)', color: 'var(--text)',
                border: '1px solid var(--border-mid)', borderRadius: '6px',
                padding: '5px 12px', cursor: 'pointer',
              }}>
                Recalibrate →
              </button>
            </div>
            <button onClick={onDismissBlinkAlert} aria-label="Dismiss" style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--muted)', fontSize: '18px', lineHeight: 1,
              padding: '0', flexShrink: 0,
            }}>×</button>
          </div>
        ) : (
          <div className="fade-in" style={{
            background: 'rgba(91,255,216,0.05)',
            border: '1px solid rgba(91,255,216,0.2)',
            borderRadius: 'var(--radius-md)', padding: '14px 16px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
                Eye blink not configured
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, marginBottom: '12px' }}>
              30-second calibration makes blink detection reliable for your eyes.
            </div>
            <button onClick={onGoCalibrate} style={{
              width: '100%', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
              background: 'var(--accent)', color: '#060f0c',
              border: 'none', borderRadius: 'var(--radius-sm)',
              padding: '9px 0', cursor: 'pointer',
            }}>
              Set up eye blink — 30 sec
            </button>
            <button onClick={onDismissBlinkAlert} style={{
              display: 'block', margin: '8px auto 0', background: 'none',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-mono)',
              fontSize: '10px', color: 'var(--muted)', letterSpacing: '0.03em',
            }}>
              skip for now
            </button>
          </div>
        )
      )}

      {/* ── Engine status card ── */}
      <div style={S.card}>
        {/* Status row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <span style={S.dot(running && modelReady, isStarting || (running && !modelReady))} />
          <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text)', flex: 1 }}>
            {running
              ? (modelReady ? 'Engine running' : 'Loading model…')
              : isStarting ? 'Starting…' : 'Engine stopped'}
          </span>
          {running && modelReady && (
            <span style={{
              fontFamily: 'var(--font-mono)',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '0.06em',
              color: browseMode ? 'var(--accent)' : 'var(--muted)',
              background: browseMode ? 'rgba(91,255,216,0.08)' : 'transparent',
              border: `1px solid ${browseMode ? 'rgba(91,255,216,0.2)' : 'transparent'}`,
              borderRadius: '4px',
              padding: browseMode ? '2px 7px' : '0',
            }}>
              {browseMode ? 'BROWSE' : 'PLAYER'}
            </span>
          )}
        </div>

        {/* Camera error */}
        {startError && (
          <div style={{
            background: 'rgba(255,85,85,0.06)', border: '1px solid rgba(255,85,85,0.2)',
            borderRadius: 'var(--radius-sm)', padding: '10px 12px', marginBottom: '10px',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="var(--red)" strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/>
            </svg>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--red)', marginBottom: '3px' }}>
                Camera error
              </div>
              <div style={{ fontSize: '11px', color: '#a05555', lineHeight: 1.5 }}>
                {startError}
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            style={{
              ...S.btn,
              ...(running ? S.btnStop : S.btnPrimary),
              opacity: (isStarting || (running && !modelReady)) ? 0.55 : 1,
            }}
            onClick={handleToggle}
            disabled={isStarting}
          >
            {running ? (modelReady ? 'Stop' : 'Loading…') : isStarting ? 'Starting…' : 'Start'}
          </button>

          {running && (
            <button
              style={{
                ...S.btn,
                width: 'auto', flex: '0 0 auto', padding: '10px 14px',
                background: browseMode ? 'rgba(91,255,216,0.08)' : 'var(--surface-2)',
                color: browseMode ? 'var(--accent)' : 'var(--text-2)',
                border: `1px solid ${browseMode ? 'rgba(91,255,216,0.2)' : 'var(--border)'}`,
                opacity: modeChanging ? 0.45 : 1,
                fontSize: '12px',
              }}
              onClick={onModeToggle}
              disabled={modeChanging}
            >
              {browseMode ? 'Player' : 'Browse'}
            </button>
          )}
        </div>
      </div>

      {/* ── First-launch hint ── */}
      {!running && !isStarting && !startError &&
        isFirstLaunch && !hasAnyEarCalibration && !firstLaunchHintDismissed && !blinkCalibNeeded && (
        <FirstLaunchHint
          onCalibrate={onGoCalibrate}
          onSkip={onDismissFirstLaunchHint}
        />
      )}

      {/* ── Idle: default gestures ── */}
      {!running && !isStarting && !lastCommand && !startError && (
        <div style={S.card}>
          <div style={S.sectionLabel}>Default gestures</div>
          {[
            ['Head left / right', '← Rewind / Skip →'],
            ['Head up / down',    '↑↓ Volume'],
            ['Tilt left / right', 'Prev / Next'],
            ['Eyes closed',       'Play / Pause'],
          ].map(([gesture, cmd], i, arr) => (
            <div key={gesture} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-2)' }}>{gesture}</span>
              <span style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{cmd}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Last command flash ── */}
      {lastCommand && (
        <div key={`${lastCommand.command}-${lastCommand.gesture}`} className="cmd-flash" style={{
          background: 'var(--surface)',
          border: '1px solid var(--border-mid)',
          borderRadius: 'var(--radius-md)',
          padding: '14px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', fontFamily: 'var(--font-mono)', marginBottom: '4px', letterSpacing: '0.04em' }}>
              LAST GESTURE
            </div>
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--accent)' }}>
              {cmdLabels[lastCommand.command] ?? COMMAND_LABELS[lastCommand.command] ?? lastCommand.command}
            </div>
          </div>
          <span style={{
            fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: '4px', padding: '3px 7px', letterSpacing: '0.03em',
          }}>
            {GESTURE_LABELS[lastCommand.gesture] ?? lastCommand.gesture}
          </span>
        </div>
      )}

      {/* ── Live metrics ── */}
      {metrics && (
        <div style={S.card}>
          <div style={S.sectionLabel}>Live metrics</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', marginBottom: '8px' }}>
            <MetricBar label="Yaw"   value={metrics.yaw}   max={60} threshold={thresholds.yaw}   type="centered" unit="°" />
            <MetricBar label="Pitch" value={metrics.pitch} max={45} threshold={thresholds.pitch} type="centered" unit="°" />
            <MetricBar label="Roll"  value={metrics.roll}  max={45} threshold={thresholds.roll}  type="centered" unit="°" />
          </div>
          <div style={S.divider} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            <MetricBar label="EAR"   value={metrics.ear}   max={0.40} threshold={calibratedEar ?? thresholds.earClose} type="fill" triggerBelow />
            <MetricBar label="Mouth" value={metrics.mouth} max={1.0}  threshold={thresholds.mouthOpen} type="fill" />
          </div>
        </div>
      )}
    </>
  )
}

/* ── First-launch calibration hint ── */

/**
 * Shown in MainScreen idle state when:
 *   - Engine is stopped
 *   - User has never calibrated blink detection
 *   - This is their first (or second) engine start total
 *
 * Prominently asks the user to calibrate before starting, with a skip option.
 * Clicking "Start without calibrating" dismisses the hint for this session AND
 * prevents the auto-navigate that would otherwise fire after the engine starts.
 */
function FirstLaunchHint({ onCalibrate, onSkip }) {
  return (
    <div className="fade-in" style={{
      background: 'rgba(91,255,216,0.04)',
      border: '1px solid rgba(91,255,216,0.15)',
      borderRadius: 'var(--radius-md)', padding: '14px 16px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent)' }}>
          Set up blink detection first
        </span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 12px' }}>
        30-second calibration makes eye-close detection reliable for your eyes.
      </p>
      <button onClick={onCalibrate} style={{
        width: '100%', fontFamily: 'var(--font-ui)', fontSize: '12px', fontWeight: 600,
        background: 'var(--accent)', color: '#060f0c',
        border: 'none', borderRadius: 'var(--radius-sm)',
        padding: '9px 0', cursor: 'pointer', marginBottom: '8px',
      }}>
        Calibrate now — 30 sec
      </button>
      <button onClick={onSkip} style={{
        display: 'block', width: '100%', background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: '10px',
        color: 'var(--muted)', letterSpacing: '0.03em', padding: '2px 0',
      }}>
        Skip for now
      </button>
    </div>
  )
}

/* ── Calibration Screen ── */

/**
 * @param {{ running: boolean, sendToContent: typeof sendToContent }} props
 */
function CalibrationScreen({ running, sendToContent }) {
  const [wizardMode, setWizardMode] = useState(/** @type {null | 'full' | 'neutral_only' | 'blink_only'} */ (null))
  const [summary, setSummary] = useState(
    /** @type {{ cal: { yaw?: number, pitch?: number } | null, ear: { threshold?: number } | null, at: number | null }} */ ({
      cal: null,
      ear: null,
      at: null,
    }),
  )

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
    summary.cal != null && typeof summary.cal.yaw === 'number' && Number.isFinite(summary.cal.yaw)
      ? `${summary.cal.yaw.toFixed(1)}°`
      : '—'
  const pitchStr =
    summary.cal != null && typeof summary.cal.pitch === 'number' && Number.isFinite(summary.cal.pitch)
      ? `${summary.cal.pitch.toFixed(1)}°`
      : '—'
  const thStr =
    summary.ear != null &&
    typeof summary.ear.threshold === 'number' &&
    Number.isFinite(summary.ear.threshold)
      ? summary.ear.threshold.toFixed(2)
      : '—'

  return (
    <>
      {wizardMode && (
        <CalibrationWizard
          mode={wizardMode}
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          onClose={() => { setWizardMode(null); refreshSummary() }}
        />
      )}

      {/* ── Calibration data ── */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Calibration data</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginBottom: '10px' }}>
          {[['YAW', yawStr], ['PITCH', pitchStr], ['EAR', thStr]].map(([label, val]) => (
            <div key={label} style={S.metricTile}>
              <span style={S.metricLabel}>{label}</span>
              <span style={S.metricValue}>{val}</span>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: '10px', fontFamily: 'var(--font-mono)', color: 'var(--muted)', letterSpacing: '0.02em' }}>
            {dateStr}
          </span>
        </div>

        {!running && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            background: 'var(--surface-2)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '9px 11px', marginBottom: '12px',
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="var(--amber)" strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/>
            </svg>
            <span style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Start the camera from Home — calibration needs a live face feed.
            </span>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button type="button"
            style={{ ...S.btn, ...S.btnPrimary, opacity: running ? 1 : 0.35 }}
            disabled={!running} onClick={() => setWizardMode('neutral_only')}>
            Neutral pose
          </button>
          <button type="button"
            style={{ ...S.btn, ...S.btnStop, opacity: running ? 1 : 0.35 }}
            disabled={!running} onClick={() => setWizardMode('blink_only')}>
            Blink detection
          </button>
          <button type="button"
            style={{ ...S.btn, ...S.btnSecondary, opacity: running ? 1 : 0.35 }}
            disabled={!running} onClick={() => setWizardMode('full')}>
            Full recalibration
          </button>
        </div>
      </div>
    </>
  )
}

/* ── Settings Screen ── */

function SettingsScreen({ autoPause, onAutoPauseToggle }) {
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
      setPlayerMap(pm)
      setBrowseMap(bm)
      const settings = await loadSettings({ thresholds: DEFAULT_THRESHOLDS })
      const th = { ...DEFAULT_THRESHOLDS, ...(settings.thresholds ?? {}) }
      for (const [key, val] of Object.entries(SENSITIVITY_PRESETS)) {
        if (
          val.yaw === th.yaw &&
          val.pitch === th.pitch &&
          (val.hysteresisYaw ?? 7) === (th.hysteresisYaw ?? 7) &&
          (val.hysteresisPitch ?? 7) === (th.hysteresisPitch ?? 7)
        ) {
          setPreset(key)
          break
        }
      }
      const { nodex_refine_landmarks } = await chrome.storage.local.get('nodex_refine_landmarks')
      setRefineLandmarks(nodex_refine_landmarks === true)
    })()
  }, [])

  const currentMap = editingMode === 'player' ? playerMap : browseMap
  const setCurrentMap = editingMode === 'player' ? setPlayerMap : setBrowseMap

  const handleGestureChange = (gesture, command) => {
    setCurrentMap((prev) => ({ ...prev, [gesture]: command }))
    setSaved(false)
  }

  const handlePresetChange = (e) => {
    setPreset(e.target.value)
    setSaved(false)
  }

  const handleSave = async () => {
    const thresholds = SENSITIVITY_PRESETS[preset] ?? DEFAULT_THRESHOLDS
    await savePlayerGestureMap(playerMap)
    await saveBrowseGestureMap(browseMap)
    await saveSettings({ thresholds })
    await sendToContent({
      type: MSG.UPDATE_SETTINGS,
      settings: {
        thresholds,
        playerGestureMap: playerMap,
        browseGestureMap: browseMap,
      },
    })
    setSaved(true)
  }

  const handleRefineLandmarksToggle = async (e) => {
    const value = e.target.checked
    setRefineLandmarks(value)
    await chrome.storage.local.set({ nodex_refine_landmarks: value }).catch(() => {})
  }

  const handleClearData = async () => {
    if (!clearConfirm) {
      setClearConfirm(true)
      // Cancel any previous timer (rapid double-click guard).
      if (clearConfirmTimerRef.current) clearTimeout(clearConfirmTimerRef.current)
      clearConfirmTimerRef.current = setTimeout(() => {
        clearConfirmTimerRef.current = null
        setClearConfirm(false)
      }, 4000)
      return
    }
    if (clearConfirmTimerRef.current) {
      clearTimeout(clearConfirmTimerRef.current)
      clearConfirmTimerRef.current = null
    }
    await chrome.storage.local.clear().catch(() => {})
    // Reload the side panel so App resets to initial state (onboarding, etc.)
    window.location.reload()
  }

  // Cancel the confirm timer if the user navigates away from Settings.
  useEffect(() => () => {
    if (clearConfirmTimerRef.current) clearTimeout(clearConfirmTimerRef.current)
  }, [])

  const mappableGestures = Object.values(GESTURES).filter((g) => g !== GESTURES.NONE)
  const isBrowse = editingMode === 'browse'
  const commandOptions = isBrowse ? BROWSE_COMMANDS : Object.values(COMMANDS)
  const labels = isBrowse ? BROWSE_COMMAND_LABELS : COMMAND_LABELS

  // Reusable toggle component
  const Toggle = ({ checked, onChange }) => (
    <div style={{ position: 'relative', flexShrink: 0, marginTop: '1px' }}>
      <input type="checkbox" checked={checked} onChange={onChange}
        style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }} />
      <div style={{
        width: '34px', height: '19px', borderRadius: '10px',
        background: checked ? 'var(--accent)' : 'var(--surface-3)',
        border: `1px solid ${checked ? 'rgba(91,255,216,0.3)' : 'var(--border-mid)'}`,
        transition: 'background 0.2s, border-color 0.2s',
        position: 'relative', cursor: 'pointer',
      }}>
        <div style={{
          position: 'absolute', top: '2px',
          left: checked ? '16px' : '2px',
          width: '13px', height: '13px', borderRadius: '50%',
          background: checked ? '#060f0c' : 'var(--muted)',
          transition: 'left 0.2s, background 0.2s',
        }} />
      </div>
    </div>
  )

  return (
    <>
      {/* ── Gesture mapping ── */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Gesture mapping</div>
        <div style={{ ...S.nav, marginBottom: '12px' }}>
          <button style={{ ...S.navBtn, ...(editingMode === 'player' ? S.navBtnActive : {}) }}
            onClick={() => setEditingMode('player')}>
            Player
          </button>
          <button style={{ ...S.navBtn, ...(editingMode === 'browse' ? S.navBtnActive : {}) }}
            onClick={() => setEditingMode('browse')}>
            Browse
          </button>
        </div>
        {mappableGestures.map((g) => (
          <div key={g} style={S.gestureRow}>
            <span style={S.gestureLabel}>{GESTURE_LABELS[g] ?? g}</span>
            <div style={S.gestureSelect}>
              <select style={S.select} value={currentMap[g] ?? COMMANDS.NONE}
                onChange={(e) => handleGestureChange(g, e.target.value)}>
                {commandOptions.map((c) => (
                  <option key={c} value={c}>{labels[c] ?? COMMAND_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      {/* ── Sensitivity ── */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Sensitivity</div>
        <select style={S.select} value={preset} onChange={handlePresetChange}>
          <option value="low">Low — large movements</option>
          <option value="medium">Medium (default)</option>
          <option value="high">High — small movements</option>
        </select>
      </div>

      {/* ── Smart features ── */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Smart features</div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <Toggle checked={autoPause} onChange={onAutoPauseToggle} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
              Auto-pause when you leave
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
              Pauses after 2s with no face in frame.
            </div>
          </div>
        </label>
        <div style={S.divider} />
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <Toggle checked={refineLandmarks} onChange={handleRefineLandmarksToggle} />
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '2px' }}>
              High-precision landmarks
            </div>
            <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.5 }}>
              478-point mesh. Applies after reloading YouTube tab.
            </div>
          </div>
        </label>
      </div>

      {/* ── Data ── */}
      <div style={S.card}>
        <div style={S.sectionLabel}>Data</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
            stroke="var(--muted)" strokeWidth="2" strokeLinecap="round">
            <rect x="5" y="2" width="14" height="20" rx="2"/>
            <path d="M12 18h.01"/>
          </svg>
          <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
            All data stored locally — nothing sent to any server.
          </span>
        </div>
        <button
          style={{
            ...S.btn,
            background: clearConfirm ? 'rgba(255,85,85,0.12)' : 'transparent',
            color: 'var(--red)',
            border: '1px solid rgba(255,85,85,0.25)',
            transition: 'background 0.2s',
            fontSize: '12px',
          }}
          onClick={handleClearData}
        >
          {clearConfirm ? '⚠ Tap again to confirm — cannot be undone' : 'Clear all Nodex data'}
        </button>
      </div>

      {/* ── Save ── */}
      <button
        style={{
          ...S.btn,
          background: saved ? 'transparent' : 'var(--accent)',
          color: saved ? 'var(--accent)' : '#060f0c',
          border: saved ? '1px solid rgba(91,255,216,0.25)' : 'none',
          transition: 'all 0.2s',
        }}
        onClick={handleSave}
      >
        {saved ? '✓ Saved' : 'Save settings'}
      </button>
    </>
  )
}
