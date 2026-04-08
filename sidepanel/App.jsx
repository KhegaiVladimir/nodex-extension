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
  saveCalibration,
  savePlayerGestureMap,
  saveBrowseGestureMap,
  saveSettings,
  loadPlayerGestureMap,
  loadBrowseGestureMap,
  loadSettings,
} from '../shared/storage.js'

/* ── helpers ── */

async function getActiveTabId() {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/*' })
  if (tabs.length > 0) return tabs[0].id

  const [tab] = await chrome.tabs.query({ active: true })
  return tab?.id ?? null
}

async function sendToContent(payload) {
  const tabId = await getActiveTabId()
  if (tabId == null) return
  chrome.runtime.sendMessage({
    type: MSG.SIDEPANEL_TO_CONTENT,
    tabId,
    inner: payload,
  }).catch(() => {})
}

const GESTURE_LABELS = {
  [GESTURES.HEAD_LEFT]:   '← Head Left',
  [GESTURES.HEAD_RIGHT]:  '→ Head Right',
  [GESTURES.HEAD_UP]:     '↑ Head Up',
  [GESTURES.HEAD_DOWN]:   '↓ Head Down',
  [GESTURES.TILT_LEFT]:   '↰ Tilt Left',
  [GESTURES.TILT_RIGHT]:  '↱ Tilt Right',
  [GESTURES.EYES_CLOSED]: '👁 Eyes Closed',
  [GESTURES.MOUTH_OPEN]:  '👄 Mouth Open',
}

const COMMAND_LABELS = {
  [COMMANDS.PLAY]:       '▶ Play',
  [COMMANDS.PAUSE]:      '⏸ Pause',
  [COMMANDS.PLAY_PAUSE]: '⏯ Play/Pause',
  [COMMANDS.VOL_UP]:     '🔊 Volume Up',
  [COMMANDS.VOL_DOWN]:   '🔉 Volume Down',
  [COMMANDS.MUTE]:       '🔇 Mute',
  [COMMANDS.REWIND]:     '⏪ Rewind',
  [COMMANDS.SKIP]:       '⏩ Skip',
  [COMMANDS.NEXT]:       '⏭ Next',
  [COMMANDS.PREV]:       '⏮ Previous',
  [COMMANDS.BACK]:       '↩ Back',
  [COMMANDS.NONE]:       '— None',
}

const BROWSE_COMMAND_LABELS = {
  [COMMANDS.REWIND]:     '← Left',
  [COMMANDS.SKIP]:       '→ Right',
  [COMMANDS.VOL_UP]:     '↑ Up',
  [COMMANDS.VOL_DOWN]:   '↓ Down',
  [COMMANDS.PLAY_PAUSE]: '✓ Select',
  [COMMANDS.BACK]:       '↩ Back',
  [COMMANDS.NONE]:       '— None',
}

const BROWSE_COMMANDS = [
  COMMANDS.REWIND, COMMANDS.SKIP,
  COMMANDS.VOL_UP, COMMANDS.VOL_DOWN,
  COMMANDS.PLAY_PAUSE, COMMANDS.BACK, COMMANDS.NONE,
]

const CALIBRATION_DURATION_MS = 3000
const CALIBRATION_FPS = 15

const TUTORIAL_GESTURES = [
  { label: 'Turn your head left',       gesture: GESTURES.HEAD_LEFT },
  { label: 'Turn your head right',      gesture: GESTURES.HEAD_RIGHT },
  { label: 'Tilt your head up',       gesture: GESTURES.HEAD_UP },
  { label: 'Close your eyes for 0.5s',   gesture: GESTURES.EYES_CLOSED },
]

/* ── styles ── */

const S = {
  app: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    minHeight: '100vh',
  },
  heading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: 700,
    color: 'var(--accent)',
    margin: 0,
  },
  subheading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text)',
    marginBottom: '8px',
  },
  card: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: '8px',
    padding: '14px',
  },
  btn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    fontWeight: 500,
    padding: '10px 0',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    width: '100%',
    transition: 'opacity 0.15s',
  },
  btnPrimary: {
    background: 'var(--accent)',
    color: '#0a0a0a',
  },
  btnSecondary: {
    background: 'var(--border)',
    color: 'var(--text)',
  },
  nav: {
    display: 'flex',
    gap: '6px',
  },
  navBtn: {
    flex: 1,
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    padding: '8px 0',
    border: '1px solid var(--border)',
    borderRadius: '6px',
    cursor: 'pointer',
    background: 'transparent',
    color: 'var(--muted)',
    transition: 'all 0.15s',
  },
  navBtnActive: {
    background: 'var(--accent)',
    color: '#0a0a0a',
    borderColor: 'var(--accent)',
  },
  metricRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 0',
    borderBottom: '1px solid var(--border)',
  },
  metricLabel: { color: 'var(--muted)', fontSize: '12px' },
  metricValue: { color: 'var(--accent)', fontWeight: 500 },
  select: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    background: 'var(--bg)',
    color: 'var(--text)',
    border: '1px solid var(--border)',
    borderRadius: '4px',
    padding: '4px 6px',
    width: '100%',
  },
  status: (running) => ({
    display: 'inline-block',
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: running ? '#4ade80' : '#ef4444',
    marginRight: '8px',
  }),
  progressBar: {
    width: '100%',
    height: '6px',
    background: 'var(--border)',
    borderRadius: '3px',
    overflow: 'hidden',
    marginTop: '12px',
  },
  progressFill: (pct) => ({
    width: `${pct}%`,
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.2s',
  }),
  gestureRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '8px',
    padding: '6px 0',
    borderBottom: '1px solid var(--border)',
  },
  gestureLabel: { fontSize: '12px', flex: '1 1 auto', whiteSpace: 'nowrap' },
  gestureSelect: { flex: '0 0 130px' },

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
    borderRadius: '12px',
    padding: '24px',
  },
  onboardTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '28px',
    fontWeight: 800,
    color: 'var(--accent)',
    margin: '0 0 4px',
  },
  onboardHeading: {
    fontFamily: 'var(--font-heading)',
    fontSize: '16px',
    fontWeight: 600,
    color: 'var(--text)',
    margin: '0 0 8px',
  },
  onboardSub: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    color: 'var(--text)',
    margin: '0 0 12px',
  },
  onboardText: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--muted)',
    lineHeight: 1.6,
    margin: '0 0 16px',
  },
  onboardNote: {
    fontFamily: 'var(--font-mono)',
    fontSize: '11px',
    color: 'var(--muted)',
    fontStyle: 'italic',
    lineHeight: 1.5,
    margin: '0 0 16px',
  },
  onboardBtn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 600,
    background: 'var(--accent)',
    color: '#0a0a0a',
    height: '48px',
    borderRadius: '12px',
    border: 'none',
    width: '100%',
    cursor: 'pointer',
    transition: 'opacity 0.15s',
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

/* ── useCalibration hook ── */

function useCalibration() {
  const [phase, setPhase] = useState('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState(null)
  const framesRef = useRef([])
  const doneRef = useRef(false)

  const startCalibration = useCallback(() => {
    setPhase('capturing')
    setProgress(0)
    setError(null)
    framesRef.current = []
    doneRef.current = false

    sendToContent({ type: MSG.CALIBRATION_START })

    const started = Date.now()

    const finalize = async () => {
      if (doneRef.current) return
      doneRef.current = true

      const frames = framesRef.current
      if (frames.length === 0) {
        setError('No frames for calibration.')
        setPhase('idle')
        return
      }

      const baseline = {
        yaw:   frames.reduce((s, f) => s + (f.yaw ?? 0), 0) / frames.length,
        pitch: frames.reduce((s, f) => s + (f.pitch ?? 0), 0) / frames.length,
        roll:  frames.reduce((s, f) => s + (f.roll ?? 0), 0) / frames.length,
        ear:   frames.reduce((s, f) => s + (f.ear ?? 0), 0) / frames.length,
      }

      try {
        await saveCalibration(baseline)
        await sendToContent({ type: MSG.SAVE_CALIBRATION, baseline })
        setPhase('done')
      } catch (err) {
        setError(`Save error: ${err.message}`)
        setPhase('idle')
      }
    }

    const listener = (message) => {
      if (message.type !== MSG.METRICS_UPDATE || !message.metrics) return

      framesRef.current.push(message.metrics)
      const elapsed = Date.now() - started
      setProgress(Math.min(100, (elapsed / CALIBRATION_DURATION_MS) * 100))

      if (elapsed >= CALIBRATION_DURATION_MS) {
        chrome.runtime.onMessage.removeListener(listener)
        finalize()
      }
    }

    chrome.runtime.onMessage.addListener(listener)

    setTimeout(() => {
      chrome.runtime.onMessage.removeListener(listener)
      if (framesRef.current.length > 0) finalize()
      else if (!doneRef.current) {
        setPhase('idle')
        setError('No metrics received. Make sure the engine is running.')
      }
    }, CALIBRATION_DURATION_MS + 1000)
  }, [])

  const reset = useCallback(() => {
    setPhase('idle')
    setProgress(0)
    setError(null)
  }, [])

  return { phase, progress, error, startCalibration, reset }
}

/* ── App ── */

export default function App() {
  const [onboarded, setOnboarded] = useState(null)
  const [screen, setScreen] = useState('main')
  const [running, setRunning] = useState(false)
  const [browseMode, setBrowseMode] = useState(false)
  const [modeChanging, setModeChanging] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [lastCommand, setLastCommand] = useState(null)

  useEffect(() => {
    loadSettings({}).then((settings) => {
      setOnboarded(settings.onboarding_complete === true)
    })
  }, [])

  useEffect(() => {
    const listener = (message) => {
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
      }
    }

    chrome.runtime.onMessage.addListener(listener)
    sendToContent({ type: MSG.REQUEST_STATUS })

    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  if (onboarded === null) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />
  }

  if (!onboarded) {
    return <OnboardingFlow onComplete={() => setOnboarded(true)} />
  }

  return (
    <div style={S.app}>
      <h1 style={S.heading}>Nodex</h1>

      <div style={S.nav}>
        {['main', 'calibration', 'settings'].map((s) => (
          <button
            key={s}
            style={{
              ...S.navBtn,
              ...(screen === s ? S.navBtnActive : {}),
            }}
            onClick={() => setScreen(s)}
          >
            {{ main: 'Home', calibration: 'Calibration', settings: 'Settings' }[s]}
          </button>
        ))}
      </div>

      {screen === 'main' && (
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
        />
      )}
      {screen === 'calibration' && <CalibrationScreen />}
      {screen === 'settings' && <SettingsScreen />}
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
    <div style={S.onboardWrap}>
      <div style={S.onboardCard}>
        <h1 style={S.onboardTitle}>Nodex</h1>
        <p style={S.onboardSub}>Control YouTube hands-free</p>
        <p style={S.onboardText}>
          Nodex uses your camera to track head and face movements.
          Head turns, tilts, eye closure — all become player commands.
        </p>
        <button style={S.onboardBtn} onClick={onNext}>
          Start setup →
        </button>
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

/* ── Step 3: Calibration ── */

function OnboardStep3({ onNext }) {
  const { phase, progress, error, startCalibration } = useCalibration()
  const [liveMetrics, setLiveMetrics] = useState(null)

  useEffect(() => {
    const listener = (message) => {
      if (message.type === MSG.METRICS_UPDATE && message.metrics) {
        setLiveMetrics(message.metrics)
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [])

  useEffect(() => {
    if (phase === 'done') {
      const timer = setTimeout(onNext, 1500)
      return () => clearTimeout(timer)
    }
  }, [phase, onNext])

  return (
    <div style={S.onboardWrap}>
      <div style={S.onboardCard}>
        <h2 style={S.onboardHeading}>Calibration</h2>
        <p style={S.onboardText}>
          Look straight into the camera. Keep your head still.
        </p>

        {liveMetrics && (
          <div style={{ display: 'flex', gap: '16px', margin: '0 0 12px' }}>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Yaw:{' '}
              <span style={{ color: 'var(--accent)' }}>
                {liveMetrics.yaw?.toFixed(1) ?? '—'}
              </span>
            </span>
            <span style={{ fontSize: '11px', color: 'var(--muted)' }}>
              Pitch:{' '}
              <span style={{ color: 'var(--accent)' }}>
                {liveMetrics.pitch?.toFixed(1) ?? '—'}
              </span>
            </span>
          </div>
        )}

        {phase === 'idle' && (
          <>
            {error && (
              <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>
                {error}
              </p>
            )}
            <button style={S.onboardBtn} onClick={startCalibration}>
              Start calibration (3 sec)
            </button>
          </>
        )}

        {phase === 'capturing' && (
          <>
            <p style={{ color: 'var(--accent)', fontSize: '12px' }}>
              Capturing… Keep your head still.
            </p>
            <div style={S.progressBar}>
              <div style={S.progressFill(progress)} />
            </div>
            <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '6px', textAlign: 'right' }}>
              {Math.round(progress)}%
            </p>
          </>
        )}

        {phase === 'done' && (
          <p style={{ color: '#4ade80', fontSize: '13px' }}>
            Calibration saved!
          </p>
        )}
      </div>
    </div>
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
    const listener = (message) => {
      if (message.type !== MSG.COMMAND_EXECUTED) return
      const g = message.gesture
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
    return () => chrome.runtime.onMessage.removeListener(listener)
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

function MainScreen({ running, browseMode, modeChanging, onModeToggle, metrics, lastCommand }) {
  const handleToggle = () => {
    sendToContent({ type: running ? MSG.STOP_ENGINE : MSG.START_ENGINE })
  }

  const cmdLabels = browseMode ? BROWSE_COMMAND_LABELS : COMMAND_LABELS

  return (
    <>
      <div style={S.card}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
          <span style={S.status(running)} />
          <span style={{ fontWeight: 500 }}>
            {running ? 'Engine running' : 'Engine stopped'}
          </span>
        </div>

        <button
          style={{ ...S.btn, ...(running ? S.btnSecondary : S.btnPrimary) }}
          onClick={handleToggle}
        >
          {running ? 'Stop' : 'Start'}
        </button>

        {running && (
          <button
            style={{
              ...S.btn,
              marginTop: '8px',
              background: browseMode ? 'var(--accent)' : 'var(--surface)',
              color: browseMode ? '#0a0a0a' : 'var(--text)',
              border: '1px solid var(--border)',
              opacity: modeChanging ? 0.5 : 1,
            }}
            onClick={onModeToggle}
            disabled={modeChanging}
          >
            {browseMode ? '▶️ Player' : '🔍 Browse'}
          </button>
        )}
      </div>

      {lastCommand && (
        <div style={S.card}>
          <div style={S.subheading}>Last command</div>
          <div style={{ fontSize: '16px', color: 'var(--accent)' }}>
            {cmdLabels[lastCommand.command] ?? COMMAND_LABELS[lastCommand.command] ?? lastCommand.command}
          </div>
          <div style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '4px' }}>
            {GESTURE_LABELS[lastCommand.gesture] ?? lastCommand.gesture}
          </div>
        </div>
      )}

      {metrics && (
        <div style={S.card}>
          <div style={S.subheading}>Metrics</div>
          {[
            ['Yaw', metrics.yaw],
            ['Pitch', metrics.pitch],
            ['Roll', metrics.roll],
            ['EAR', metrics.ear],
            ['Mouth', metrics.mouth],
          ].map(([label, val]) => (
            <div key={label} style={S.metricRow}>
              <span style={S.metricLabel}>{label}</span>
              <span style={S.metricValue}>
                {typeof val === 'number' ? val.toFixed(2) : '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

/* ── Calibration Screen ── */

function CalibrationScreen() {
  const { phase, progress, error, startCalibration, reset } = useCalibration()

  return (
    <div style={S.card}>
      <div style={S.subheading}>Neutral pose calibration</div>

      {phase === 'idle' && (
        <>
          <p style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '12px' }}>
            Look straight into the camera and tap the button. Hold a neutral head
            pose for 3 seconds.
          </p>
          {error && (
            <p style={{ color: '#ef4444', fontSize: '12px', marginBottom: '8px' }}>{error}</p>
          )}
          <button
            style={{ ...S.btn, ...S.btnPrimary }}
            onClick={startCalibration}
          >
            Start calibration
          </button>
        </>
      )}

      {phase === 'capturing' && (
        <>
          <p style={{ color: 'var(--accent)', fontSize: '12px' }}>
            Capturing… Keep your head still.
          </p>
          <div style={S.progressBar}>
            <div style={S.progressFill(progress)} />
          </div>
          <p style={{ color: 'var(--muted)', fontSize: '11px', marginTop: '6px', textAlign: 'right' }}>
            {Math.round(progress)}%
          </p>
        </>
      )}

      {phase === 'done' && (
        <>
          <p style={{ color: '#4ade80', fontSize: '13px', marginBottom: '12px' }}>
            Calibration saved!
          </p>
          <button
            style={{ ...S.btn, ...S.btnSecondary }}
            onClick={reset}
          >
            Repeat
          </button>
        </>
      )}
    </div>
  )
}

/* ── Settings Screen ── */

function SettingsScreen() {
  const [editingMode, setEditingMode] = useState('player')
  const [playerMap, setPlayerMap] = useState({ ...PLAYER_GESTURE_MAP })
  const [browseMap, setBrowseMap] = useState({ ...BROWSE_GESTURE_MAP })
  const [preset, setPreset] = useState('medium')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    ;(async () => {
      const pm = await loadPlayerGestureMap(PLAYER_GESTURE_MAP)
      const bm = await loadBrowseGestureMap(BROWSE_GESTURE_MAP)
      setPlayerMap(pm)
      setBrowseMap(bm)
      const settings = await loadSettings({ thresholds: DEFAULT_THRESHOLDS })
      const th = settings.thresholds ?? DEFAULT_THRESHOLDS
      for (const [key, val] of Object.entries(SENSITIVITY_PRESETS)) {
        if (val.yaw === th.yaw && val.pitch === th.pitch) {
          setPreset(key)
          break
        }
      }
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
            🔍 Browse
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

      <button
        style={{ ...S.btn, ...S.btnPrimary, opacity: saved ? 0.6 : 1 }}
        onClick={handleSave}
      >
        {saved ? 'Saved ✓' : 'Save settings'}
      </button>
    </>
  )
}
