// Kineto — generic video platform mock (no YouTube IP).
const VIDEO_DATA = [
  { t: "Lagrange points explained with spinning tops", ch: "orbitmath", dur: "14:02", v: "812K", age: "2 days ago", hue: 210, pattern: "orbits" },
  { t: "Cold-smoking salmon in a cardboard box", ch: "fieldkitchen", dur: "08:47", v: "1.4M", age: "1 week ago", hue: 28, pattern: "waves" },
  { t: "Why CRTs still look better for retro games", ch: "phosphor.labs", dur: "22:15", v: "488K", age: "4 days ago", hue: 300, pattern: "scan" },
  { t: "I built a mechanical keyboard from a broken typewriter", ch: "splitkey", dur: "31:08", v: "2.1M", age: "3 weeks ago", hue: 140, pattern: "grid" },
  { t: "The last bookbinder in Istanbul", ch: "quietcraft", dur: "11:24", v: "94K", age: "Today", hue: 50, pattern: "paper" },
  { t: "Deep ocean currents in real time (4K)", ch: "bluearchive", dur: "1:02:18", v: "3.3M", age: "2 months ago", hue: 210, pattern: "flow" },
  { t: "Fermenting hot sauce with wild yeasts", ch: "sourlab", dur: "17:55", v: "221K", age: "1 day ago", hue: 12, pattern: "dots" },
  { t: "Night-hiking the Kungsleden solo", ch: "northwards", dur: "44:39", v: "675K", age: "5 days ago", hue: 260, pattern: "stars" },
  { t: "How metro maps actually lie to you", ch: "cartographed", dur: "19:11", v: "1.8M", age: "Yesterday", hue: 340, pattern: "lines" },
  { t: "Restoring a 1970s analog synth, part 3", ch: "warmbench", dur: "27:42", v: "156K", age: "3 days ago", hue: 80, pattern: "rings" },
  { t: "Slow-TV: rain on a greenhouse roof", ch: "ambientroom", dur: "3:14:00", v: "540K", age: "1 month ago", hue: 190, pattern: "rain" },
  { t: "The physics of skipping stones", ch: "orbitmath", dur: "09:33", v: "1.1M", age: "6 days ago", hue: 160, pattern: "ripples" },
];

const ThumbArt = ({ hue = 180, pattern = "grid", seed = 1 }) => {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const bg1 = isLight ? `oklch(0.92 0.02 ${hue})` : `oklch(0.18 0.04 ${hue})`;
  const bg2 = isLight ? `oklch(0.82 0.04 ${hue})` : `oklch(0.09 0.02 ${hue})`;
  const ink = isLight ? `oklch(0.5 0.06 ${hue} / 0.3)` : `oklch(0.55 0.06 ${hue} / 0.35)`;
  const highlight = isLight ? `oklch(0.4 0.08 ${hue} / 0.9)` : `oklch(0.75 0.08 ${hue} / 0.9)`;
  const rnd = (i) => ((seed * 9301 + i * 49297) % 233280) / 233280;

  const patternEl = (() => {
    switch (pattern) {
      case "orbits": return <>
        <circle cx="50%" cy="55%" r="42%" fill="none" stroke={ink} strokeWidth="1"/>
        <circle cx="50%" cy="55%" r="28%" fill="none" stroke={ink} strokeWidth="1"/>
        <circle cx="72%" cy="55%" r="3" fill={highlight}/>
      </>;
      case "waves": return [0,1,2,3,4].map(i => <path key={i} d={`M0 ${30 + i*18} Q 40 ${20 + i*18} 80 ${30 + i*18} T 160 ${30 + i*18} T 240 ${30 + i*18}`} stroke={ink} fill="none" strokeWidth="1"/>);
      case "scan": return Array.from({length: 24}, (_,i) => <line key={i} x1="0" y1={i*6} x2="240" y2={i*6} stroke={ink} strokeWidth="0.5"/>);
      case "grid": return <>
        {Array.from({length: 12}, (_,i) => <line key={`v${i}`} x1={i*22} y1="0" x2={i*22} y2="135" stroke={ink} strokeWidth="0.5"/>)}
        {Array.from({length: 8}, (_,i) => <line key={`h${i}`} x1="0" y1={i*20} x2="264" y2={i*20} stroke={ink} strokeWidth="0.5"/>)}
      </>;
      case "paper": return Array.from({length: 8}, (_,i) => <rect key={i} x={20 + i*28} y={30 + rnd(i)*40} width="20" height={30 + rnd(i+7)*30} fill="none" stroke={ink} strokeWidth="0.8"/>);
      case "flow": return Array.from({length: 6}, (_,i) => <path key={i} d={`M${-20 + i*10} 135 Q 80 ${50 + i*12} 260 ${40 + i*14}`} stroke={ink} fill="none" strokeWidth="1"/>);
      case "dots": return Array.from({length: 40}, (_,i) => <circle key={i} cx={rnd(i)*264} cy={rnd(i+1)*135} r={rnd(i+2)*2.5 + 0.5} fill={ink}/>);
      case "stars": return Array.from({length: 30}, (_,i) => <circle key={i} cx={rnd(i)*264} cy={rnd(i+3)*135} r={rnd(i+5)*1.4 + 0.2} fill={highlight} opacity={rnd(i+9)*0.9 + 0.1}/>);
      case "lines": return Array.from({length: 5}, (_,i) => <line key={i} x1="0" y1={27*i + 10} x2="264" y2={27*i + 60} stroke={ink} strokeWidth="1.5"/>);
      case "rings": return [0,1,2].map(i => <circle key={i} cx={70 + i*60} cy="67" r={18 + i*4} fill="none" stroke={ink} strokeWidth="1"/>);
      case "rain": return Array.from({length: 60}, (_,i) => <line key={i} x1={rnd(i)*264} y1={rnd(i+1)*135 - 10} x2={rnd(i)*264 - 4} y2={rnd(i+1)*135 + 8} stroke={ink} strokeWidth="0.6"/>);
      case "ripples": return [0,1,2,3,4].map(i => <ellipse key={i} cx="132" cy="108" rx={20 + i*30} ry={4 + i*2} fill="none" stroke={ink} strokeWidth="0.8"/>);
      default: return null;
    }
  })();

  return (
    <svg width="100%" height="100%" viewBox="0 0 264 135" preserveAspectRatio="xMidYMid slice" style={{ display: 'block' }}>
      <defs>
        <linearGradient id={`g-${hue}-${seed}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={bg1}/>
          <stop offset="1" stopColor={bg2}/>
        </linearGradient>
      </defs>
      <rect width="264" height="135" fill={`url(#g-${hue}-${seed})`}/>
      {patternEl}
    </svg>
  );
};

const ChannelAvatar = ({ ch }) => {
  const initial = ch[0].toUpperCase();
  const h = (ch.charCodeAt(0) * 31 + ch.charCodeAt(1) * 13) % 360;
  return (
    <div style={{
      width: 32, height: 32, borderRadius: '50%',
      background: `oklch(0.6 0.06 ${h})`,
      display: 'grid', placeItems: 'center',
      fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 600,
      color: '#fff',
      flexShrink: 0,
    }}>{initial}</div>
  );
};

const VideoCard = ({ v, i, focused, refProp }) => (
  <div ref={refProp} data-video-idx={i} style={{
    transition: 'transform 200ms var(--ease-out)',
    transform: focused ? 'scale(1.03)' : 'scale(1)',
  }}>
    <div style={{
      position: 'relative', aspectRatio: '16/9',
      borderRadius: 12, overflow: 'hidden',
      background: 'var(--surface-3)',
    }}>
      <ThumbArt hue={v.hue} pattern={v.pattern} seed={i+1}/>
      <div style={{
        position: 'absolute', right: 6, bottom: 6,
        padding: '2px 6px', borderRadius: 4,
        background: 'rgba(0,0,0,0.82)',
        fontFamily: 'var(--font-mono)', fontSize: 10.5, fontWeight: 500,
        color: '#fff',
      }}>{v.dur}</div>
    </div>
    <div style={{ display: 'flex', gap: 10, marginTop: 10, alignItems: 'flex-start' }}>
      <ChannelAvatar ch={v.ch}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, lineHeight: 1.35,
          color: 'var(--text)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}>{v.t}</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 4 }}>{v.ch}</div>
        <div style={{ fontSize: 11.5, color: 'var(--text-3)', marginTop: 2 }}>{v.v} · {v.age}</div>
      </div>
    </div>
  </div>
);

const VideoGrid = ({ focusedIdx, cardRefs }) => (
  <div style={{ padding: '28px 32px 56px', maxWidth: 1400, margin: '0 auto' }}>
    <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginBottom: 20 }}>Recommended</div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '28px 20px' }}>
      {VIDEO_DATA.map((v, i) => (
        <VideoCard key={i} v={v} i={i} focused={focusedIdx === i}
          refProp={el => { if (cardRefs) cardRefs.current[i] = el; }}/>
      ))}
    </div>
  </div>
);

const PlatformHeader = () => (
  <div style={{
    height: 56, borderBottom: '1px solid var(--border)',
    display: 'flex', alignItems: 'center', padding: '0 28px',
    gap: 20, background: 'var(--bg)',
    position: 'sticky', top: 0, zIndex: 10,
  }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{ width: 22, height: 22, borderRadius: 5, background: 'var(--surface-3)', display: 'grid', placeItems: 'center' }}>
        <svg width="11" height="11" viewBox="0 0 12 12"><path d="M3 2l6 4-6 4V2z" fill="var(--text)"/></svg>
      </div>
      <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>kineto</span>
    </div>
    <div style={{
      flex: 1, maxWidth: 520, margin: '0 auto',
      height: 34, borderRadius: 999,
      background: 'var(--surface-2)', border: '1px solid var(--border)',
      display: 'flex', alignItems: 'center', padding: '0 14px',
      fontSize: 12.5, color: 'var(--text-3)',
    }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" style={{ marginRight: 8 }}>
        <circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>
      </svg>
      Search
    </div>
    <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--surface-3)' }}/>
  </div>
);

Object.assign(window, { VIDEO_DATA, VideoCard, VideoGrid, PlatformHeader });
