// Refined HUD — clean toast, thin focus ring, no glow.
const { useState: useStateH, useEffect: useEffectH } = React;

const FocusRing = ({ rect, dwell = 0 }) => {
  if (!rect) return null;
  const { x, y, w, h } = rect;
  const pad = 4;
  const rw = w + pad * 2;
  const rh = h + pad * 2;
  const perim = 2 * (rw + rh);
  return (
    <div style={{
      position: 'absolute',
      left: x - pad, top: y - pad, width: rw, height: rh,
      pointerEvents: 'none',
      transition: 'left 150ms var(--ease-out), top 150ms var(--ease-out), width 150ms var(--ease-out), height 150ms var(--ease-out)',
      zIndex: 40,
      animation: 'soft-in 180ms var(--ease-out)',
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        borderRadius: 13,
        border: `2px solid var(--accent)`,
      }}/>
      {dwell > 0 && (
        <svg width={rw} height={rh} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <rect x="1" y="1" width={rw-2} height={rh-2} rx="12" ry="12"
            fill="none" stroke="var(--accent)" strokeWidth="2.5"
            strokeDasharray={perim}
            strokeDashoffset={perim * (1 - dwell)}
            style={{ transition: 'stroke-dashoffset 80ms linear' }}
            strokeLinecap="round"
          />
        </svg>
      )}
    </div>
  );
};

// Clean toast — no glow, just card.
const Toast = ({ toast }) => {
  if (!toast) return null;
  const isWarn = toast.variant === 'warning';
  const isBrowse = toast.variant === 'browse';
  return (
    <div key={toast.id} style={{
      position: 'fixed', top: 84, left: '50%', transform: 'translateX(-50%)',
      zIndex: 50, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 16px 10px 12px',
      background: 'var(--surface)',
      border: `1px solid ${isWarn ? 'rgba(208,72,72,0.3)' : 'var(--border-mid)'}`,
      borderRadius: 12,
      boxShadow: 'var(--shadow-card)',
      animation: 'soft-in 220ms var(--ease-out)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: isWarn ? 'var(--red-dim)' : isBrowse ? 'var(--accent-dim-2)' : 'var(--surface-3)',
        color: isWarn ? 'var(--red)' : isBrowse ? 'var(--accent)' : 'var(--text-2)',
        display: 'grid', placeItems: 'center',
      }}>{toast.icon}</div>
      <div style={{ display: 'flex', flexDirection: 'column', paddingRight: 4 }}>
        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text)' }}>{toast.label}</span>
        {toast.subtitle && <span style={{ fontSize: 11.5, color: 'var(--text-2)', marginTop: 1 }}>{toast.subtitle}</span>}
      </div>
    </div>
  );
};

Object.assign(window, { FocusRing, Toast });
