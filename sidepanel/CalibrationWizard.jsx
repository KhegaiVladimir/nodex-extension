import React, { useState, useEffect, useCallback, useRef } from 'react'
import { MSG } from '../shared/constants/messages.js'
import { computeBlinkThreshold } from '../shared/utils/blinkCalibration.js'

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
        typeof message.yaw === 'number' &&
        typeof message.pitch === 'number' &&
        typeof message.ear === 'number'
      ) {
        setLastFrame({ yaw: message.yaw, pitch: message.pitch, ear: message.ear })
      }
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [shouldIgnoreSidePanelMessage])

  return lastFrame
}

const WIZARD_STYLE = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 1000,
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px',
    minHeight: '100vh',
    boxSizing: 'border-box',
  },
  progress: {
    fontFamily: 'var(--font-mono)',
    fontSize: '12px',
    color: 'var(--muted)',
    marginBottom: '8px',
  },
  bar: {
    height: '4px',
    background: 'var(--border)',
    borderRadius: '2px',
    marginBottom: '16px',
    overflow: 'hidden',
  },
  barFill: (pct) => ({
    height: '100%',
    width: `${pct}%`,
    background: 'var(--accent)',
    transition: 'width 0.2s',
  }),
  actions: {
    marginTop: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    paddingTop: '16px',
  },
  btn: {
    fontFamily: 'var(--font-mono)',
    fontSize: '14px',
    fontWeight: 600,
    padding: '12px',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    width: '100%',
  },
  primary: { background: 'var(--accent)', color: '#0a0a0a' },
  ghost: { background: 'var(--border)', color: 'var(--text)' },
}

/**
 * @param {object} p
 * @param {(inner: object) => void} p.sendToContent
 * @param {(m: unknown) => boolean} p.shouldIgnoreSidePanelMessage
 * @param {'full' | 'neutral_only' | 'blink_only'} p.mode
 * @param {() => void} p.onClose
 * @param {(payload: object) => void} p.onFinish
 */
function NeutralPoseStep({ sendToContent, shouldIgnoreSidePanelMessage, onComplete, onError }) {
  const [phase, setPhase] = useState(/** @type {'idle'|'collect'|'retry'} */ ('idle'))
  const lastFrame = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const yawRef = useRef(/** @type {number[]} */ ([]))
  const pitchRef = useRef(/** @type {number[]} */ ([]))
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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
      const sy = spread(ys)
      const sp = spread(ps)
      if (sy >= 8 || sp >= 8) {
        setPhase('retry')
        return
      }
      onComplete({ yawBaseline: medianOf(ys), pitchBaseline: medianOf(ps) })
    }, 2000)
  }, [onComplete, onError])

  return (
    <div>
      <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--text)', marginBottom: '12px' }}>
        Hold your head still. Look at the screen the way you normally watch video.
      </p>
      {phase === 'retry' && (
        <p style={{ color: '#f59e0b', fontSize: '13px', marginBottom: '8px' }}>
          Try to keep your head still (movement &gt; 8°). Tap Start again.
        </p>
      )}
      {phase === 'idle' || phase === 'retry' ? (
        <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.primary }} onClick={start}>
          Start
        </button>
      ) : (
        <p style={{ color: 'var(--accent)', fontSize: '14px' }}>Hold still… 2s</p>
      )}
    </div>
  )
}

function EyesOpenStep({ sendToContent, shouldIgnoreSidePanelMessage, onComplete, onError }) {
  const lastFrame = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const earsRef = useRef(/** @type {number[]} */ ([]))
  const doneRef = useRef(false)
  // Refs so the timer closure always calls the latest callbacks without being a dep.
  const onCompleteRef = useRef(onComplete)
  const onErrorRef = useRef(onError)
  onCompleteRef.current = onComplete
  onErrorRef.current = onError

  useEffect(() => {
    earsRef.current = []
    doneRef.current = false
    const t = setTimeout(() => {
      if (doneRef.current) return
      doneRef.current = true
      const arr = earsRef.current
      if (arr.length < 30) {
        onErrorRef.current?.('Camera not responding, please reload extension')
        return
      }
      onCompleteRef.current({ openSamples: arr })
    }, 3000)
    return () => clearTimeout(t)
  }, []) // run once on mount — callbacks accessed via refs

  useEffect(() => {
    if (!lastFrame || doneRef.current) return
    earsRef.current.push(lastFrame.ear)
  }, [lastFrame])

  return (
    <div>
      <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--text)', marginBottom: '12px' }}>
        Look at your screen normally, blink as you usually would. Sampling… 3s
      </p>
      <p style={{ color: 'var(--muted)', fontSize: '12px' }}>Stay relaxed — no need to stare at the camera.</p>
    </div>
  )
}

/**
 * Timed voice cues ~2s from first instruction to &quot;open&quot;.
 */
function speakCloseEyesCountdown() {
  const u = (text) => {
    const x = new SpeechSynthesisUtterance(text)
    x.lang = 'en-US'
    x.rate = 1
    window.speechSynthesis.speak(x)
  }
  u('Close your eyes.')
  window.setTimeout(() => u('Three'), 700)
  window.setTimeout(() => u('Two'), 1400)
  window.setTimeout(() => u('One'), 2100)
  window.setTimeout(() => u('Open'), 2800)
}

function EyesClosedStep({ sendToContent, shouldIgnoreSidePanelMessage, openSamples, onComplete, onRetryClosed }) {
  const [phase, setPhase] = useState(/** @type {'idle'|'collect'|'fail'} */ ('idle'))
  const [failReason, setFailReason] = useState(/** @type {string | null} */ (null))
  const lastFrame = useMetricsFrames(sendToContent, shouldIgnoreSidePanelMessage)
  const earsRef = useRef(/** @type {number[]} */ ([]))
  const timerRef = useRef(/** @type {ReturnType<typeof setTimeout> | null} */ (null))

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

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
        setFailReason(result.reason === 'insufficient_range' ? 'Not enough separation between open and closed. Retry.' : 'Calibration failed.')
        setPhase('fail')
        return
      }
      onComplete({ earCalibration: result })
    }, 3000)
  }, [openSamples, onComplete])

  if (phase === 'fail') {
    return (
      <div>
        <p style={{ color: '#ef4444', fontSize: '14px', marginBottom: '12px' }}>{failReason}</p>
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          Gently close your eyes — don&apos;t squint. Try again.
        </p>
        <button
          type="button"
          style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.primary }}
          onClick={() => {
            setPhase('idle')
            onRetryClosed?.()
          }}
        >
          Retry closed-eye step
        </button>
      </div>
    )
  }

  return (
    <div>
      <p style={{ fontSize: '15px', lineHeight: 1.5, color: 'var(--text)', marginBottom: '12px' }}>
        {`Gently close your eyes — don't squint.`}
      </p>
      {phase === 'idle' && (
        <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.primary, fontSize: '18px' }} onClick={startClosed}>
          Close eyes now
        </button>
      )}
      {phase === 'collect' && (
        <p style={{ color: 'var(--accent)', fontSize: '14px' }}>Listen for the countdown…</p>
      )}
    </div>
  )
}

/**
 * @param {object} p
 * @param {object | null} p.calibration earCalibration
 */
function TestStep({ calibration, sendToContent, shouldIgnoreSidePanelMessage, onFinish }) {
  const [count, setCount] = useState(0)
  const [display, setDisplay] = useState(calibration)

  useEffect(() => {
    setDisplay(calibration)
  }, [calibration])

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
    // Pass the freshly computed calibration so GestureEngine uses the right
    // threshold immediately — without this, first-run detection falls back to
    // 0.14 and the counter stays at 0 for most users.
    sendToContent({ type: MSG.WIZARD_ENTER_TEST, earCalibration: calibration })
    const listener = (message) => {
      if (shouldIgnoreSidePanelMessage(message)) return
      if (message.type === MSG.BLINK_DETECTED) setCount((c) => c + 1)
    }
    chrome.runtime.onMessage.addListener(listener)
    return () => chrome.runtime.onMessage.removeListener(listener)
  }, [sendToContent, shouldIgnoreSidePanelMessage, calibration])

  const nudge = (delta) => {
    sendToContent({ type: MSG.BLINK_THRESHOLD_ADJUST, delta })
  }

  return (
    <div>
      <p style={{ fontSize: '14px', color: 'var(--text)', marginBottom: '8px' }}>
        Blinks detected: <strong>{count}</strong>
      </p>
      {display && (
        <p style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '12px' }}>
          Threshold: <strong style={{ color: 'var(--accent)' }}>{display.threshold?.toFixed(3) ?? '—'}</strong>
        </p>
      )}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.ghost, flex: 1 }} onClick={() => nudge(-0.03)}>
          Less sensitive
        </button>
        <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.ghost, flex: 1 }} onClick={() => nudge(0.03)}>
          More sensitive
        </button>
      </div>
      <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.primary }} onClick={onFinish}>
        Looks good
      </button>
    </div>
  )
}

function SuccessFlash({ onDone }) {
  // Auto-dismiss after 2.5 s so the user has time to read the screen,
  // but the Done button lets them exit immediately if they're ready.
  useEffect(() => {
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <div style={{ ...WIZARD_STYLE.overlay, justifyContent: 'center', alignItems: 'center', textAlign: 'center', gap: '0px' }}>
      <div style={{ fontSize: '64px', color: '#4ade80' }}>✓</div>
      <p style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text)', marginTop: '12px', marginBottom: '24px' }}>
        Calibration successful! Your settings are saved.
      </p>
      <button
        type="button"
        style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.primary, maxWidth: '200px' }}
        onClick={onDone}
      >
        Done →
      </button>
    </div>
  )
}

/**
 * @param {object} props
 * @param {'full' | 'neutral_only' | 'blink_only'} props.mode
 * @param {(inner: object) => void} props.sendToContent
 * @param {(m: unknown) => boolean} props.shouldIgnoreSidePanelMessage
 * @param {() => void} props.onClose
 */
export default function CalibrationWizard({ mode, sendToContent, shouldIgnoreSidePanelMessage, onClose }) {
  const steps =
    mode === 'full'
      ? ['neutral', 'open', 'closed', 'test']
      : mode === 'neutral_only'
        ? ['neutral']
        : ['open', 'closed', 'test']

  const [stepIndex, setStepIndex] = useState(0)
  const [wizardData, setWizardData] = useState(
    /** @type {{ yawBaseline?: number, pitchBaseline?: number, openSamples?: number[], earCalibration?: object }} */ ({}),
  )
  const [success, setSuccess] = useState(false)
  const [neutralErr, setNeutralErr] = useState(/** @type {string | null} */ (null))

  useEffect(() => {
    sendToContent({ type: MSG.WIZARD_START, mode })
    return () => {
      sendToContent({ type: MSG.WIZARD_CANCEL })
    }
  }, [mode, sendToContent])

  const totalSteps = steps.length
  const pct = ((stepIndex + 1) / totalSteps) * 100

  const finishWizard = useCallback(
    (payload) => {
      sendToContent({ type: MSG.CALIBRATION_COMPLETE, ...payload })
      setSuccess(true)
    },
    [sendToContent],
  )

  const handleFinalFinish = useCallback(() => {
    const p = {}
    if (mode === 'full' || mode === 'neutral_only') {
      if (wizardData.yawBaseline != null) p.yawBaseline = wizardData.yawBaseline
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

  if (success) {
    return <SuccessFlash onDone={onClose} />
  }

  const key = steps[stepIndex]

  return (
    <div style={WIZARD_STYLE.overlay}>
      <div style={WIZARD_STYLE.progress}>
        Step {stepIndex + 1} of {totalSteps}
      </div>
      <div style={WIZARD_STYLE.bar}>
        <div style={WIZARD_STYLE.barFill(pct)} />
      </div>

      {key === 'neutral' && (
        <NeutralPoseStep
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          onError={(msg) => {
            setNeutralErr(msg)
          }}
          onComplete={(d) => {
            setNeutralErr(null)
            setWizardData((w) => ({ ...w, ...d }))
            if (mode === 'neutral_only') {
              finishWizard({ yawBaseline: d.yawBaseline, pitchBaseline: d.pitchBaseline })
            } else {
              setStepIndex((i) => i + 1)
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
            setWizardData((w) => ({ ...w, ...d }))
            setStepIndex((i) => i + 1)
          }}
        />
      )}

      {key === 'closed' && (
        <EyesClosedStep
          sendToContent={sendToContent}
          shouldIgnoreSidePanelMessage={shouldIgnoreSidePanelMessage}
          openSamples={wizardData.openSamples ?? []}
          onComplete={(d) => {
            setWizardData((w) => ({ ...w, ...d }))
            setStepIndex((i) => i + 1)
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

      <div style={WIZARD_STYLE.actions}>
        <button type="button" style={{ ...WIZARD_STYLE.btn, ...WIZARD_STYLE.ghost }} onClick={cancel}>
          Cancel
        </button>
      </div>
      {neutralErr && <p style={{ color: '#ef4444', fontSize: '12px' }}>{neutralErr}</p>}
    </div>
  )
}
