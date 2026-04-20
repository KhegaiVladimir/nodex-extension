// Panel — revived character. Live face viz, threshold bars, status chip.
const { useState: useStateP, useEffect: useEffectP, useRef: useRefP } = React;

const StatusDot = ({ state = 'active' }) => {
  const color = state === 'active' ? 'var(--green)' : state === 'warning' ? 'var(--amber)' : 'var(--muted)';
  return <span style={{
    width: 6, height: 6, borderRadius: '50%',
    background: color, color,
    animation: state === 'active' ? 'pulse-dot 1.8s infinite' : 'none',
    flexShrink: 0,
  }}/>;
};

const Toggle = ({ on, onChange }) => (
  <button onClick={() => onChange(!on)} style={{
    width: 32, height: 19, borderRadius: 999,
    background: on ? 'var(--accent)' : 'var(--surface-3)',
    position: 'relative', transition: 'background 200ms var(--ease-out)',
    padding: 0, flexShrink: 0,
  }}>
    <span style={{
      position: 'absolute', top: 2.5, left: on ? 15.5 : 2.5,
      width: 14, height: 14, borderRadius: '50%',
      background: on ? 'var(--accent-ink)' : 'var(--text)',
      transition: 'left 200ms var(--ease-out)',
    }}/>
  </button>
);

const PanelHeader = () => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px var(--pad-xl) 14px' }}>
    <NodexLogo size={22}/><NodexWordmark size={14}/>
    <div style={{ flex: 1 }}/>
    <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>1.1</span>
  </div>
);

const PanelNav = ({ tab, setTab }) => {
  const tabs = [{id:'main',label:'Main'},{id:'calib',label:'Calibration'},{id:'settings',label:'Settings'}];
  return (
    <div style={{ display: 'flex', gap: 20, padding: '0 var(--pad-xl)', borderBottom: '1px solid var(--border)' }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => setTab(t.id)} style={{
          padding: '10px 0 12px', position: 'relative',
          color: tab === t.id ? 'var(--text)' : 'var(--text-2)',
          fontSize: 13, fontWeight: 500, transition: 'color 150ms',
        }}>
          {t.label}
          <span style={{
            position: 'absolute', left: 0, right: 0, bottom: -1, height: 1.5,
            background: tab === t.id ? 'var(--text)' : 'transparent',
            borderRadius: 2, transition: 'background 150ms',
          }}/>
        </button>
      ))}
    </div>
  );
};

// === Tracking chip ===
const TrackingChip = ({ running, mode }) => (
  <div style={{
    display: 'inline-flex', alignItems: 'center', gap: 8,
    padding: '5px 11px 5px 9px', borderRadius: 999,
    background: running ? 'var(--accent-dim)' : 'var(--surface-2)',
    border: '1px solid ' + (running ? 'rgba(var(--accent-rgb),0.25)' : 'var(--border)'),
    fontSize: 11.5, fontWeight: 500,
    color: running ? 'var(--accent)' : 'var(--text-2)',
    transition: 'all 200ms var(--ease-out)',
  }}>
    <StatusDot state={running ? 'active' : 'idle'}/>
    <span>{running ? 'Tracking' : 'Idle'}</span>
    <span style={{ width: 1, height: 10, background: 'currentColor', opacity: 0.2 }}/>
    <span style={{ opacity: 0.75, textTransform: 'capitalize' }}>{mode}</span>
  </div>
);

// === Live face visualization — breathing + smooth dot follow ===
const FaceViz = ({ metrics, running }) => {
  const [sx, setSx] = useStateP({ x: 0, y: 0, r: 0 }); // smoothed
  const raf = useRefP();
  useEffectP(() => {
    let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      setSx(prev => ({
        x: prev.x + (metrics.yaw - prev.x) * Math.min(1, dt * 8),
        y: prev.y + (metrics.pitch - prev.y) * Math.min(1, dt * 8),
        r: prev.r + (metrics.roll - prev.r) * Math.min(1, dt * 8),
      }));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [metrics.yaw, metrics.pitch, metrics.roll]);

  return (
    <div style={{
      position: 'relative',
      aspectRatio: '1.5 / 1',
      borderRadius: 14,
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      overflow: 'hidden',
    }}>
      {/* subtle grid */}
      <svg width="100%" height="100%" style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <defs>
          <pattern id="fv-dots" width="14" height="14" patternUnits="userSpaceOnUse">
            <circle cx="1" cy="1" r="0.6" fill="var(--text-3)" opacity="0.22"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#fv-dots)"/>
      </svg>
      {/* center */}
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        {/* Single thin circle, 60% height, centered */}
        <div style={{
          width: '58%', aspectRatio: '1/1', borderRadius: '50%',
          border: '1px solid var(--accent)',
          background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.06), transparent 70%)',
          boxShadow: '0 0 24px rgba(var(--accent-rgb), 0.1)',
          position: 'absolute',
        }}/>
        {/* Face dot wrapper — handles translate; inner handles breathing scale */}
        <div style={{
          transform: `translate(${sx.x * 2.6}px, ${-sx.y * 2.6}px)`,
          transition: 'transform 40ms linear',
        }}>
          <div style={{
            width: 10, height: 10, borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 10px rgba(var(--accent-rgb), 0.6)',
            animation: running ? 'pose-breathe 3s ease-in-out infinite' : 'none',
          }}/>
        </div>
      </div>
      {/* corner tick */}
      <div style={{
        position: 'absolute', top: 10, left: 12,
        fontSize: 10, color: 'var(--text-3)',
        fontFamily: 'var(--font-mono)', letterSpacing: '0.08em',
      }}>POSE</div>
      <style>{`
        @keyframes pose-breathe {
          0%,100% { transform: scale(1); }
          50%     { transform: scale(1.4); opacity: 0.85; }
        }
      `}</style>
    </div>
  );
};

// === Threshold bar — thin gauge ===
const ThresholdBar = ({ value, max, threshold, type = 'centered' }) => {
  const pct = Math.max(-1, Math.min(1, value / max));
  const triggered = Math.abs(value) >= threshold;
  const near = Math.abs(value) >= threshold * 0.7;
  const tPct = threshold / max;
  const color = triggered ? 'var(--accent)' : near ? 'var(--accent)' : 'var(--text-2)';
  const opacity = triggered ? 1 : near ? 0.7 : 0.45;
  return (
    <div style={{ position: 'relative', height: 4, borderRadius: 999, background: 'var(--surface-3)', overflow: 'visible' }}>
      {type === 'centered' ? <>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: pct >= 0 ? '50%' : `${50 + pct * 50}%`,
          width: `${Math.abs(pct) * 50}%`,
          background: color, opacity,
          borderRadius: 999,
          transition: 'all 60ms linear, opacity 180ms',
        }}/>
        <div style={{ position: 'absolute', top: -1, bottom: -1, left: '50%', width: 1, background: 'var(--border-light)' }}/>
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${50 + tPct*50}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${50 - tPct*50}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
      </> : <>
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: 0,
          width: `${Math.max(0, Math.min(1, value / max)) * 100}%`,
          background: color, opacity,
          borderRadius: 999,
          transition: 'all 60ms linear, opacity 180ms',
        }}/>
        <div style={{ position: 'absolute', top: -2, bottom: -2, left: `${tPct*100}%`, width: 1.5, background: 'var(--text-3)', opacity: 0.4 }}/>
      </>}
    </div>
  );
};

// === Metric row with live bar ===
const MetricRow = ({ label, value, max, threshold, type = 'centered', unit = '°' }) => {
  const displayVal = type === 'centered' ? value.toFixed(1) + unit : value.toFixed(2);
  const triggered = Math.abs(value) >= threshold;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 6, gap: 12 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text-2)', whiteSpace: 'nowrap', flexShrink: 0 }}>{label}</span>
        <div style={{ flex: 1, minWidth: 0 }}/>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 12.5, fontWeight: 500,
          color: triggered ? 'var(--accent)' : 'var(--text)',
          fontFeatureSettings: "'tnum'", transition: 'color 180ms',
          whiteSpace: 'nowrap',
        }}>{displayVal}</span>
      </div>
      <ThresholdBar value={value} max={max} threshold={threshold} type={type}/>
    </div>
  );
};

// === MAIN SCREEN ===
const MainScreen = ({ state, metrics, lastCmd, mode }) => {
  const running = state === 'active';
  return (
    <div style={{ padding: '20px var(--pad-xl) 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <TrackingChip running={running} mode={mode}/>
      <FaceViz metrics={metrics} running={running}/>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MetricRow label="Yaw" value={metrics.yaw} max={30} threshold={18}/>
        <MetricRow label="Pitch" value={metrics.pitch} max={25} threshold={15}/>
        <MetricRow label="Roll" value={metrics.roll} max={40} threshold={25}/>
        <MetricRow label="Eye openness" value={metrics.ear} max={0.4} threshold={0.15} type="fill" unit=""/>
      </div>
      {lastCmd && (
        <div key={lastCmd.id} className="fade-in" style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 13px',
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 11,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 7,
            background: 'var(--accent-dim-2)', color: 'var(--accent)',
            display: 'grid', placeItems: 'center',
          }}>{lastCmd.icon}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>{lastCmd.action}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Last gesture</div>
          </div>
          <span style={{ fontSize: 11, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>0.4s ago</span>
        </div>
      )}
      <button style={{
        height: 40, borderRadius: 10,
        background: 'transparent', color: 'var(--text)',
        border: '1px solid var(--border-light)',
        fontWeight: 500, fontSize: 13,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        transition: 'background 150ms',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
        {running ? 'Stop tracking' : 'Start tracking'}
      </button>
    </div>
  );
};

// === NO-TAB ===
const NoTabState = () => (
  <div style={{ padding: '48px var(--pad-xl) 32px', animation: 'fade-in 220ms var(--ease-out)' }}>
    <div style={{
      width: 40, height: 40, borderRadius: 10,
      background: 'var(--surface)', border: '1px solid var(--border)',
      display: 'grid', placeItems: 'center', color: 'var(--text-2)',
      marginBottom: 18,
    }}><IconPlayer size={18}/></div>
    <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 6 }}>Open a video to begin</div>
    <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 24, lineHeight: 1.55 }}>
      Nodex runs on video pages. Navigate to any video, then return here to start tracking.
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', color: 'var(--text-2)' }}>
      {['Open any video platform', 'Start tracking from this panel', 'Nod, tilt, blink to control'].map((t, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '8px 0', fontSize: 13 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-3)', minWidth: 14 }}>{i+1}</span>
          <span>{t}</span>
        </div>
      ))}
    </div>
  </div>
);

// === CALIBRATION ===
const CalibrationScreen = ({ metrics, running, onRecalibrate }) => (
  <div style={{ padding: '20px var(--pad-xl) 28px', display: 'flex', flexDirection: 'column', gap: 18 }}>
    <div>
      <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 2 }}>Calibration</div>
      <div style={{ fontSize: 12.5, color: 'var(--text-2)', lineHeight: 1.5 }}>
        Set a neutral pose so Nodex knows what &ldquo;still&rdquo; looks like for you.
      </div>
    </div>
    <FaceViz metrics={metrics} running={running}/>
    <div style={{
      padding: '12px 14px',
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 11,
      display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <IconClock size={15} sw={1.4}/>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12.5 }}>Last calibrated 2 min ago</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', fontFamily: 'var(--font-mono)' }}>
          yaw₀ −0.2°  pitch₀ +1.1°  roll₀ −0.5°  eye₀ 0.28
        </div>
      </div>
      <button onClick={onRecalibrate} style={{
        padding: '6px 11px', borderRadius: 7,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        fontSize: 12, fontWeight: 500,
        cursor: 'pointer',
      }}>Recalibrate</button>
    </div>
    <div>
      <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginBottom: 12 }}>Live readings</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <MetricRow label="Yaw" value={metrics.yaw} max={30} threshold={18}/>
        <MetricRow label="Pitch" value={metrics.pitch} max={25} threshold={15}/>
        <MetricRow label="Roll" value={metrics.roll} max={40} threshold={25}/>
        <MetricRow label="Eye openness" value={metrics.ear} max={0.4} threshold={0.15} type="fill" unit=""/>
      </div>
    </div>
  </div>
);

Object.assign(window, { StatusDot, Toggle, PanelHeader, PanelNav, TrackingChip, FaceViz, MetricRow, ThresholdBar, MainScreen, NoTabState, CalibrationScreen });
