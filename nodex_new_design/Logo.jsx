// Refined logo — simpler mark, no reticles, no glow.
const NodexLogo = ({ size = 22 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ display: 'block' }}>
    <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--accent)" opacity="0.08"/>
    <rect x="1" y="1" width="22" height="22" rx="6" stroke="var(--accent)" strokeWidth="1" opacity="0.35"/>
    <path d="M8 8c0-1.5 1.2-2.5 3-2.5 4 0 5 3 5 5.5v3c0 .5-.3.8-.8.8H14.5c0 1.8-1 3-2.5 3H9.5"
      stroke="var(--accent)" strokeWidth="1.3" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    <circle cx="13" cy="11" r="0.9" fill="var(--accent)"/>
  </svg>
);

const NodexWordmark = ({ size = 14 }) => (
  <span style={{
    fontFamily: 'var(--font-ui)',
    fontWeight: 600,
    fontSize: size,
    letterSpacing: '-0.015em',
    color: 'var(--text)',
  }}>Nodex</span>
);

Object.assign(window, { NodexLogo, NodexWordmark });
