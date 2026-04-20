// Settings — Interface, Gesture Mapping, Sensitivity, Smart Features, Data.
const { useState: useStateS, useRef: useRefS, useEffect: useEffectS } = React;

const ACTIONS = [
  'Play / pause', 'Skip +10s', 'Rewind 10s',
  'Previous track', 'Next track',
  'Volume up', 'Volume down', 'Mute',
  'Fullscreen', 'Theatre mode',
  'Navigate next', 'Navigate previous',
  'Open selected', 'Go back',
  'Switch mode', 'Unbound',
];

// Dropdown
const Dropdown = ({ value, options, onChange, compact = false }) => {
  const [open, setOpen] = useStateS(false);
  const ref = useRefS();
  useEffectS(() => {
    const h = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button onClick={() => setOpen(o => !o)} style={{
        width: '100%', padding: compact ? '5px 8px 5px 10px' : '6px 9px 6px 10px',
        background: open ? 'var(--surface-3)' : 'var(--surface-2)',
        color: 'var(--text)',
        border: '1px solid ' + (open ? 'var(--border-light)' : 'var(--border)'),
        borderRadius: 7, fontSize: 12, fontWeight: 500,
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 140ms var(--ease-out)', textAlign: 'left',
      }}>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <span style={{ color: 'var(--text-3)', display: 'flex', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms' }}>
          <IconChevronDown size={11} sw={1.7}/>
        </span>
      </button>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border-light)', borderRadius: 8,
          padding: 3, zIndex: 20, boxShadow: 'var(--shadow-card)',
          maxHeight: 240, overflowY: 'auto', animation: 'soft-in 160ms var(--ease-out)',
        }}>
          {options.map(o => (
            <button key={o} onClick={() => { onChange(o); setOpen(false); }} style={{
              width: '100%', padding: '6px 9px', borderRadius: 5,
              textAlign: 'left', fontSize: 12,
              background: o === value ? 'var(--accent-dim)' : 'transparent',
              color: o === value ? 'var(--accent)' : 'var(--text)',
              transition: 'background 100ms',
            }}
            onMouseEnter={e => { if (o !== value) e.currentTarget.style.background = 'var(--surface-2)'; }}
            onMouseLeave={e => { if (o !== value) e.currentTarget.style.background = 'transparent'; }}>
              {o}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const BindingRow = ({ gesture, icon, value, options, onChange, first = false }) => (
  <div style={{
    display: 'grid', gridTemplateColumns: '22px 1fr 152px',
    alignItems: 'center', gap: 10,
    padding: '9px 14px',
    borderTop: first ? 'none' : '1px solid var(--border)',
  }}>
    <span style={{ color: 'var(--text-2)', display: 'flex' }}>{icon}</span>
    <span style={{ fontSize: 12.5 }}>{gesture}</span>
    <Dropdown value={value} options={options} onChange={onChange}/>
  </div>
);

const SectionCard = ({ title, desc, children }) => (
  <div style={{
    background: 'var(--surface)', border: '1px solid var(--border)',
    borderRadius: 12, overflow: 'visible',
    animation: 'fade-in 240ms var(--ease-out) both',
  }}>
    <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)' }}>
      <div style={{ fontSize: 13, fontWeight: 600 }}>{title}</div>
      {desc && <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 2 }}>{desc}</div>}
    </div>
    {children}
  </div>
);

const Row = ({ title, desc, children, first = false }) => (
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
);

// Accent preview helper
function accentPreview(h, theme) {
  const hr = h * Math.PI / 180;
  const c = 0.14, l = theme === 'light' ? 0.6 : 0.8;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const l_ = (l + 0.3963377774*a + 0.2158037573*b)**3;
  const m_ = (l - 0.1055613458*a - 0.0638541728*b)**3;
  const s_ = (l - 0.0894841775*a - 1.2914855480*b)**3;
  let r =  4.0767416621*l_ - 3.3077115913*m_ + 0.2309699292*s_;
  let g = -1.2684380046*l_ + 2.6097574011*m_ - 0.3413193965*s_;
  let bl= -0.0041960863*l_ - 0.7034186147*m_ + 1.7076147010*s_;
  const gm = x => x <= 0.0031308 ? 12.92*x : 1.055*Math.pow(Math.max(0,x),1/2.4)-0.055;
  const toH = v => Math.round(Math.max(0, Math.min(1, gm(v)))*255).toString(16).padStart(2,'0');
  return `#${toH(r)}${toH(g)}${toH(bl)}`;
}

const ACCENT_PRESETS = [
  { id: 170, label: 'Mint' },
  { id: 125, label: 'Lime' },
  { id: 80,  label: 'Yellow' },
  { id: 230, label: 'Blue' },
  { id: 40,  label: 'Peach' },
  { id: 350, label: 'Pink' },
];

const AccentPicker = ({ mode, hue, setMode, setHue, theme }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
    {ACCENT_PRESETS.map(p => {
      const active = mode === 'color' && Math.abs(hue - p.id) < 5;
      const preview = accentPreview(p.id, theme);
      return (
        <button key={p.id} onClick={() => { setMode('color'); setHue(p.id); }} title={p.label} style={{
          aspectRatio: '1/1', borderRadius: 8,
          background: preview,
          border: '2px solid ' + (active ? preview : 'transparent'),
          outline: active ? '1px solid var(--bg)' : 'none',
          outlineOffset: -4,
          transition: 'transform 140ms var(--ease-out), border-color 140ms',
          transform: active ? 'scale(1.06)' : 'scale(1)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.transform = 'scale(1)'; }}/>
      );
    })}
    {(() => {
      const active = mode === 'minimal';
      const bg = theme === 'light' ? '#1a1d21' : '#f0f1f3';
      return (
        <button onClick={() => setMode('minimal')} title="Minimal" style={{
          aspectRatio: '1/1', borderRadius: 8,
          background: bg,
          border: '2px solid ' + (active ? bg : 'transparent'),
          outline: active ? '1px solid var(--bg)' : 'none',
          outlineOffset: -4,
          display: 'grid', placeItems: 'center',
          fontSize: 10, fontWeight: 600,
          color: theme === 'light' ? '#fff' : '#0a0b0d',
          transition: 'transform 140ms var(--ease-out)',
          transform: active ? 'scale(1.06)' : 'scale(1)',
          cursor: 'pointer',
        }}
        onMouseEnter={e => { if (!active) e.currentTarget.style.transform = 'scale(1.05)'; }}
        onMouseLeave={e => { if (!active) e.currentTarget.style.transform = 'scale(1)'; }}>Aa</button>
      );
    })()}
  </div>
);

const ThemePicker = ({ theme, setTheme }) => {
  const options = [
    { k: 'light', l: 'Light', i: <IconSun size={13} sw={1.6}/> },
    { k: 'dark',  l: 'Dark',  i: <IconMoon size={13} sw={1.6}/> },
    { k: 'system', l: 'System', i: <IconMonitor size={13} sw={1.6}/> },
  ];
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 3,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      borderRadius: 8,
    }}>
      {options.map(o => (
        <button key={o.k} onClick={() => setTheme(o.k)} style={{
          flex: 1, padding: '6px 8px', borderRadius: 5,
          background: theme === o.k ? 'var(--surface)' : 'transparent',
          color: theme === o.k ? 'var(--text)' : 'var(--text-2)',
          boxShadow: theme === o.k ? 'var(--shadow-soft)' : 'none',
          fontSize: 11.5, fontWeight: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          transition: 'all 160ms var(--ease-out)',
        }}>
          {o.i}<span>{o.l}</span>
        </button>
      ))}
    </div>
  );
};

// Gesture sub-tabs (Player / Browse)
const GestureTabs = ({ mode, setMode }) => (
  <div style={{
    display: 'flex', gap: 3, padding: 3,
    background: 'var(--surface-2)',
    borderRadius: 8,
    margin: '10px 14px 0',
  }}>
    {['player','browse'].map(m => (
      <button key={m} onClick={() => setMode(m)} style={{
        flex: 1, padding: '6px 10px', borderRadius: 5,
        background: mode === m ? 'var(--surface)' : 'transparent',
        color: mode === m ? 'var(--text)' : 'var(--text-2)',
        boxShadow: mode === m ? 'var(--shadow-soft)' : 'none',
        fontSize: 12, fontWeight: 500,
        textTransform: 'capitalize',
        transition: 'all 160ms var(--ease-out)',
      }}>{m}</button>
    ))}
  </div>
);

const SettingsScreen = ({ theme, setTheme, accentMode, accentHue, setAccentMode, setAccentHue, effectiveTheme }) => {
  const [gMode, setGMode] = useStateS('player');

  // Player bindings
  const [pB, setPB] = useStateS({
    headL: 'Rewind 10s', headR: 'Skip +10s',
    headU: 'Volume up',  headD: 'Volume down',
    eyesClosed: 'Play / pause', eyesHold: 'Switch mode',
    mouthOpen: 'Mute',
    tiltL: 'Previous track', tiltR: 'Next track',
  });
  // Browse bindings
  const [bB, setBB] = useStateS({
    headL: 'Navigate previous', headR: 'Navigate next',
    headU: 'Navigate previous', headD: 'Navigate next',
    eyesClosed: 'Open selected', eyesHold: 'Switch mode',
    mouthOpen: 'Go back',
    tiltL: 'Unbound', tiltR: 'Unbound',
  });

  const bindings = gMode === 'player' ? pB : bB;
  const setBindings = gMode === 'player' ? setPB : setBB;
  const up = (k, v) => setBindings(s => ({ ...s, [k]: v }));

  const [sensitivity, setSensitivity] = useStateS('Medium');
  const [autoPause, setAutoPause] = useStateS(true);
  const [highPrecision, setHighPrecision] = useStateS(false);

  const [clearConfirm, setClearConfirm] = useStateS(false);
  const [saved, setSaved] = useStateS(false);

  return (
    <div style={{ padding: '18px var(--pad-xl) 28px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Interface */}
      <SectionCard title="Interface" desc="Appearance and accent color">
        <Row title="Theme" desc="Light, dark, or follow system" first>
          <div style={{ width: 178 }}><ThemePicker theme={theme} setTheme={setTheme}/></div>
        </Row>
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12.5, fontWeight: 500 }}>Accent</div>
            <div style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>
              Used for focus ring, active states, and live indicators
            </div>
          </div>
          <AccentPicker mode={accentMode} hue={accentHue}
            setMode={setAccentMode} setHue={setAccentHue}
            theme={effectiveTheme}/>
        </div>
      </SectionCard>

      {/* Gesture Mapping */}
      <SectionCard title="Gesture Mapping" desc="Assign an action to each gesture">
        <GestureTabs mode={gMode} setMode={setGMode}/>
        <div style={{ marginTop: 8 }} key={gMode}>
          <BindingRow first gesture="Head left"    icon={<IconNodLR size={15} sw={1.4}/>}  value={bindings.headL} options={ACTIONS} onChange={v => up('headL', v)}/>
          <BindingRow gesture="Head right"   icon={<IconNodLR size={15} sw={1.4}/>}  value={bindings.headR} options={ACTIONS} onChange={v => up('headR', v)}/>
          <BindingRow gesture="Head up"      icon={<IconNodUD size={15} sw={1.4}/>}  value={bindings.headU} options={ACTIONS} onChange={v => up('headU', v)}/>
          <BindingRow gesture="Head down"    icon={<IconNodUD size={15} sw={1.4}/>}  value={bindings.headD} options={ACTIONS} onChange={v => up('headD', v)}/>
          <BindingRow gesture="Eyes closed"  icon={<IconBlink size={15} sw={1.4}/>}  value={bindings.eyesClosed} options={ACTIONS} onChange={v => up('eyesClosed', v)}/>
          <BindingRow gesture="Eyes hold"    icon={<IconBlink size={15} sw={1.4}/>}  value={bindings.eyesHold} options={ACTIONS} onChange={v => up('eyesHold', v)}/>
          <BindingRow gesture="Mouth open"   icon={<IconFace size={15} sw={1.4}/>}   value={bindings.mouthOpen} options={ACTIONS} onChange={v => up('mouthOpen', v)}/>
          <BindingRow gesture="Tilt left"    icon={<IconTilt size={15} sw={1.4}/>}   value={bindings.tiltL} options={ACTIONS} onChange={v => up('tiltL', v)}/>
          <BindingRow gesture="Tilt right"   icon={<IconTilt size={15} sw={1.4}/>}   value={bindings.tiltR} options={ACTIONS} onChange={v => up('tiltR', v)}/>
        </div>
      </SectionCard>

      {/* Sensitivity */}
      <SectionCard title="Sensitivity" desc="How easily gestures are triggered">
        <Row title="Detection sensitivity" desc="Affects all gestures globally" first>
          <div style={{ width: 140 }}>
            <Dropdown value={sensitivity} options={['Low','Medium','High']} onChange={setSensitivity}/>
          </div>
        </Row>
      </SectionCard>

      {/* Smart Features */}
      <SectionCard title="Smart Features" desc="Advanced behavior">
        <Row title="Auto-pause when you leave"
             desc="Pauses video if no face is detected for 4 seconds"
             first>
          <Toggle on={autoPause} onChange={setAutoPause}/>
        </Row>
        <Row title="High-precision landmarks"
             desc="Uses more CPU for steadier tracking">
          <Toggle on={highPrecision} onChange={setHighPrecision}/>
        </Row>
      </SectionCard>

      {/* Data */}
      <SectionCard title="Data" desc="Your information stays on this device">
        <div style={{ padding: '11px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <IconShield size={14} sw={1.5}/>
          <span style={{ fontSize: 11.5, color: 'var(--text-2)', flex: 1 }}>
            All data stored locally &mdash; nothing sent to any server
          </span>
        </div>
        <div style={{ padding: '0 14px 12px' }}>
          <button onClick={() => clearConfirm ? setClearConfirm(false) : setClearConfirm(true)} style={{
            width: '100%', height: 34, borderRadius: 8,
            background: clearConfirm ? 'var(--red-dim)' : 'transparent',
            color: 'var(--red)',
            border: '1px solid ' + (clearConfirm ? 'rgba(208,72,72,0.3)' : 'rgba(208,72,72,0.25)'),
            fontSize: 12, fontWeight: 500, transition: 'all 160ms',
          }}>{clearConfirm ? 'Click again to confirm' : 'Clear all Nodex data'}</button>
        </div>
      </SectionCard>

      {/* Save */}
      <button onClick={() => { setSaved(true); setTimeout(() => setSaved(false), 1800); }} style={{
        height: 40, borderRadius: 10,
        background: 'var(--accent)', color: 'var(--accent-ink)',
        fontWeight: 500, fontSize: 13,
        transition: 'all 150ms var(--ease-out)',
        marginTop: 4,
      }}>{saved ? 'Saved' : 'Save settings'}</button>
    </div>
  );
};

Object.assign(window, { SettingsScreen });
