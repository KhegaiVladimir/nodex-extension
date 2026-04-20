// App shell — theme system, single Spatial variant, no telemetry footer.
const { useState: useStateA, useEffect: useEffectA, useRef: useRefA } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accentMode": "minimal",
  "accentHue": 170,
  "theme": "dark",
  "panelState": "main-active",
  "hudMode": "player",
  "showOnboarding": false,
  "onboardingStep": 0
}/*EDITMODE-END*/;

const loadTweaks = () => {
  try { const s = localStorage.getItem('nodex_tweaks_v2'); if (s) return { ...TWEAK_DEFAULTS, ...JSON.parse(s) }; } catch {}
  return { ...TWEAK_DEFAULTS };
};

function oklchToHex(l, c, h) {
  const hr = h * Math.PI / 180;
  const a = c * Math.cos(hr), b = c * Math.sin(hr);
  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.2914855480 * b;
  const L = l_**3, M = m_**3, S = s_**3;
  let r =  4.0767416621*L - 3.3077115913*M + 0.2309699292*S;
  let g = -1.2684380046*L + 2.6097574011*M - 0.3413193965*S;
  let bl= -0.0041960863*L - 0.7034186147*M + 1.7076147010*S;
  const gm = x => x <= 0.0031308 ? 12.92*x : 1.055*Math.pow(Math.max(0,x), 1/2.4) - 0.055;
  r = Math.max(0, Math.min(1, gm(r))); g = Math.max(0, Math.min(1, gm(g))); bl = Math.max(0, Math.min(1, gm(bl)));
  const toH = v => Math.round(v*255).toString(16).padStart(2,'0');
  return `#${toH(r)}${toH(g)}${toH(bl)}`;
}
const hexToRgb = h => ({ r: parseInt(h.slice(1,3),16), g: parseInt(h.slice(3,5),16), b: parseInt(h.slice(5,7),16) });

function useSystemTheme() {
  const [sys, setSys] = useStateA(() => window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  useEffectA(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = e => setSys(e.matches ? 'dark' : 'light');
    mq.addEventListener?.('change', h);
    return () => mq.removeEventListener?.('change', h);
  }, []);
  return sys;
}

function useSimulatedMetrics(running) {
  const [m, setM] = useStateA({ yaw: 0, pitch: 0, roll: 0, ear: 0.28 });
  useEffectA(() => {
    if (!running) return;
    let t = 0;
    const id = setInterval(() => {
      t += 0.1;
      setM({
        yaw:   Math.sin(t * 0.7) * 4 + (Math.random()-0.5) * 1.5,
        pitch: Math.cos(t * 0.5) * 3 + (Math.random()-0.5) * 1.2,
        roll:  Math.sin(t * 0.3) * 2 + (Math.random()-0.5) * 0.8,
        ear:   Math.random() < 0.04 ? 0.06 : 0.27 + (Math.random()-0.5) * 0.04,
      });
    }, 80);
    return () => clearInterval(id);
  }, [running]);
  return m;
}

function useBrowseController(enabled, cardCount) {
  const [idx, setIdx] = useStateA(0);
  const [dwell, setDwell] = useStateA(0);
  const ref = useRefA(0);
  useEffectA(() => {
    if (!enabled) return;
    let step = 0;
    const id = setInterval(() => {
      step++;
      if (step % 14 === 0) {
        setIdx(p => (p + 1) % cardCount);
        ref.current = 0; setDwell(0);
      } else {
        ref.current = Math.min(1, ref.current + 0.08);
        setDwell(ref.current);
      }
    }, 100);
    return () => clearInterval(id);
  }, [enabled, cardCount]);
  return { idx, dwell };
}

const SidePanel = ({ metrics, lastCmd, panelState, theme, setTheme, hudMode, tweaks, setTweaks, effectiveTheme, onRecalibrate }) => {
  const [tab, setTab] = useStateA(
    panelState === 'calibration' ? 'calib' : panelState === 'settings' ? 'settings' : 'main'
  );
  useEffectA(() => {
    if (panelState === 'calibration') setTab('calib');
    else if (panelState === 'settings') setTab('settings');
    else setTab('main');
  }, [panelState]);
  const running = panelState === 'main-active' || panelState === 'main-last-cmd' || panelState === 'calibration';
  return (
    <div style={{
      width: 380, height: '100%',
      background: 'var(--bg)',
      borderLeft: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <PanelHeader/>
      <PanelNav tab={tab} setTab={setTab}/>
      <div key={tab} style={{ flex: 1, overflowY: 'auto', animation: 'fade-in 220ms var(--ease-out)' }}>
        {panelState === 'no-tab' ? <NoTabState/> :
         tab === 'main' ? <MainScreen state={running ? 'active' : 'idle'} metrics={metrics} lastCmd={lastCmd} mode={hudMode}/> :
         tab === 'calib' ? <CalibrationScreen metrics={metrics} running={running} onRecalibrate={onRecalibrate}/> :
         <SettingsScreen
            theme={theme}
            setTheme={setTheme}
            accentMode={tweaks.accentMode}
            accentHue={tweaks.accentHue}
            setAccentMode={v => setTweaks(p => ({ ...p, accentMode: v }))}
            setAccentHue={v => setTweaks(p => ({ ...p, accentHue: v }))}
            effectiveTheme={effectiveTheme}
         />}
      </div>
    </div>
  );
};

const TweaksPanel = ({ tweaks, setTweaks, visible, setVisible }) => {
  if (!visible) return null;
  const set = (k, v) => setTweaks(p => ({ ...p, [k]: v }));
  const HUES = [
    { hue: 170, name: 'Mint' },
    { hue: 145, name: 'Green' },
    { hue: 260, name: 'Violet' },
    { hue: 30, name: 'Amber' },
    { hue: 0, name: 'Rose' },
    { hue: 220, name: 'Blue' },
  ];
  const Section = ({ label, children }) => (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 10.5, color: 'var(--text-3)', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  );
  const SegBtn = ({ active, onClick, children }) => (
    <button onClick={onClick} style={{
      flex: 1, padding: '6px 8px', borderRadius: 6,
      background: active ? 'var(--surface-3)' : 'transparent',
      color: active ? 'var(--text)' : 'var(--text-2)',
      border: '1px solid ' + (active ? 'var(--border-mid)' : 'var(--border)'),
      fontSize: 11.5, fontWeight: 500,
      transition: 'all 150ms',
    }}>{children}</button>
  );
  return (
    <div style={{
      position: 'fixed', bottom: 16, left: 16,
      width: 268,
      background: 'var(--surface)',
      border: '1px solid var(--border-mid)',
      borderRadius: 12,
      padding: '14px 16px',
      boxShadow: 'var(--shadow-card)',
      zIndex: 1000,
      fontSize: 12,
      animation: 'soft-in 200ms var(--ease-out)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
        <span style={{ fontSize: 11.5, color: 'var(--text-2)', fontWeight: 500 }}>Tweaks</span>
        <div style={{ flex: 1 }}/>
        <button onClick={() => setVisible(false)} style={{ color: 'var(--text-3)' }}><IconClose size={12}/></button>
      </div>
      <Section label="Theme">
        <div style={{ display: 'flex', gap: 4 }}>
          <SegBtn active={tweaks.theme === 'light'} onClick={() => set('theme', 'light')}>Light</SegBtn>
          <SegBtn active={tweaks.theme === 'dark'} onClick={() => set('theme', 'dark')}>Dark</SegBtn>
          <SegBtn active={tweaks.theme === 'system'} onClick={() => set('theme', 'system')}>System</SegBtn>
        </div>
      </Section>
      <Section label="Panel state">
        <select value={tweaks.panelState} onChange={e => set('panelState', e.target.value)} style={{
          width: '100%', padding: '6px 8px',
          background: 'var(--surface-2)', color: 'var(--text)',
          border: '1px solid var(--border)', borderRadius: 6, fontSize: 11.5,
        }}>
          <option value="no-tab">No tab</option>
          <option value="main-idle">Main &middot; idle</option>
          <option value="main-active">Main &middot; tracking</option>
          <option value="main-last-cmd">Main &middot; last command</option>
          <option value="calibration">Calibration</option>
          <option value="settings">Settings</option>
        </select>
      </Section>
      <Section label="HUD mode">
        <div style={{ display: 'flex', gap: 4 }}>
          <SegBtn active={tweaks.hudMode === 'player'} onClick={() => set('hudMode', 'player')}>Player</SegBtn>
          <SegBtn active={tweaks.hudMode === 'browse'} onClick={() => set('hudMode', 'browse')}>Browse</SegBtn>
          <SegBtn active={tweaks.hudMode === 'warning'} onClick={() => set('hudMode', 'warning')}>Warning</SegBtn>
        </div>
      </Section>
      <Section label="Accent">
        <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
          <SegBtn active={tweaks.accentMode === 'minimal'} onClick={() => set('accentMode', 'minimal')}>Minimal</SegBtn>
          <SegBtn active={tweaks.accentMode === 'color'} onClick={() => set('accentMode', 'color')}>Color</SegBtn>
        </div>
        {tweaks.accentMode === 'color' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {HUES.map(s => {
              const active = Math.abs(tweaks.accentHue - s.hue) < 5;
              const preview = oklchToHex(0.78, 0.14, s.hue);
              return <button key={s.hue} onClick={() => set('accentHue', s.hue)} title={s.name} style={{
                aspectRatio: '1/1', borderRadius: 6,
                background: preview,
                border: '2px solid ' + (active ? 'var(--text)' : 'transparent'),
                transition: 'all 150ms',
              }}/>;
            })}
          </div>
        )}
      </Section>
      <button onClick={() => set('showOnboarding', !tweaks.showOnboarding)} style={{
        width: '100%', padding: '7px 10px', borderRadius: 7,
        background: 'var(--surface-2)',
        color: 'var(--text-2)',
        border: '1px solid var(--border)',
        fontSize: 11.5, fontWeight: 500,
      }}>{tweaks.showOnboarding ? 'Close onboarding' : 'Replay onboarding'}</button>
    </div>
  );
};

const App = () => {
  const [tweaks, setTweaks] = useStateA(loadTweaks);
  const [tweaksVisible, setTweaksVisible] = useStateA(true);
  const cardRefs = useRefA([]);
  const gridRef = useRefA(null);
  const sys = useSystemTheme();

  useEffectA(() => {
    try { localStorage.setItem('nodex_tweaks_v2', JSON.stringify(tweaks)); } catch {}
  }, [tweaks]);

  // Apply theme
  const effectiveTheme = tweaks.theme === 'system' ? sys : tweaks.theme;
  useEffectA(() => {
    document.documentElement.setAttribute('data-theme', effectiveTheme);
  }, [effectiveTheme]);

  // Apply accent
  useEffectA(() => {
    const root = document.documentElement;
    if (tweaks.accentMode === 'minimal') {
      // reset to default minimal (white in dark, black in light)
      root.style.removeProperty('--accent');
      root.style.removeProperty('--accent-rgb');
      root.style.removeProperty('--accent-ink');
    } else {
      const hex = oklchToHex(effectiveTheme === 'light' ? 0.55 : 0.82, 0.14, tweaks.accentHue);
      const rgb = hexToRgb(hex);
      root.style.setProperty('--accent', hex);
      root.style.setProperty('--accent-rgb', `${rgb.r}, ${rgb.g}, ${rgb.b}`);
      root.style.setProperty('--accent-ink', effectiveTheme === 'light' ? '#ffffff' : '#060709');
    }
  }, [tweaks.accentMode, tweaks.accentHue, effectiveTheme]);

  const running = tweaks.panelState === 'main-active' || tweaks.panelState === 'main-last-cmd' || tweaks.panelState === 'calibration';
  const hasLastCmd = tweaks.panelState === 'main-last-cmd';
  const browseActive = tweaks.hudMode === 'browse';

  const metrics = useSimulatedMetrics(running || browseActive);
  const browse = useBrowseController(browseActive, VIDEO_DATA.length);

  const [focusRect, setFocusRect] = useStateA(null);
  useEffectA(() => {
    if (!browseActive) { setFocusRect(null); return; }
    const update = () => {
      const el = cardRefs.current[browse.idx];
      const gc = gridRef.current;
      if (!el || !gc) return;
      const gcr = gc.getBoundingClientRect();
      const thumb = el.firstChild;
      const tr = thumb?.getBoundingClientRect?.() || el.getBoundingClientRect();
      setFocusRect({
        x: tr.left - gcr.left + gc.scrollLeft,
        y: tr.top - gcr.top + gc.scrollTop,
        w: tr.width, h: tr.height,
      });
    };
    update();
    const gc = gridRef.current;
    gc?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => { gc?.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [browseActive, browse.idx]);

  const lastCmd = hasLastCmd ? { id: 1, action: 'Seek +10 seconds', icon: <IconSkip size={14}/> } : null;

  const [showWizard, setShowWizard] = useStateA(false);
  const [toast, setToast] = useStateA(null);
  useEffectA(() => {
    if (tweaks.hudMode === 'browse') {
      setToast({ id: Date.now(), variant: 'browse', icon: <IconBrowse size={14}/>, label: 'Browse mode', subtitle: 'Nod to navigate, tilt to go back' });
    } else if (tweaks.hudMode === 'warning') {
      setToast({ id: Date.now(), variant: 'warning', icon: <IconWarning size={14}/>, label: 'Face not detected', subtitle: 'Move into better lighting' });
    } else {
      setToast(null);
    }
  }, [tweaks.hudMode]);

  useEffectA(() => {
    if (tweaks.hudMode !== 'player' || !running) return;
    const gestures = [
      { icon: <IconSkip size={14}/>, label: 'Skip +10s' },
      { icon: <IconVolUp size={14}/>, label: 'Volume up' },
      { icon: <IconPause size={14}/>, label: 'Paused' },
      { icon: <IconRewind size={14}/>, label: 'Rewind 10s' },
    ];
    let i = 0;
    const id = setInterval(() => {
      setToast({ id: Date.now(), variant: 'default', ...gestures[i % gestures.length] });
      i++;
      setTimeout(() => setToast(t => t?.variant === 'default' ? null : t), 1400);
    }, 3800);
    return () => clearInterval(id);
  }, [tweaks.hudMode, running]);

  return (
    <div style={{ width: '100vw', height: '100vh', display: 'flex', overflow: 'hidden' }}>
      <div ref={gridRef} style={{ flex: 1, position: 'relative', overflowY: 'auto', background: 'var(--bg)' }}>
        <PlatformHeader/>
        <VideoGrid focusedIdx={browseActive ? browse.idx : -1} cardRefs={cardRefs}/>
        {browseActive && focusRect && <FocusRing rect={focusRect} dwell={browse.dwell}/>}
        <Toast toast={toast}/>
        {tweaks.showOnboarding && (
          <Onboarding
            step={tweaks.onboardingStep}
            setStep={s => setTweaks(p => ({ ...p, onboardingStep: s }))}
            onDone={() => setTweaks(p => ({ ...p, showOnboarding: false, onboardingStep: 0 }))}
          />
        )}
      </div>
      <SidePanel
        metrics={metrics} lastCmd={lastCmd}
        panelState={tweaks.panelState}
        theme={tweaks.theme}
        setTheme={t => setTweaks(p => ({ ...p, theme: t }))}
        hudMode={tweaks.hudMode}
        tweaks={tweaks}
        setTweaks={setTweaks}
        effectiveTheme={effectiveTheme}
        onRecalibrate={() => setShowWizard(true)}
      />
      {showWizard && <CalibrationWizard mode="full" onClose={() => setShowWizard(false)}/>}
      <TweaksPanel tweaks={tweaks} setTweaks={setTweaks} visible={tweaksVisible} setVisible={setTweaksVisible}/>
      {!tweaksVisible && (
        <button onClick={() => setTweaksVisible(true)} style={{
          position: 'fixed', bottom: 16, left: 16,
          padding: '7px 12px', borderRadius: 8,
          background: 'var(--surface)', border: '1px solid var(--border-mid)',
          color: 'var(--text-2)', fontSize: 12, fontWeight: 500,
          zIndex: 1000, boxShadow: 'var(--shadow-soft)',
        }}>Tweaks</button>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
