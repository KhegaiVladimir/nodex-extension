import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MSG } from '../shared/constants/messages.js'
import { computeBlinkThreshold } from '../shared/utils/blinkCalibration.js'

/* ──────────────────────────────────────────────────────
   PURE MATH HELPERS  (unchanged)
────────────────────────────────────────────────────── */

/** @param {number[]} nums */
function medianOf(nums) {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** @param {number[]} nums */
function spread(nums) {
  if (nums.length === 0) return 0
  return Math.max(...nums) - Math.min(...nums)
}

/* ──────────────────────────────────────────────────────
   METRICS HOOK  (unchanged)
────────────────────────────────────────────────────── */

/**
 * @param {(msg: object) => void} sendToContent
 * @param {(msg: unknown) => boolean} shouldIgnoreSidePanelMessage
 */
export function useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage) {
  const [lastFrame, setLastFrame] = useState(/** @type {{ yaw: number, pitch: number, ear: number } | null} */ (null))

  useEffect(() => {
    const listener = (message) => {
      if (shouldIgnoreSidePanelMessage(message)) return
      if (message.type !== MSG.METRICS_FRAME) return
      if (
        typeof message.yaw   === 'number' &&
        typeof message.pitch === 'number' &&
        typeof message.ear   === 'number'
      ) {
        setLastFrame({ yaw: message.yaw, pitch: message.pitch, ear: message.ear })
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [shouldIgnoreSidePanelMessage])

  return lastFrame
}

/* ──────────────────────────────────────────────────────
   DESIGN TOKENS (shared with App.jsx token system)
────────────────────────────────────────────────────── */

const W = {
  /* Full-screen overlay */
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    padding: '20px 20px 28px',
    minHeight: '100vh',
    boxSizing: 'border-box',
    animation: 'soft-in 200ms cubic-bezier(0.2,0.8,0.2,1) both',
  },

  /* Step content area grows to push actions to bottom */
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    paddingTop: 24,
  },

  /* Bottom action area */
  actions: {
    marginTop: 'auto',
    paddingTop: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },

  /* Buttons */
  btn: (variant = 'primary') => ({
    width: '100%',
    height: 42,
    borderRadius: 10,
    fontSize: 13.5,
    fontWeight: 600,
    fontFamily: 'var(--font-ui)',
    cursor: 'pointer',
    transition: 'all 150ms cubic-bezier(0.2,0.8,0.2,1)',
    border: 'none',
    ...(variant === 'primary' ? {
      background: 'var(--accent)',
      color: 'var(--accent-ink)',
    } : variant === 'ghost' ? {
      background: 'var(--surface-3)',
      color: 'var(--text-2)',
      border: '1px solid var(--border-mid)',
    } : {
      background: 'transparent',
      color: 'var(--text-3)',
      border: '1px solid var(--border)',
    }),
  }),

  /* Info / hint card */
  hint: {
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 12,
    padding: '14px 16px',
  },

  /* Error card */
  errorCard: {
    background: 'var(--red-dim)',
    border: '1px solid rgba(208,72,72,0.25)',
    borderRadius: 10,
    padding: '12px 14px',
  },

  /* Warning card */
  warnCard: {
    background: 'var(--amber-dim)',
    border: '1px solid rgba(228,168,74,0.25)',
    borderRadius: 10,
    padding: '12px 14px',
    marginBottom: 14,
  },
}

/* Step metadata used in the header */
const STEP_META = {
  neutral: { title: 'Neutral pose',    desc: 'Hold your head still and look at the screen the way you normally watch video.' },
  open:    { title: 'Eyes open',       desc: 'Look at your screen normally and blink as you usually would. Sampling for 3 seconds.' },
  closed:  { title: 'Eyes closed',     desc: 'When prompted, gently close your eyes. A countdown will play.' },
  test:    { title: 'Test detection',  desc: 'Blink a few times to verify calibration. Adjust sensitivity if needed.' },
}

/* ──────────────────────────────────────────────────────
   STEP COMPONENTS  (logic identical, JSX updated)
────────────────────────────────────────────────────── */

function NeutralPoseStep({ sendToContent, shouldIgnoreSidePanelMessage, onComplete, onError }) {
  const [phase, setPhase] = useState(/** @type {'idle'|'collect'|'retry'} */ ('idle'))
  const lastFrame = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const yawRef   = useRef(/** @type {number[]} */ ([]))
  const pitchRef = useRef(/** @type {number[]} */ ([]))
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    if (phase !== 'collect' || !lastFrame) return
    yawRef.current.push(lastFrame.yaw)
    pitchRef.current.push(lastFrame.pitch)
  }, [phase, lastFrame])

  const start = useCallback(() => {
    setPhase('collect')
    yawRef.current = []
    pitchRef.current = []
    timerRef.current = setTimeout(() => {
      const ys = yawRef.current
      const ps = pitchRef.current
      if (ys.length < 5) {
        onError?.('Not enough samples. Is the camera running?')
        setPhase('retry')
        return
      }
      if (spread(ys) >= 8 || spread(ps) >= 8) {
        setPhase('retry')
        return
      }
      onComplete({ yawBaseline: medianOf(ys), pitchBaseline: medianOf(ps) })
    }, 2000)
  }, [onComplete, onError])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Crosshair visual hint */}
      <div style={{
        position: 'relative',
        height: 120,
        borderRadius: 12,
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
      }}>
        {/* dot grid */}
        <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.35 }}>
          <defs>
            <pattern id="w-dots" width="14" height="14" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="0.6" fill="var(--text-3)" opacity="0.3"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#w-dots)"/>
        </svg>
        {/* guide circle */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '1px solid var(--accent)',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.06), transparent 70%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{
            width: 8, height: 8, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 8px rgba(var(--accent-rgb),0.5)',
            animation: phase === 'collect' ? 'pose-breathe 3s ease-in-out infinite' : 'none',
          }}/>
        </div>
        <span style={{
          position: 'absolute', top: 9, left: 12,
          fontSize: 10, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
        }}>POSE</span>
      </div>

      {phase === 'retry' && (
        <div style={W.warnCard}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--amber)', marginBottom: 2 }}>
            Too much movement
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.5 }}>
            Head movement exceeded 8°. Try to hold still and tap Start again.
          </div>
        </div>
      )}

      {phase === 'collect' ? (
        <div style={{ ...W.hint, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
            Hold still… 2 seconds
          </span>
        </div>
      ) : (
        <button type="button" style={W.btn('primary')} onClick={start}>
          {phase === 'retry' ? 'Try again' : 'Start capture'}
        </button>
      )}
    </div>
  )
}

function EyesOpenStep({ sendToContent, shouldIgnoreSidePanelMessage, onComplete, onError }) {
  const lastFrame   = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const earsRef     = useRef(/** @type {number[]} */ ([]))
  const doneRef     = useRef(false)
  const onCompleteRef = useRef(onComplete)
  const onErrorRef    = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current    = onError

  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    earsRef.current = []
    doneRef.current = false
    const start = Date.now()
    const tick = setInterval(() => setElapsed(Math.min(1, (Date.now() - start) / 3000)), 80)
    const t = setTimeout(() => {
      clearInterval(tick)
      if (doneRef.current) return
      doneRef.current = true
      const arr = earsRef.current
      if (arr.length < 30) {
        onErrorRef.current?.('Camera not responding, please reload extension')
        return
      }
      onCompleteRef.current({ openSamples: arr })
    }, 3000)
    return () => { clearInterval(tick); clearTimeout(t) }
  }, []) // logic runs once — callbacks via refs

  useEffect(() => {
    if (!lastFrame || doneRef.current) return
    earsRef.current.push(lastFrame.ear)
  }, [lastFrame])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Eye visualization */}
      <div style={{
        height: 100,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        {[0, 1].map(i => (
          <svg key={i} width="44" height="28" viewBox="0 0 44 28" fill="none">
            <ellipse cx="22" cy="14" rx="20" ry="12"
              stroke="var(--text-2)" strokeWidth="1.5" fill="none"/>
            <circle cx="22" cy="14" r="7"
              fill="var(--accent)" opacity="0.15"/>
            <circle cx="22" cy="14" r="5"
              stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
            <circle cx="24" cy="12" r="1.5" fill="var(--accent)" opacity="0.8"/>
          </svg>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div style={{
          height: 4, borderRadius: 999,
          background: 'var(--surface-3)', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%',
            width: `${elapsed * 100}%`,
            background: 'var(--accent)',
            borderRadius: 999,
            transition: 'width 80ms linear',
          }}/>
        </div>
        <div style={{
          marginTop: 8, fontSize: 11.5,
          color: 'var(--text-3)', fontFamily: 'var(--font-mono)',
          letterSpacing: '0.04em',
        }}>
          Sampling {Math.round(elapsed * 3 * 10) / 10}s / 3s
        </div>
      </div>

      <div style={W.hint}>
        <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
          Stay relaxed — blink normally. No need to stare at the camera.
        </div>
      </div>
    </div>
  )
}

function speakCloseEyesCountdown() {
  const u = (text) => {
    const x = new SpeechSynthesisUtterance(text)
    x.lang = 'en-US'; x.rate = 1
    window.speechSynthesis.speak(x)
  }
  u('Close your eyes.')
  window.setTimeout(() => u('Three'), 700)
  window.setTimeout(() => u('Two'),   1400)
  window.setTimeout(() => u('One'),   2100)
  window.setTimeout(() => u('Open'),  2800)
}

function EyesClosedStep({ sendToContent, shouldIgnoreSidePanelMessage, openSamples, onComplete, onRetryClosed }) {
  const [phase, setPhase] = useState(/** @type {'idle'|'collect'|'fail'} */ ('idle'))
  const [failReason, setFailReason] = useState(/** @type {string | null} */ (null))
  const lastFrame = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const earsRef   = useRef(/** @type {number[]} */ ([]))
  const timerRef  = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  useEffect(() => {
    if (phase !== 'collect' || !lastFrame) return
    earsRef.current.push(lastFrame.ear)
  }, [phase, lastFrame])

  const startClosed = useCallback(() => {
    setFailReason(null)
    earsRef.current = []
    setPhase('collect')
    speakCloseEyesCountdown()
    timerRef.current = setTimeout(() => {
      const closedSamples = earsRef.current
      const result = computeBlinkThreshold(openSamples, closedSamples)
      if (!result.ok) {
        setFailReason(
          result.reason === 'insufficient_range'
            ? 'Not enough separation between open and closed. Try closing your eyes more fully.'
            : 'Calibration failed. Please retry.'
        )
        setPhase('fail')
        return
      }
      onComplete({ earCalibration: result })
    }, 3000)
  }, [openSamples, onComplete])

  if (phase === 'fail') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={W.errorCard}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--red)', marginBottom: 4 }}>
            Calibration failed
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', lineHeight: 1.55 }}>
            {failReason}
          </div>
        </div>
        <div style={W.hint}>
          <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
            Close your eyes gently — don't squint or scrunch. Listen for the countdown.
          </div>
        </div>
        <button
          type="button"
          style={W.btn('primary')}
          onClick={() => { setPhase('idle'); onRetryClosed?.() }}
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Eye visualization */}
      <div style={{
        height: 100,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
      }}>
        {[0, 1].map(i => (
          <svg key={i} width="44" height="28" viewBox="0 0 44 28" fill="none">
            {phase === 'collect' ? (
              /* closed eye */
              <path d="M2 14 C12 6 32 6 42 14" stroke="var(--text-2)" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
            ) : (
              /* open eye, dimmed */
              <>
                <ellipse cx="22" cy="14" rx="20" ry="12"
                  stroke="var(--border-mid)" strokeWidth="1.5" fill="none"/>
                <circle cx="22" cy="14" r="5"
                  stroke="var(--border-mid)" strokeWidth="1.5" fill="none"/>
              </>
            )}
          </svg>
        ))}
      </div>

      {phase === 'collect' ? (
        <div style={{ ...W.hint, display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
          </svg>
          <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 500 }}>
            Listen for the countdown…
          </span>
        </div>
      ) : (
        <>
          <div style={W.hint}>
            <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.55 }}>
              Close your eyes gently when prompted — don't squint. A voice countdown will play.
            </div>
          </div>
          <button type="button" style={W.btn('primary')} onClick={startClosed}>
            Close eyes now
          </button>
        </>
      )}
    </div>
  )
}

function TestStep({ calibration, sendToContent, shouldIgnoreSidePanelMessage, onFinish }) {
  const [count, setCount] = useState(0)
  const [display, setDisplay] = useState(calibration)

  useEffect(() => { setDisplay(calibration) }, [calibration])

  useEffect(() => {
    chrome.storage.local.get('earCalibration').then(({ earCalibration }) => {
      if (earCalibration?.threshold != null) setDisplay(earCalibration)
    })
    const onCh = (ch, area) => {
      if (area !== 'local' || !ch.earCalibration?.newValue) return
      setDisplay(ch.earCalibration.newValue)
    }
    chrome.storage.onChanged.addListener(onCh)
    return () => chrome.storage.onChanged.removeListener(onCh)
  }, [])

  useEffect(() => {
    // Pass calibration immediately so GestureEngine uses the right threshold during test
    sendToContent({ type: MSG.WIZARD_ENTER_TEST, earCalibration: calibration })
    const listener = (message) => {
      if (shouldIgnoreSidePanelMessage(message)) return
      if (message.type === MSG.BLINK_DETECTED) setCount(c => c + 1)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [sendToContent, shouldIgnoreSidePanelMessage, calibration])

  const nudge = (delta) => { sendToContent({ type: MSG.BLINK_THRESHOLD_ADJUST, delta }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Blink counter */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 12, padding: '20px 16px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      }}>
        <div style={{
          fontSize: 48, fontWeight: 700, lineHeight: 1,
          color: count > 0 ? 'var(--accent)' : 'var(--text-3)',
          fontFamily: 'var(--font-mono)',
          transition: 'color 200ms',
        }}>{count}</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)' }}>blinks detected</div>
        {display && (
          <div style={{
            marginTop: 4, fontSize: 11, color: 'var(--text-3)',
            fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
          }}>
            threshold {display.threshold?.toFixed(3) ?? '—'}
          </div>
        )}
      </div>

      {/* Sensitivity nudge */}
      <div>
        <div style={{
          fontSize: 11.5, color: 'var(--text-3)', marginBottom: 8,
          fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', textTransform: 'uppercase',
        }}>Adjust sensitivity</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" style={{ ...W.btn('ghost'), flex: 1 }} onClick={() => nudge(-0.03)}>
            Less sensitive
          </button>
          <button type="button" style={{ ...W.btn('ghost'), flex: 1 }} onClick={() => nudge(0.03)}>
            More sensitive
          </button>
        </div>
      </div>

      <button type="button" style={W.btn('primary')} onClick={onFinish}>
        Looks good
      </button>
    </div>
  )
}

function SuccessFlash({ onDone }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])

  return (
    <div style={{
      ...W.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      textAlign: 'center',
      gap: 0,
    }}>
      {/* Checkmark circle */}
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(74,222,128,0.12)',
        border: '1px solid rgba(74,222,128,0.25)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
          stroke="var(--green)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </div>

      <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
        Calibration complete
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55, maxWidth: 220, marginBottom: 28 }}>
        Your settings have been saved. Nodex is ready.
      </div>

      <button type="button" style={{ ...W.btn('primary'), maxWidth: 200 }} onClick={onDone}>
        Done
      </button>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   WIZARD SHELL  (logic unchanged, layout updated)
────────────────────────────────────────────────────── */

/**
 * @param {object} props
 * @param {'full' | 'neutral_only' | 'blink_only'} props.mode
 * @param {(inner: object) => void} props.sendToContent
 * @param {(m: unknown) => boolean} props.shouldIgnoreSidePanelMessage
 * @param {() => void} props.onClose
 */
export default function CalibrationWizard({ mode, sendToContent, shouldIgnoreSidePanelMessage, onClose }) {
  const steps =
    mode === 'full'         ? ['neutral', 'open', 'closed', 'test'] :
    mode === 'neutral_only' ? ['neutral']                            :
                              ['open', 'closed', 'test']

  const [stepIndex, setStepIndex]   = useState(0)
  const [wizardData, setWizardData] = useState(
    /** @type {{ yawBaseline?: number, pitchBaseline?: number, openSamples?: number[], earCalibration?: object }} */ ({})
  )
  const [success, setSuccess]   = useState(false)
  const [neutralErr, setNeutralErr] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    sendToContent({ type: MSG.WIZARD_START, mode })
    return () => { sendToContent({ type: MSG.WIZARD_CANCEL }) }
  }, [mode, sendToContent])

  const totalSteps = steps.length
  const key        = steps[stepIndex]
  const meta       = STEP_META[key] ?? { title: '', desc: '' }

  const finishWizard = useCallback((payload) => {
    sendToContent({ type: MSG.CALIBRATION_COMPLETE, ...payload })
    setSuccess(true)
  }, [sendToContent])

  const handleFinalFinish = useCallback(() => {
    const p = {}
    if (mode === 'full' || mode === 'neutral_only') {
      if (wizardData.yawBaseline   != null) p.yawBaseline   = wizardData.yawBaseline
      if (wizardData.pitchBaseline != null) p.pitchBaseline = wizardData.pitchBaseline
    }
    if (mode === 'full' || mode === 'blink_only') {
      if (wizardData.earCalibration) p.earCalibration = wizardData.earCalibration
    }
    finishWizard(p)
  }, [finishWizard, mode, wizardData])

  const cancel = () => {
    sendToContent({ type: MSG.WIZARD_CANCEL })
    onClose()
  }

  if (success) return <SuccessFlash onDone={onClose}/>

  return (
    <div style={W.overlay}>

      {/* ── Top bar: cancel + progress dots ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <button
          type="button"
          onClick={cancel}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13, color: 'var(--text-2)', padding: '4px 0',
            transition: 'color 150ms',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 5l-7 7 7 7"/>
          </svg>
          Cancel
        </button>

        {/* Step dots */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {steps.map((_, i) => (
            <div key={i} style={{
              width: i === stepIndex ? 16 : 6,
              height: 6, borderRadius: 999,
              background: i <= stepIndex ? 'var(--accent)' : 'var(--surface-3)',
              transition: 'all 250ms cubic-bezier(0.2,0.8,0.2,1)',
            }}/>
          ))}
        </div>

        {/* Step counter */}
        <span style={{
          fontSize: 11.5, color: 'var(--text-3)',
          fontFamily: 'var(--font-mono)', letterSpacing: '0.04em',
        }}>
          {stepIndex + 1}/{totalSteps}
        </span>
      </div>

      {/* ── Step heading ── */}
      <div style={{ marginBottom: 4 }}>
        <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text)', marginBottom: 6 }}>
          {meta.title}
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.55 }}>
          {meta.desc}
        </div>
      </div>

      {/* ── Step content ── */}
      <div style={W.body}>
        {key === 'neutral' && (
          <NeutralPoseStep
            sendToContent={sendToContent}
            shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
            onError={(msg) => setNeutralErr(msg)}
            onComplete={(d) => {
              setNeutralErr(null)
              setWizardData(w => ({ ...w, ...d }))
              if (mode === 'neutral_only') {
                finishWizard({ yawBaseline: d.yawBaseline, pitchBaseline: d.pitchBaseline })
              } else {
                setStepIndex(i => i + 1)
              }
            }}
          />
        )}

        {key === 'open' && (
          <EyesOpenStep
            sendToContent={sendToContent}
            shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
            onError={(msg) => alert(msg)}
            onComplete={(d) => {
              setWizardData(w => ({ ...w, ...d }))
              setStepIndex(i => i + 1)
            }}
          />
        )}

        {key === 'closed' && (
          <EyesClosedStep
            sendToContent={sendToContent}
            shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
            openSamples={wizardData.openSamples ?? []}
            onComplete={(d) => {
              setWizardData(w => ({ ...w, ...d }))
              setStepIndex(i => i + 1)
            }}
            onRetryClosed={() => {}}
          />
        )}

        {key === 'test' && wizardData.earCalibration && (
          <TestStep
            calibration={wizardData.earCalibration}
            sendToContent={sendToContent}
            shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
            onFinish={handleFinalFinish}
          />
        )}

        {/* Neutral pose camera error */}
        {neutralErr && (
          <div style={{ ...W.errorCard, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: 'var(--red)' }}>{neutralErr}</div>
          </div>
        )}
      </div>
    </div>
  )
}
