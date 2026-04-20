// Refined onboarding — no rings, no glow, clean typography.
const { useState: useStateOB, useEffect: useEffectOB } = React;

const Onboarding = ({ step, setStep, onDone }) => {
  const total = 5;
  const next = () => step < total - 1 ? setStep(step + 1) : onDone();
  const back = () => step > 0 && setStep(step - 1);
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      backdropFilter: 'blur(8px)',
      display: 'grid', placeItems: 'center',
      zIndex: 100, padding: 16,
    }}>
      <div style={{
        width: '100%', maxWidth: 460,
        background: 'var(--surface)',
        border: '1px solid var(--border-mid)',
        borderRadius: 18,
        padding: '28px 32px 24px',
        boxShadow: 'var(--shadow-card)',
        animation: 'soft-in 260ms var(--ease-out)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
          <button onClick={back} disabled={step === 0} style={{
            width: 26, height: 26, borderRadius: 7,
            color: step === 0 ? 'var(--muted)' : 'var(--text-2)',
            display: 'grid', placeItems: 'center',
            opacity: step === 0 ? 0.35 : 1,
          }}><IconArrowLeft size={14}/></button>
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 6 }}>
            {Array.from({ length: total }).map((_, i) => (
              <div key={i} style={{
                height: 4,
                width: i === step ? 20 : 4,
                background: i === step ? 'var(--text)' : i < step ? 'var(--text-2)' : 'var(--surface-4)',
                borderRadius: 999,
                transition: 'width 280ms var(--ease-out), background 280ms',
              }}/>
            ))}
          </div>
          <div style={{ width: 26 }}/>
        </div>
        <div key={step} style={{ animation: 'fade-in 220ms var(--ease-out)' }}>
          {step === 0 && <StepWelcome/>}
          {step === 1 && <StepCamera/>}
          {step === 2 && <StepNeutral/>}
          {step === 3 && <StepBlink/>}
          {step === 4 && <StepDone/>}
        </div>
        <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <button onClick={next} style={{
            height: 44, borderRadius: 10,
            background: 'var(--accent)', color: 'var(--accent-ink)',
            fontWeight: 500, fontSize: 13.5,
          }}>
            {step === 0 ? 'Get started' : step === 4 ? 'Enter Nodex' : 'Continue'}
          </button>
          {step > 0 && step < 4 && (
            <button onClick={next} style={{ height: 32, fontSize: 12, color: 'var(--text-3)' }}>Skip</button>
          )}
        </div>
      </div>
    </div>
  );
};

const H = ({ children }) => <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--text)' }}>{children}</h1>;
const P = ({ children }) => <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: 'var(--text-2)' }}>{children}</p>;

const StepWelcome = () => (
  <div>
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
      <NodexLogo size={28}/><NodexWordmark size={16}/>
    </div>
    <H>Control video with your head.</H>
    <P>A small on-device model watches for subtle nods, tilts, and blinks &mdash; then turns them into playback gestures.</P>
    <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 1, borderTop: '1px solid var(--border)' }}>
      {[
        { i: <IconNodLR size={14}/>, h: 'Nod to scrub', p: 'Left or right by 10 seconds' },
        { i: <IconBlink size={14}/>, h: 'Blink to switch modes', p: 'A long blink enters Browse' },
        { i: <IconShield size={14}/>, h: 'Runs locally', p: 'Video never leaves your device' },
      ].map((f, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
          <div style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--surface-2)', color: 'var(--text-2)', display: 'grid', placeItems: 'center' }}>{f.i}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{f.h}</div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{f.p}</div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const StepCamera = () => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      width: 68, height: 68, margin: '4px auto 20px',
      borderRadius: '50%',
      background: 'var(--surface-2)',
      border: '1px solid var(--border-mid)',
      display: 'grid', placeItems: 'center',
      color: 'var(--text)',
    }}><IconCamera size={28} sw={1.3}/></div>
    <H>Grant camera access.</H>
    <P>We need your webcam to see head movement. Frames are processed on-device and never transmitted or stored.</P>
  </div>
);

const StepNeutral = () => {
  const [yaw, setYaw] = useStateOB(0.4);
  const [pitch, setPitch] = useStateOB(-0.2);
  const [p, setP] = useStateOB(0);
  useEffectOB(() => {
    const t = setInterval(() => {
      setYaw((Math.random() - 0.5) * 2);
      setPitch((Math.random() - 0.5) * 1.4);
      setP(v => Math.min(1, v + 0.025));
    }, 110);
    return () => clearInterval(t);
  }, []);
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{
        width: 140, height: 140, margin: '0 auto 20px',
        position: 'relative',
        borderRadius: 14,
        background: 'var(--surface-2)',
        border: '1px solid var(--border)',
      }}>
        <svg width="140" height="140" style={{ position: 'absolute', inset: 0 }}>
          <line x1="70" y1="20" x2="70" y2="120" stroke="var(--border-mid)" strokeWidth="1" strokeDasharray="2 3"/>
          <line x1="20" y1="70" x2="120" y2="70" stroke="var(--border-mid)" strokeWidth="1" strokeDasharray="2 3"/>
          <circle cx={70 + yaw*12} cy={70 + pitch*12} r="5" fill="var(--text)"/>
        </svg>
      </div>
      <H>Hold still for a moment.</H>
      <P>We&rsquo;re capturing your relaxed head position as the zero-point.</P>
      <div style={{ marginTop: 18, height: 3, borderRadius: 999, background: 'var(--surface-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${p*100}%`, background: 'var(--accent)', transition: 'width 100ms linear' }}/>
      </div>
    </div>
  );
};

const StepBlink = () => {
  const [ear, setEar] = useStateOB(0.28);
  useEffectOB(() => {
    const t = setInterval(() => setEar(Math.random() < 0.15 ? 0.06 : 0.27 + (Math.random() - 0.5) * 0.04), 200);
    return () => clearInterval(t);
  }, []);
  const closed = ear < 0.15;
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ margin: '6px auto 20px', display: 'flex', justifyContent: 'center', gap: 22 }}>
        {[0,1].map(i => (
          <svg key={i} width="54" height="32" viewBox="0 0 54 32">
            <path d={`M 3 16 Q 27 ${closed ? 16 : 4} 51 16 Q 27 ${closed ? 16 : 28} 3 16 Z`}
              fill="none" stroke="var(--text)" strokeWidth="1.3" style={{ transition: 'd 120ms' }}/>
            {!closed && <circle cx="27" cy="16" r="4" fill="var(--text)"/>}
          </svg>
        ))}
      </div>
      <H>Blink slowly three times.</H>
      <P>This sets your personal threshold &mdash; natural blinks won&rsquo;t trigger, only intentional ones.</P>
    </div>
  );
};

const StepDone = () => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      width: 56, height: 56, margin: '8px auto 20px',
      borderRadius: '50%',
      background: 'var(--accent)', color: 'var(--accent-ink)',
      display: 'grid', placeItems: 'center',
    }}><IconCheck size={26} sw={2}/></div>
    <H>You&rsquo;re all set.</H>
    <P>Open any video and Nodex will wake up automatically. Pin this panel to adjust settings anytime.</P>
  </div>
);

Object.assign(window, { Onboarding });
