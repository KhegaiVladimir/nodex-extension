// Calibration Wizard — full-screen onboarding-style flow.
// Steps: neutral → eyes open → eyes closed → test → success
const { useState: useStateCW, useEffect: useEffectCW, useRef: useRefCW, useCallback: useCallbackCW } = React;

// ---- Shell ----
const WizShell = ({ step, total, label, onBack, onClose, children, primaryLabel, onPrimary, primaryDisabled, footer }) => (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
    display: 'grid', placeItems: 'center',
    animation: 'fade-in 200ms var(--ease-out)',
    padding: 20,
  }}>
    <div style={{
      width: '100%', maxWidth: 480,
      background: 'var(--surface)',
      border: '1px solid var(--border-mid)',
      borderRadius: 18,
      padding: '22px 28px 22px',
      boxShadow: 'var(--shadow-card)',
      display: 'flex', flexDirection: 'column',
      maxHeight: 'calc(100vh - 40px)',
      minHeight: 560,
      animation: 'soft-in 240ms var(--ease-out)',
    }}>
      {/* Top row: back + progress dots + close */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
        <button onClick={onBack} disabled={!onBack} style={{
          width: 28, height: 28, borderRadius: 7,
          color: onBack ? 'var(--text-2)' : 'var(--text-3)',
          opacity: onBack ? 1 : 0.35,
          display: 'grid', placeItems: 'center',
          cursor: onBack ? 'pointer' : 'default',
        }}><IconArrowLeft size={14}/></button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
          {Array.from({ length: total }).map((_, i) => (
            <div key={i} style={{
              height: 4,
              width: i === step ? 22 : 4,
              background: i === step ? 'var(--accent)' : i < step ? 'var(--text-2)' : 'var(--surface-4)',
              borderRadius: 999,
              transition: 'all 280ms var(--ease-out)',
            }}/>
          ))}
        </div>
        <button onClick={onClose} style={{
          width: 28, height: 28, borderRadius: 7,
          color: 'var(--text-3)',
          display: 'grid', placeItems: 'center',
        }}><IconClose size={13}/></button>
      </div>

      {/* Content */}
      <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fade-in 220ms var(--ease-out)' }}>
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
          STEP {step+1} OF {total} — {label}
        </div>
        {children}
      </div>

      {/* Primary button */}
      {onPrimary && (
        <button onClick={onPrimary} disabled={primaryDisabled} style={{
          marginTop: 16, height: 48, borderRadius: 11,
          background: primaryDisabled ? 'var(--surface-3)' : 'var(--accent)',
          color: primaryDisabled ? 'var(--text-3)' : 'var(--accent-ink)',
          fontWeight: 500, fontSize: 14,
          cursor: primaryDisabled ? 'default' : 'pointer',
        }}>{primaryLabel}</button>
      )}
      {footer}
    </div>
  </div>
);

const WizTitle = ({ children }) => (
  <h1 style={{ margin: '0 0 10px', fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.15, color: 'var(--text)' }}>{children}</h1>
);
const WizDesc = ({ children }) => (
  <p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text-2)' }}>{children}</p>
);

const StatusRow = ({ state = 'idle', children }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 16, minWidth: 0 }}>
    <StatusDot state={state}/>
    <span style={{ fontSize: 13, color: state === 'active' ? 'var(--accent)' : state === 'warning' ? 'var(--amber)' : 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flex: 1 }}>{children}</span>
  </div>
);

// ---- Step 1: Neutral pose ----
const StepNeutralCW = ({ onComplete }) => {
  const [phase, setPhase] = useStateCW('idle'); // idle | collect
  const [prog, setProg] = useStateCW(0);
  const [yaw, setYaw] = useStateCW(0);
  const [pitch, setPitch] = useStateCW(0);
  useEffectCW(() => {
    const id = setInterval(() => {
      setYaw((Math.random() - 0.5) * 1.8);
      setPitch((Math.random() - 0.5) * 1.4);
    }, 140);
    return () => clearInterval(id);
  }, []);

  const start = () => {
    setPhase('collect'); setProg(0);
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 2000);
      setProg(p);
      if (p < 1) requestAnimationFrame(tick);
      else onComplete({ yawBaseline: -0.2, pitchBaseline: 1.1 });
    };
    requestAnimationFrame(tick);
  };

  return (
    <>
      <WizTitle>Find your neutral pose</WizTitle>
      <WizDesc>Hold your head still and look at the screen the way you normally watch video.</WizDesc>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px 0' }}>
        <div style={{ position: 'relative', width: 160, height: 160 }}>
          {/* dashed crosshair */}
          <svg width="160" height="160" style={{ position: 'absolute', inset: 0 }}>
            <line x1="80" y1="16" x2="80" y2="144" stroke="var(--border-mid)" strokeWidth="1" strokeDasharray="2 4"/>
            <line x1="16" y1="80" x2="144" y2="80" stroke="var(--border-mid)" strokeWidth="1" strokeDasharray="2 4"/>
            <circle cx="80" cy="80" r="64" fill="none" stroke="var(--border)" strokeWidth="1"/>
            {/* progress arc */}
            {phase === 'collect' && (
              <circle cx="80" cy="80" r="64" fill="none" stroke="var(--accent)" strokeWidth="1.5"
                strokeDasharray={2 * Math.PI * 64}
                strokeDashoffset={2 * Math.PI * 64 * (1 - prog)}
                transform="rotate(-90 80 80)" strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 120ms linear' }}/>
            )}
          </svg>
          {/* dot */}
          <div style={{
            position: 'absolute',
            left: 80 + yaw * 10 - 7, top: 80 + pitch * 10 - 7,
            width: 14, height: 14, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 12px rgba(var(--accent-rgb),0.5)',
            transition: 'left 140ms linear, top 140ms linear',
          }}/>
        </div>
      </div>

      <StatusRow state={phase === 'collect' ? 'active' : 'idle'}>
        {phase === 'collect' ? 'Holding still — sampling 2 seconds' : 'Ready when you are'}
      </StatusRow>

      {(() => { return null; })()}
      <button onClick={start} disabled={phase === 'collect'} style={{
        marginTop: 16, height: 48, borderRadius: 11,
        background: phase === 'collect' ? 'var(--surface-3)' : 'var(--accent)',
        color: phase === 'collect' ? 'var(--text-3)' : 'var(--accent-ink)',
        fontWeight: 500, fontSize: 14,
        cursor: phase === 'collect' ? 'default' : 'pointer',
      }}>{phase === 'collect' ? 'Holding…' : 'Start capture'}</button>
    </>
  );
};

// ---- Eye shape (open/closed) ----
const EyeViz = ({ closed, pulse = false, pupilScale = 1 }) => (
  <svg width="200" height="120" viewBox="0 0 200 120" style={{ display: 'block' }}>
    <path d={`M 16 60 Q 100 ${closed ? 60 : 16} 184 60 Q 100 ${closed ? 60 : 104} 16 60 Z`}
      fill="none" stroke="var(--text-2)" strokeWidth="1.2"
      style={{ transition: 'd 260ms var(--ease-out)' }}/>
    {!closed && (
      <>
        <circle cx="100" cy="60" r="22" fill="none" stroke="var(--accent)" strokeWidth="1.5"
          style={{ transformOrigin: '100px 60px', transform: `scale(${pupilScale})`, transition: 'transform 220ms' }}/>
        <circle cx="100" cy="60" r="10" fill="var(--accent)"
          style={{ transformOrigin: '100px 60px', transform: `scale(${pupilScale})`, transition: 'transform 220ms' }}/>
        {pulse && (
          <circle cx="100" cy="60" r="22" fill="none" stroke="var(--accent)" strokeWidth="1"
            style={{ animation: 'eye-pulse 1.8s ease-out infinite' }}/>
        )}
      </>
    )}
    <style>{`
      @keyframes eye-pulse {
        0% { r: 22; opacity: 0.6; }
        100% { r: 46; opacity: 0; }
      }
    `}</style>
  </svg>
);

// ---- Step 2: Eyes open ----
const StepEyesOpenCW = ({ onComplete }) => {
  const [phase, setPhase] = useStateCW('idle');
  const [frames, setFrames] = useStateCW(0);
  const target = 90;

  const start = () => {
    setPhase('collect'); setFrames(0);
    const id = setInterval(() => {
      setFrames(f => {
        const nf = f + 3;
        if (nf >= target) {
          clearInterval(id);
          setTimeout(() => onComplete({ openSamples: Array(nf).fill(0.27) }), 300);
          return target;
        }
        return nf;
      });
    }, 100);
  };

  return (
    <>
      <WizTitle>Look naturally at the screen</WizTitle>
      <WizDesc>Blink the way you normally do &mdash; we&rsquo;re learning what your eyes look like when open.</WizDesc>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px 0' }}>
        <EyeViz closed={false} pulse={phase === 'collect'}/>
      </div>

      <StatusRow state={phase === 'collect' ? 'active' : 'idle'}>
        {phase === 'collect' ? `Capturing open-eye baseline — ${frames}/${target} frames` : 'Ready to capture'}
      </StatusRow>

      <button onClick={start} disabled={phase === 'collect'} style={{
        marginTop: 16, height: 48, borderRadius: 11,
        background: phase === 'collect' ? 'var(--surface-3)' : 'var(--accent)',
        color: phase === 'collect' ? 'var(--text-3)' : 'var(--accent-ink)',
        fontWeight: 500, fontSize: 14,
        cursor: phase === 'collect' ? 'default' : 'pointer',
      }}>{phase === 'collect' ? 'Sampling…' : 'Start 3-second capture'}</button>
    </>
  );
};

// ---- Step 3: Eyes closed (with countdown) ----
const StepEyesClosedCW = ({ onComplete }) => {
  const [phase, setPhase] = useStateCW('idle'); // idle | countdown | closed | done
  const [count, setCount] = useStateCW(null);

  const start = () => {
    setPhase('countdown'); setCount(3);
    let t = 3;
    const tick = () => {
      t--;
      if (t > 0) { setCount(t); setTimeout(tick, 900); }
      else {
        setCount(null);
        setPhase('closed');
        setTimeout(() => {
          setPhase('done');
          setTimeout(() => onComplete({ earCalibration: { threshold: 0.178, ok: true } }), 600);
        }, 3000);
      }
    };
    setTimeout(tick, 900);
  };

  return (
    <>
      <WizTitle>Calibrate your blink</WizTitle>
      <WizDesc>Open-eye baseline captured. Now gently close your eyes when ready &mdash; don&rsquo;t squint.</WizDesc>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px 0', position: 'relative' }}>
        <EyeViz closed={phase === 'closed' || phase === 'done'} pulse={phase === 'closed'}/>
        {phase === 'countdown' && count && (
          <div key={count} style={{
            position: 'absolute',
            fontSize: 64, fontWeight: 600, color: 'var(--accent)',
            fontFamily: 'var(--font-mono)',
            animation: 'countdown-pop 900ms var(--ease-out)',
          }}>{count}</div>
        )}
      </div>

      <StatusRow
        state={phase === 'closed' ? 'active' : phase === 'done' ? 'active' : 'idle'}>
        {phase === 'idle' && 'Ready for closed-eye phase'}
        {phase === 'countdown' && 'Get ready — closing in…'}
        {phase === 'closed' && 'Keep your eyes closed — 3 seconds'}
        {phase === 'done' && 'You can open your eyes now'}
      </StatusRow>

      <button onClick={start} disabled={phase !== 'idle'} style={{
        marginTop: 16, height: 48, borderRadius: 11,
        background: phase !== 'idle' ? 'var(--surface-3)' : 'var(--accent)',
        color: phase !== 'idle' ? 'var(--text-3)' : 'var(--accent-ink)',
        fontWeight: 500, fontSize: 14,
        cursor: phase !== 'idle' ? 'default' : 'pointer',
      }}>
        {phase === 'idle' ? 'Close my eyes now' :
         phase === 'countdown' ? 'Get ready…' :
         phase === 'closed' ? 'Hold…' : 'Done'}
      </button>

      <style>{`
        @keyframes countdown-pop {
          0% { transform: scale(1.5); opacity: 0; }
          20% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.8); opacity: 0; }
        }
      `}</style>
    </>
  );
};

// ---- Step 4: Test ----
const StepTestCW = ({ onFinish }) => {
  const [count, setCount] = useStateCW(0);
  const [threshold, setThreshold] = useStateCW(0.178);
  const [blinkFlash, setBlinkFlash] = useStateCW(false);
  const [closed, setClosed] = useStateCW(false);

  useEffectCW(() => {
    const id = setInterval(() => {
      if (Math.random() < 0.22) {
        setClosed(true);
        setBlinkFlash(true);
        setCount(c => c + 1);
        setTimeout(() => setClosed(false), 160);
        setTimeout(() => setBlinkFlash(false), 380);
      }
    }, 900);
    return () => clearInterval(id);
  }, []);

  const nudge = d => setThreshold(v => Math.max(0.08, Math.min(0.3, +(v + d).toFixed(3))));

  return (
    <>
      <WizTitle>Try a few blinks</WizTitle>
      <WizDesc>We&rsquo;ll count them. Adjust sensitivity if a blink is missed or fires too early.</WizDesc>

      <div style={{ flex: 1, display: 'grid', placeItems: 'center', padding: '24px 0' }}>
        <div style={{ textAlign: 'center' }}>
          <EyeViz closed={closed} pulse={blinkFlash}/>
          <div style={{ marginTop: 16, display: 'flex', gap: 14, justifyContent: 'center', alignItems: 'baseline' }}>
            <div key={count} style={{
              fontFamily: 'var(--font-mono)', fontSize: 40, fontWeight: 600,
              color: blinkFlash ? 'var(--accent)' : 'var(--text)',
              transition: 'color 300ms',
              fontFeatureSettings: "'tnum'",
            }}>{count}</div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>blinks</div>
          </div>
          <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
            threshold {threshold.toFixed(3)}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button onClick={() => nudge(-0.015)} style={{
          flex: 1, height: 40, borderRadius: 10,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 12.5, fontWeight: 500,
        }}>Less sensitive</button>
        <button onClick={() => nudge(0.015)} style={{
          flex: 1, height: 40, borderRadius: 10,
          background: 'var(--surface-2)', border: '1px solid var(--border)',
          color: 'var(--text)', fontSize: 12.5, fontWeight: 500,
        }}>More sensitive</button>
      </div>

      <button onClick={onFinish} style={{
        marginTop: 10, height: 48, borderRadius: 11,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        fontWeight: 500, fontSize: 14, cursor: 'pointer',
      }}>Looks good</button>
    </>
  );
};

// ---- Success ----
const CalibSuccess = ({ onDone }) => {
  useEffectCW(() => {
    const id = setTimeout(onDone, 2400);
    return () => clearTimeout(id);
  }, [onDone]);
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
      display: 'grid', placeItems: 'center',
      animation: 'fade-in 220ms var(--ease-out)',
    }}>
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
        animation: 'soft-in 320ms var(--ease-out)',
      }}>
        <div style={{
          width: 78, height: 78, borderRadius: '50%',
          background: 'var(--accent)', color: 'var(--accent-ink)',
          display: 'grid', placeItems: 'center',
          boxShadow: '0 8px 40px rgba(var(--accent-rgb), 0.4)',
        }}>
          <IconCheck size={34} sw={2}/>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.015em', color: 'var(--text)' }}>
            Calibration complete
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-2)', marginTop: 6 }}>
            Your baseline is saved. Recalibrate anytime from Settings.
          </div>
        </div>
        <button onClick={onDone} style={{
          padding: '11px 26px', borderRadius: 10,
          background: 'var(--accent)', color: 'var(--accent-ink)',
          fontSize: 13.5, fontWeight: 500, cursor: 'pointer',
        }}>Done</button>
      </div>
    </div>
  );
};

// ---- Main shell ----
const CalibrationWizard = ({ mode = 'full', onClose }) => {
  const steps = mode === 'full'
    ? [{ key: 'neutral', label: 'NEUTRAL POSE' }, { key: 'open', label: 'EYES OPEN' }, { key: 'closed', label: 'EYE BLINK' }, { key: 'test', label: 'TEST' }]
    : mode === 'neutral_only'
      ? [{ key: 'neutral', label: 'NEUTRAL POSE' }]
      : [{ key: 'open', label: 'EYES OPEN' }, { key: 'closed', label: 'EYE BLINK' }, { key: 'test', label: 'TEST' }];

  const [idx, setIdx] = useStateCW(0);
  const [data, setData] = useStateCW({});
  const [success, setSuccess] = useStateCW(false);
  const total = steps.length;
  const current = steps[idx];

  const advance = d => {
    setData(p => ({ ...p, ...d }));
    if (idx === total - 1) setSuccess(true);
    else setIdx(i => i + 1);
  };
  const back = idx > 0 ? () => setIdx(i => i - 1) : null;

  if (success) return <CalibSuccess onDone={onClose}/>;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(10px)',
      display: 'grid', placeItems: 'center',
      animation: 'fade-in 200ms var(--ease-out)',
      padding: 20,
    }}>
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: 18,
        padding: '22px 28px 22px',
        boxShadow: 'var(--shadow-card)',
        display: 'flex', flexDirection: 'column',
        maxHeight: 'calc(100vh - 40px)',
        minHeight: 560,
        animation: 'soft-in 240ms var(--ease-out)',
      }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 28 }}>
          <button onClick={back || onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            color: back ? 'var(--text-2)' : 'var(--text-3)',
            opacity: back ? 1 : 0.35,
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
          }}><IconArrowLeft size={14}/></button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{
                height: 4,
                width: i === idx ? 22 : 4,
                background: i === idx ? 'var(--accent)' : i < idx ? 'var(--text-2)' : 'var(--surface-4)',
                borderRadius: 999,
                transition: 'all 280ms var(--ease-out)',
              }}/>
            ))}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 7,
            color: 'var(--text-3)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
          }}><IconClose size={13}/></button>
        </div>

        {/* Step caption */}
        <div style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)', letterSpacing: '0.1em', marginBottom: 10 }}>
          STEP {idx+1} OF {total} — {current.label}
        </div>

        {/* Step body */}
        <div key={current.key} style={{ flex: 1, display: 'flex', flexDirection: 'column', animation: 'fade-in 220ms var(--ease-out)' }}>
          {current.key === 'neutral' && <StepNeutralCW onComplete={advance}/>}
          {current.key === 'open' && <StepEyesOpenCW onComplete={advance}/>}
          {current.key === 'closed' && <StepEyesClosedCW onComplete={advance}/>}
          {current.key === 'test' && <StepTestCW onFinish={() => setSuccess(true)}/>}
        </div>
      </div>
    </div>
  );
};

Object.assign(window, { CalibrationWizard });
