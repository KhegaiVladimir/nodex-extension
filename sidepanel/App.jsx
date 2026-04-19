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

const TUTORIAL_GESTURES = [
  { label: 'Turn your head left',       gesture: GESTURES.HEAD_LEFT },
  { label: 'Turn your head right',      gesture: GESTURES.HEAD_RIGHT },
  { label: 'Tilt your head up',       gesture: GESTURES.HEAD_UP },
  { label: 'Close your eyes for 0.5s',   gesture: GESTURES.EYES_CLOSED },
]

/* ── styles ── */

const S = {
  app: {
    padding: '14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    minHeight: '100vh',
    background: 'var(--bg)',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: 0,
    letterSpacing: '-0.01em',
  },
  subheading: {
    fontFamily: 'var(--font-ui)',
    fontSize: '11px',
    fontWeight: 500,
    color: 'var(--muted)',
    marginBottom: '10px',
    letterSpacing: '0.01em',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    padding: '16px',
  },
  btn: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    fontWeight: 600,
    padding: '10px 0',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s',
    letterSpacing: '0.01em',
  },
  btnPrimary: {
    background: 'var(--text)',
    color: '#0e0e0e',
  },
  btnSecondary: {
    background: 'transparent',
    color: 'var(--muted)',
    border: '1px solid var(--border)',
  },
  nav: {
    display: 'flex',
    gap: '3px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '10px',
    padding: '3px',
  },
  navBtn: {
    flex: 1,
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    padding: '7px 0',
    border: 'none',
    borderRadius: '7px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    background: 'var(--surface-2)',
    color: 'var(--text)',
    fontWeight: 600,
  },
  metricLabel: { color: 'var(--muted)', fontSize: '11px' },
  metricValue: {
    color: 'var(--accent)',
    fontWeight: 600,
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
  },
  metricTile: {
    background: 'var(--bg)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '8px 10px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
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
  },
  // isActive = fully running (first landmark received)
  // isLoading = camera started but model not ready yet / starting up
  status: (isActive, isLoading = false) => ({
    display: 'inline-block',
    width: '6px',
    height: '6px',
    borderRadius: '50%',
    flexShrink: 0,
    background: isActive ? '#4ade80' : isLoading ? '#f59e0b' : '#404040',
    marginRight: '8px',
    animation: isActive ? 'pulse-dot 2s ease-in-out infinite' : 'none',
  }),
  progressBar: {
    width: '100%',
    height: '4px',
    background: 'var(--border)',
    borderRadius: '2px',
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressFill: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.2s',
    borderRadius: '2px',
  }),
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '7px 0',
    borderBottom: '1px solid var(--border)',
  },
  gestureLabel: { fontFamily: 'var(--font-ui)', fontSize: '12px', flex: '1 1 auto', whiteSpace: 'nowrap', color: 'var(--text)' },
  gestureSelect: { flex: '0 0 128px' },

  onboardWrap: {
    display: 'flex',
    flexDirection: 'column',
    padding: '24px',
    gap: '20px',
    minHeight: '100vh',
    justifyContent: 'center',
  },
  onboardCard: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '14px',
    padding: '24px',
  },
  onboardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '32px',
    fontWeight: 800,
    color: 'var(--text)',
    margin: '0 0 4px',
    letterSpacing: '-0.03em',
  },
  onboardHeading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '16px',
    fontWeight: 700,
    color: 'var(--text)',
    margin: '0 0 8px',
  },
  onboardSub: {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    color: 'var(--text)',
    margin: '0 0 12px',
  },
  onboardText: {
    fontFamily: 'var(--font-ui)',
    fontSize: '13px',
    color: 'var(--muted)',
    lineHeight: 1.65,
    margin: '0 0 16px',
  },
  onboardNote: {
    fontFamily: 'var(--font-ui)',
    fontSize: '12px',
    color: 'var(--muted)',
    fontStyle: 'italic',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  onboardBtn: {
    fontFamily: 'var(--font-ui)',
    fontSize: '14px',
    fontWeight: 600,
    background: 'var(--text)',
    color: '#0e0e0e',
    height: '48px',
    borderRadius: '12px',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
    letterSpacing: '0.01em',
  },
  onboardStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginTop: '12px',
  },
  onboardGestureRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '10px 0',
    borderBottom: '1px solid var(--border)',
  },
  onboardCheck: {
    color: 'var(--accent)',
    fontWeight: 700,
    fontSize: '16px',
  },
  onboardSkip: {
    fontFamily: 'var(--font-mono)',
    color: 'var(--muted)',
    fontSize: '11px',
    textDecoration: 'underline',
    cursor: 'pointer',
    marginTop: '16px',
    background: 'none',
    border: 'none',
  },
  onboardDot: {
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: 'var(--accent)',
  },
}

/* ── App ── */

export default function App() {
  const [onboarded, setOnboarded] = useState(null)
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
    Promise.all([loadSettings({}), loadCalibration()]).then(([settings, calibration]) => {
      // Consider the user onboarded if either:
      // (a) the explicit flag is set, OR
      // (b) a calibration already exists (user clearly completed at least Step 3).
      // The second path protects against the flag being lost to storage races.
      const onboardedNow = Boolean(settings.onboarding_complete) || Boolean(calibration)
      setOnboarded(onboardedNow)
      if (onboardedNow && !settings.onboarding_complete) {
        saveSettings({ onboarding_complete: true }).catch(() => {})
      }
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

  if (onboarded === null) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  if (!onboarded) {
    return <OnboardingFlow onComplete={() => setOnboarded(true)} />
  }

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

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h1 style={S.heading}>Nodex</h1>
      </div>

      <div style={S.nav}>
        {['main', 'calibration', 'settings'].map((s) => (
          <button
            key={s}
            style={{
              ...S.navBtn,
              ...(screen === s ? S.navBtnActive : {}),
            }}
            onClick={() => {
              // Navigating to Calibration clears the blink alert so that on return
              // to Home the auto-navigate effect doesn't re-trigger (its ref resets
              // when MainScreen unmounts).
              if (s === 'calibration') setBlinkCalibNeeded(false)
              setScreen(s)
            }}
          >
            {{ main: 'Home', calibration: 'Calibrate', settings: 'Settings' }[s]}
          </button>
        ))}
      </div>

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
  )
}

/* ── No YouTube Tab empty state ── */

function NoTabState() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: 'calc(100vh - 120px)',
      gap: '24px', padding: '0 4px', textAlign: 'center',
    }}>
      {/* Monitor icon */}
      <div style={{
        width: '72px', height: '72px',
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
          stroke="#303030" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <path d="M8 21h8M12 17v4" />
        </svg>
      </div>

      <div>
        <p style={{
          fontFamily: 'var(--font-heading)', fontSize: '17px',
          fontWeight: 700, color: 'var(--text)', margin: '0 0 8px',
        }}>
          No YouTube tab open
        </p>
        <p style={{
          fontFamily: 'var(--font-mono)', fontSize: '12px',
          color: 'var(--muted)', lineHeight: 1.6, maxWidth: '210px', margin: '0 auto',
        }}>
          Nodex needs an active YouTube tab to control playback.
        </p>
      </div>

      {/* Steps */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: '12px', padding: '4px 0', width: '100%',
      }}>
        {[
          { icon: '▶', text: 'Open youtube.com in any tab' },
          { icon: '↑', text: 'Click Start in Nodex' },
          { icon: '↔', text: 'Nod to control playback' },
        ].map(({ icon, text }, i, arr) => (
          <div key={i} style={{
            display: 'flex', gap: '12px', alignItems: 'center',
            padding: '10px 16px',
            borderBottom: i < arr.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <div style={{
              width: '28px', height: '28px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', color: 'var(--muted)', flexShrink: 0,
            }}>
              {icon}
            </div>
            <span style={{
              fontSize: '12px', color: 'var(--muted)',
              lineHeight: 1.4, textAlign: 'left', fontFamily: 'var(--font-ui)',
            }}>
              {text}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Onboarding Flow ── */

function OnboardingFlow({ onComplete }) {
  const [step, setStep] = useState(1)
  const next = useCallback(() => setStep((s) => s + 1), [])

  if (step === 1) return <OnboardStep1 onNext={next} />
  if (step === 2) return <OnboardStep2 onNext={next} />
  if (step === 3) return <OnboardStep3 onNext={next} />
  if (step === 4) return <OnboardStep4 onComplete={onComplete} />
  return null
}

/* ── Step 1: Welcome ── */

function OnboardStep1({ onNext }) {
  return (
    <div style={{ ...S.onboardWrap, gap: '16px' }}>
      {/* Brand block */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: '60px', height: '60px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: '18px',
          marginBottom: '16px',
        }}>
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
            stroke="var(--text)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            <path d="M19 3l2 2-2 2" />
            <path d="M5 3L3 5l2 2" />
          </svg>
        </div>
        <h1 style={{ ...S.onboardTitle, textAlign: 'center' }}>Nodex</h1>
        <p style={{
          fontFamily: 'var(--font-ui)', fontSize: '13px',
          color: 'var(--muted)', margin: '4px 0 0',
        }}>
          Hands-free YouTube — on any webcam
        </p>
      </div>

      {/* Feature cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {[
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
                <path d="M12 2L9 8H3l5 4-2 6 6-4 6 4-2-6 5-4h-6z" />
              </svg>
            ),
            title: 'Head gestures',
            desc: 'Nod, tilt, turn — seek, volume, play/pause without touching anything',
          },
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            ),
            title: '100% on-device',
            desc: 'MediaPipe runs in your browser. No video ever leaves your machine.',
          },
          {
            icon: (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
            ),
            title: 'Calibrates to you',
            desc: 'Guided setup adapts thresholds to your face and head range.',
          },
        ].map(({ icon, title, desc }) => (
          <div key={title} style={{
            display: 'flex', gap: '12px', alignItems: 'flex-start',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            padding: '12px',
          }}>
            <div style={{
              width: '30px', height: '30px',
              background: 'var(--surface-2)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {icon}
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
                {title}
              </div>
              <div style={{ fontSize: '11px', color: 'var(--muted)', lineHeight: 1.55, fontFamily: 'var(--font-mono)' }}>
                {desc}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div>
        <button style={S.onboardBtn} onClick={onNext}>
          Get started →
        </button>
        <p style={{
          textAlign: 'center', fontSize: '10px', color: '#404040',
          fontFamily: 'var(--font-mono)', marginTop: '10px',
        }}>
          Setup takes about 2 minutes
        </p>
      </div>
    </div>
  )
}

/* ── Step 2: Camera Permission ── */

function OnboardStep2({ onNext }) {
  const [status, setStatus] = useState('idle')

  const handleStart = useCallback(() => {
    if (status === 'waiting' || status === 'success') return
    setStatus('waiting')
    sendToContent({ type: MSG.START_ENGINE })

    const timeout = setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener)
      setStatus((cur) => (cur === 'waiting' ? 'error' : cur))
    }, 10000)

    const listener = (message) => {
      if (shouldIgnoreSidePanelMessage(message)) return
      if (message.type === MSG.ENGINE_STATUS && message.running) {
        clearTimeout(timeout)
        chrome.runtime.onMessage.removeListener(listener)
        setStatus('success')
        setTimeout(onNext, 1500)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
  }, [status, onNext])

  return (
    <div style={S.onboardWrap}>
      <div style={S.onboardCard}>
        <h2 style={S.onboardHeading}>Camera</h2>
        <p style={S.onboardText}>
          Open any YouTube video and tap the button below.
        </p>
        <p style={S.onboardNote}>
          Nodex will ask for camera access — needed for gesture tracking.
          The camera feed is not recorded or transmitted.
        </p>
        <button
          style={{ ...S.onboardBtn, opacity: status === 'waiting' ? 0.6 : 1 }}
          onClick={handleStart}
          disabled={status === 'waiting' || status === 'success'}
        >
          Start engine
        </button>

        {status === 'waiting' && (
          <div style={S.onboardStatus}>
            <span style={S.onboardDot} />
            <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Starting…</span>
          </div>
        )}
        {status === 'success' && (
          <div style={S.onboardStatus}>
            <span style={{ ...S.onboardDot, background: '#4ade80' }} />
            <span style={{ color: '#4ade80', fontSize: '12px' }}>Engine running</span>
          </div>
        )}
        {status === 'error' && (
          <div style={S.onboardStatus}>
            <span style={{ color: '#ef4444', fontSize: '12px' }}>
              Error: open a YouTube video and try again
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Step 3: Calibration (runs wizard inline so step 4 has a baseline) ── */

function OnboardStep3({ onNext }) {
  return (
    <CalibrationWizard
      mode="full"
      sendToContent={sendToContent}
      shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
      onClose={onNext}
    />
  )
}

/* ── Step 4: Gesture Tutorial ── */

function OnboardStep4({ onComplete }) {
  const [completed, setCompleted] = useState(() => new Set())
  const [showSkip, setShowSkip] = useState(false)
  const allDone = completed.size === TUTORIAL_GESTURES.length

  useEffect(() => {
    const timer = setTimeout(() => setShowSkip(true), 60000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    sendToContent({ type: MSG.TUTORIAL_START })

    const listener = (message) => {
      if (shouldIgnoreSidePanelMessage(message)) return
      // BLINK_DETECTED fires before command mapping so it works even if EYES_CLOSED
      // is mapped to NONE or the tab has no video.
      const g = message.type === MSG.BLINK_DETECTED
        ? GESTURES.EYES_CLOSED
        : message.type === MSG.COMMAND_EXECUTED ? message.gesture : null
      if (!g) return
      setCompleted((prev) => {
        if (TUTORIAL_GESTURES.some((t) => t.gesture === g) && !prev.has(g)) {
          const next = new Set(prev)
          next.add(g)
          return next
        }
        return prev
      })
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => {
      chrome.runtime.onMessage.removeListener(listener)
      sendToContent({ type: MSG.TUTORIAL_END })
    }
  }, [])

  const handleFinish = useCallback(async () => {
    await saveSettings({ onboarding_complete: true })
    onComplete()
  }, [onComplete])

  return (
    <div style={S.onboardWrap}>
      <div style={S.onboardCard}>
        <h2 style={S.onboardHeading}>Try the gestures</h2>
        <p style={S.onboardText}>
          Perform each gesture — Nodex will show what it recognized.
        </p>

        {TUTORIAL_GESTURES.map(({ label, gesture }) => (
          <div key={gesture} style={S.onboardGestureRow}>
            <span style={{ fontSize: '12px' }}>{label}</span>
            <span
              style={
                completed.has(gesture)
                  ? S.onboardCheck
                  : { color: 'var(--muted)', fontSize: '16px' }
              }
            >
              {completed.has(gesture) ? '✓' : '○'}
            </span>
          </div>
        ))}

        {allDone && (
          <>
            <p style={{ color: 'var(--accent)', fontSize: '14px', fontWeight: 700, marginTop: '16px' }}>
              Great! Everything works.
            </p>
            <button
              style={{ ...S.onboardBtn, marginTop: '12px' }}
              onClick={handleFinish}
            >
              Go to Nodex →
            </button>
          </>
        )}

        {showSkip && !allDone && (
          <button style={S.onboardSkip} onClick={handleFinish}>
            Skip →
          </button>
        )}
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
        hasAnyEarCalibration
          /* ── Calibration exists but expired / mismatched ── */
          ? (
            <div style={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              padding: '12px 14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke="var(--muted)" strokeWidth="2" strokeLinecap="round"
                style={{ flexShrink: 0, marginTop: '2px' }}>
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5"/>
              </svg>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text)', marginBottom: '3px' }}>
                  Re-calibrate blink detection
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--muted)', lineHeight: 1.5 }}>
                  Your calibration has expired or no longer matches the current mode.
                </div>
                <button onClick={onGoCalibrate} style={{
                  marginTop: '8px', fontFamily: 'var(--font-mono)',
                  fontSize: '11px', fontWeight: 600,
                  background: 'var(--surface-2)', color: 'var(--text)',
                  border: '1px solid var(--border)', borderRadius: '6px',
                  padding: '5px 12px', cursor: 'pointer',
                }}>
                  Re-calibrate →
                </button>
              </div>
              <button onClick={onDismissBlinkAlert} aria-label="Dismiss" style={{
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'var(--muted)', fontSize: '16px', lineHeight: 1,
                padding: '0', flexShrink: 0,
              }}>×</button>
            </div>
          )
          /* ── Never calibrated — eye blink gesture is effectively off ── */
          : (
            <div style={{
              background: 'rgba(91,255,216,0.06)',
              border: '1px solid rgba(91,255,216,0.3)',
              borderRadius: '12px',
              padding: '16px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="var(--accent-active)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ flexShrink: 0 }}>
                  <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--accent-active)' }}>
                  Eye blink is not set up
                </span>
              </div>
              <div style={{
                fontSize: '12px', fontFamily: 'var(--font-ui)',
                color: 'var(--muted)', lineHeight: 1.6, marginBottom: '12px',
              }}>
                A 30-second calibration makes blink detection reliable for your eyes.
              </div>
              <button onClick={onGoCalibrate} style={{
                width: '100%', fontFamily: 'var(--font-ui)',
                fontSize: '12px', fontWeight: 600,
                background: 'var(--accent-active)', color: '#0a0a0a',
                border: 'none', borderRadius: '8px',
                padding: '9px 0', cursor: 'pointer',
              }}>
                Set up eye blink — 30 sec
              </button>
              <button onClick={onDismissBlinkAlert} style={{
                display: 'block', margin: '8px auto 0',
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontSize: '10px',
                color: 'var(--muted)', letterSpacing: '0.03em',
              }}>
                skip for now
              </button>
            </div>
          )
      )}
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <span style={S.status(running && modelReady, isStarting || (running && !modelReady))} />
          <span style={{ fontWeight: 600, fontSize: '13px' }}>
            {running
              ? (modelReady ? 'Engine running' : 'Loading model…')
              : isStarting ? 'Starting…' : 'Engine stopped'}
          </span>
          {running && modelReady && (
            <span style={{
              marginLeft: 'auto',
              fontSize: '11px',
              fontFamily: 'var(--font-ui)',
              color: browseMode ? 'var(--accent-active)' : 'var(--muted)',
            }}>
              {browseMode ? 'Browse' : 'Player'}
            </span>
          )}
        </div>

        {/* Camera start error */}
        {startError && (
          <div style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.25)',
            borderRadius: '8px',
            padding: '10px 12px',
            marginBottom: '10px',
            display: 'flex', gap: '8px', alignItems: 'flex-start',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="#ef4444" strokeWidth="2" strokeLinecap="round"
              style={{ flexShrink: 0, marginTop: '1px' }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" strokeWidth="2.5" />
            </svg>
            <div>
              <div style={{ fontSize: '11px', fontWeight: 700, color: '#ef4444', marginBottom: '3px' }}>
                Camera error
              </div>
              <div style={{ fontSize: '11px', color: '#a05555', lineHeight: 1.5, fontFamily: 'var(--font-mono)' }}>
                {startError}
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            style={{
              ...S.btn,
              ...(running ? S.btnSecondary : S.btnPrimary),
              opacity: (isStarting || (running && !modelReady)) ? 0.6 : 1,
            }}
            onClick={handleToggle}
            disabled={isStarting}
          >
            {running
              ? (modelReady ? 'Stop' : 'Loading…')
              : isStarting ? 'Starting…' : 'Start'}
          </button>

          {running && (
            <button
              style={{
                ...S.btn,
                width: 'auto',
                flex: '0 0 auto',
                padding: '10px 14px',
                background: browseMode ? 'rgba(91,255,216,0.08)' : 'transparent',
                color: browseMode ? 'var(--accent-active)' : 'var(--muted)',
                border: `1px solid ${browseMode ? 'rgba(91,255,216,0.25)' : 'var(--border)'}`,
                opacity: modeChanging ? 0.5 : 1,
                fontSize: '11px',
              }}
              onClick={onModeToggle}
              disabled={modeChanging}
            >
              {browseMode ? 'Player' : 'Browse'}
            </button>
          )}
        </div>
      </div>

      {/* ── First-launch calibration hint — shown before engine starts ── */}
      {/* blinkCalibNeeded suppresses this because the blink alert above already */}
      {/* prompts calibration — showing both simultaneously is redundant.        */}
      {!running && !isStarting && !startError &&
        isFirstLaunch && !hasAnyEarCalibration && !firstLaunchHintDismissed && !blinkCalibNeeded && (
        <FirstLaunchHint
          onCalibrate={onGoCalibrate}
          onSkip={onDismissFirstLaunchHint}
        />
      )}

      {/* Idle hint — shown when engine is off, not starting, no prior command this session */}
      {!running && !isStarting && !lastCommand && !startError && (
        <div style={S.card}>
          <div style={S.subheading}>Default gestures</div>
          {[
            ['Head left / right', 'Rewind / Skip'],
            ['Head up / down',    'Volume'],
            ['Tilt left / right', 'Prev / Next'],
            ['Eyes closed',       'Play / Pause'],
          ].map(([gesture, cmd]) => (
            <div key={gesture} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 0',
              borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text)' }}>{gesture}</span>
              <span style={{ fontSize: '12px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>{cmd}</span>
            </div>
          ))}
        </div>
      )}

      {lastCommand && (
        <div style={S.card}>
          <div style={S.subheading}>Last gesture</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--accent)' }}>
              {cmdLabels[lastCommand.command] ?? COMMAND_LABELS[lastCommand.command] ?? lastCommand.command}
            </span>
            <span style={{ fontSize: '10px', color: 'var(--muted)', fontFamily: 'var(--font-mono)' }}>
              {GESTURE_LABELS[lastCommand.gesture] ?? lastCommand.gesture}
            </span>
          </div>
        </div>
      )}

      {metrics && (
        <div style={S.card}>
          <div style={S.subheading}>Live metrics</div>

          {/* Head rotation — centered bars, grow from midpoint outward */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px', marginBottom: '6px' }}>
            <MetricBar label="Yaw"   value={metrics.yaw}   max={60} threshold={thresholds.yaw}   type="centered" unit="°" />
            <MetricBar label="Pitch" value={metrics.pitch} max={45} threshold={thresholds.pitch} type="centered" unit="°" />
            <MetricBar label="Roll"  value={metrics.roll}  max={45} threshold={thresholds.roll}  type="centered" unit="°" />
          </div>

          {/* 1px divider between rotation and face metrics */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0 6px' }} />

          {/* Face metrics — fill bars, left to right */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
            {/* EAR: use personal calibrated threshold when available, else settings default */}
            <MetricBar label="EAR"   value={metrics.ear}   max={0.40} threshold={calibratedEar ?? thresholds.earClose}  type="fill" triggerBelow />
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
    <div style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      padding: '16px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/>
          <circle cx="12" cy="12" r="3"/>
        </svg>
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)' }}>
          Set up blink detection first
        </span>
      </div>

      {/* Body */}
      <p style={{
        fontSize: '12px', fontFamily: 'var(--font-ui)',
        color: 'var(--muted)', lineHeight: 1.6, margin: '0 0 12px',
      }}>
        A 30-second calibration makes eye-close detection reliable for your specific eyes.
      </p>

      {/* CTA */}
      <button
        onClick={onCalibrate}
        style={{
          width: '100%', fontFamily: 'var(--font-ui)',
          fontSize: '12px', fontWeight: 600,
          background: 'var(--text)', color: '#0e0e0e',
          border: 'none', borderRadius: '8px',
          padding: '10px 0', cursor: 'pointer',
          marginBottom: '8px',
        }}
      >
        Calibrate now — 30 sec
      </button>

      {/* Skip */}
      <button
        onClick={onSkip}
        style={{
          display: 'block', width: '100%',
          background: 'none', border: 'none', cursor: 'pointer',
          fontFamily: 'var(--font-mono)', fontSize: '10px',
          color: 'var(--muted)', letterSpacing: '0.03em',
          padding: '2px 0',
        }}
      >
        Start without calibrating
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
          onClose={() => {
            setWizardMode(null)
            refreshSummary()
          }}
        />
      )}

      <div style={S.card}>
        <div style={S.subheading}>Calibration data</div>

        {/* Data tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px', marginBottom: '12px' }}>
          {[
            ['Yaw', yawStr],
            ['Pitch', pitchStr],
            ['EAR', thStr],
          ].map(([label, val]) => (
            <div key={label} style={S.metricTile}>
              <span style={S.metricLabel}>{label}</span>
              <span style={S.metricValue}>{val}</span>
            </div>
          ))}
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '10px', marginBottom: '12px', letterSpacing: '0.01em' }}>
          Last calibrated: {dateStr}
        </p>

        {!running && (
          <p style={{
            fontSize: '11px',
            color: 'var(--muted)',
            background: 'var(--surface-2)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '8px 10px',
            marginBottom: '12px',
          }}>
            Start the camera from Home first — calibration needs a live face feed.
          </p>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <button
            type="button"
            style={{ ...S.btn, ...S.btnPrimary, opacity: running ? 1 : 0.4 }}
            disabled={!running}
            onClick={() => setWizardMode('neutral_only')}
          >
            Neutral pose
          </button>
          <button
            type="button"
            style={{ ...S.btn, ...S.btnSecondary, opacity: running ? 1 : 0.4 }}
            disabled={!running}
            onClick={() => setWizardMode('blink_only')}
          >
            Blink detection
          </button>
          <button
            type="button"
            style={{ ...S.btn, ...S.btnSecondary, opacity: running ? 1 : 0.4 }}
            disabled={!running}
            onClick={() => setWizardMode('full')}
          >
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

  return (
    <>
      <div style={S.card}>
        <div style={S.subheading}>Gesture mapping</div>
        <div style={{ ...S.nav, marginBottom: '10px' }}>
          <button
            style={{ ...S.navBtn, ...(editingMode === 'player' ? S.navBtnActive : {}) }}
            onClick={() => setEditingMode('player')}
          >
            ▶ Player
          </button>
          <button
            style={{ ...S.navBtn, ...(editingMode === 'browse' ? S.navBtnActive : {}) }}
            onClick={() => setEditingMode('browse')}
          >
            ⊞ Browse
          </button>
        </div>
        {mappableGestures.map((g) => (
          <div key={g} style={S.gestureRow}>
            <span style={S.gestureLabel}>{GESTURE_LABELS[g] ?? g}</span>
            <div style={S.gestureSelect}>
              <select
                style={S.select}
                value={currentMap[g] ?? COMMANDS.NONE}
                onChange={(e) => handleGestureChange(g, e.target.value)}
              >
                {commandOptions.map((c) => (
                  <option key={c} value={c}>{labels[c] ?? COMMAND_LABELS[c] ?? c}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
      </div>

      <div style={S.card}>
        <div style={S.subheading}>Sensitivity</div>
        <select
          style={S.select}
          value={preset}
          onChange={handlePresetChange}
        >
          <option value="low">Low — large movements</option>
          <option value="medium">Medium (default)</option>
          <option value="high">High — small movements</option>
        </select>
      </div>

      {/* ── Smart features ── */}
      <div style={S.card}>
        <div style={S.subheading}>Smart features</div>

        {/* Auto-pause on no face */}
        <label style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '12px',
          cursor: 'pointer',
        }}>
          {/* Custom toggle pill */}
          <div style={{ position: 'relative', flexShrink: 0, marginTop: '2px' }}>
            <input
              type="checkbox"
              checked={autoPause}
              onChange={onAutoPauseToggle}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <div style={{
              width: '36px',
              height: '20px',
              borderRadius: '10px',
              background: autoPause ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s',
              position: 'relative',
            }}>
              <div style={{
                position: 'absolute',
                top: '3px',
                left: autoPause ? '19px' : '3px',
                width: '14px',
                height: '14px',
                borderRadius: '50%',
                background: autoPause ? '#0a0a0a' : 'var(--muted)',
                transition: 'left 0.2s, background 0.2s',
              }} />
            </div>
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
              Auto-pause when you leave
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--muted)', lineHeight: 1.5 }}>
              Pauses after 2 s with no face in frame. Resumes when you return.
            </div>
          </div>
        </label>

        <div style={{ height: '1px', background: 'var(--border)', margin: '12px 0' }} />

        {/* Refined landmarks toggle */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', cursor: 'pointer' }}>
          <div style={{ position: 'relative', flexShrink: 0, marginTop: '2px' }}>
            <input
              type="checkbox"
              checked={refineLandmarks}
              onChange={handleRefineLandmarksToggle}
              style={{ position: 'absolute', opacity: 0, width: 0, height: 0 }}
            />
            <div style={{
              width: '36px', height: '20px', borderRadius: '10px',
              background: refineLandmarks ? 'var(--accent)' : 'var(--border)',
              transition: 'background 0.2s', position: 'relative',
            }}>
              <div style={{
                position: 'absolute', top: '3px',
                left: refineLandmarks ? '19px' : '3px',
                width: '14px', height: '14px', borderRadius: '50%',
                background: refineLandmarks ? '#0a0a0a' : 'var(--muted)',
                transition: 'left 0.2s, background 0.2s',
              }} />
            </div>
          </div>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text)', marginBottom: '3px' }}>
              High-precision landmarks
            </div>
            <div style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--muted)', lineHeight: 1.5 }}>
              478-point mesh for more accurate eye tracking. Applies after reloading the YouTube tab.
            </div>
          </div>
        </label>
      </div>

      {/* ── Data management ── */}
      <div style={S.card}>
        <div style={S.subheading}>Data</div>
        <p style={{ fontSize: '12px', fontFamily: 'var(--font-ui)', color: 'var(--muted)', lineHeight: 1.5, marginBottom: '12px' }}>
          All data is stored locally. Nothing is sent to any server.
        </p>
        <button
          style={{
            ...S.btn,
            background: clearConfirm ? '#ef4444' : 'var(--surface-2)',
            color: clearConfirm ? '#fff' : '#ef4444',
            border: '1px solid #ef4444',
            transition: 'background 0.2s, color 0.2s',
          }}
          onClick={handleClearData}
        >
          {clearConfirm ? 'Tap again to confirm — this cannot be undone' : 'Clear all Nodex data'}
        </button>
      </div>

      <button
        style={{
          ...S.btn,
          ...(saved ? S.btnSecondary : S.btnPrimary),
          opacity: saved ? 0.75 : 1,
        }}
        onClick={handleSave}
      >
        {saved ? '✓ Saved' : 'Save settings'}
      </button>
    </>
  )
}
