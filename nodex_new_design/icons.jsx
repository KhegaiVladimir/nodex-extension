// Refined icon set — thin strokes, minimal.
const Icon = ({ size = 16, sw = 1.5, children }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
    {children}
  </svg>
);

const IconPlay = (p) => <Icon {...p}><path d="M7 5l12 7-12 7V5z" fill="currentColor" stroke="none"/></Icon>;
const IconPause = (p) => <Icon {...p}><rect x="7" y="5" width="3" height="14" rx="0.5" fill="currentColor" stroke="none"/><rect x="14" y="5" width="3" height="14" rx="0.5" fill="currentColor" stroke="none"/></Icon>;
const IconVolUp = (p) => <Icon {...p}><path d="M4 10v4h3l4 4V6l-4 4H4z"/><path d="M16 8a5 5 0 010 8M19 5a8 8 0 010 14"/></Icon>;
const IconSkip = (p) => <Icon {...p}><path d="M13 5l7 7-7 7V5zM4 5l7 7-7 7V5z" fill="currentColor" stroke="none"/></Icon>;
const IconRewind = (p) => <Icon {...p}><path d="M11 19L4 12l7-7v14zM20 19l-7-7 7-7v14z" fill="currentColor" stroke="none"/></Icon>;
const IconBack = (p) => <Icon {...p}><path d="M11 17l-5-5 5-5M6 12h13"/></Icon>;
const IconBrowse = (p) => <Icon {...p}><rect x="3" y="4" width="7" height="7" rx="1"/><rect x="14" y="4" width="7" height="7" rx="1"/><rect x="3" y="15" width="7" height="5" rx="1"/><rect x="14" y="15" width="7" height="5" rx="1"/></Icon>;
const IconPlayer = (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9l5 3-5 3V9z" fill="currentColor" stroke="none"/></Icon>;
const IconWarning = (p) => <Icon {...p}><path d="M12 3l10 18H2L12 3z"/><path d="M12 10v5"/><circle cx="12" cy="18" r="0.5" fill="currentColor"/></Icon>;
const IconCheck = (p) => <Icon {...p}><path d="M4 12l5 5L20 6"/></Icon>;
const IconArrowLeft = (p) => <Icon {...p}><path d="M14 6l-6 6 6 6"/></Icon>;
const IconArrowRight = (p) => <Icon {...p}><path d="M10 6l6 6-6 6"/></Icon>;
const IconCamera = (p) => <Icon {...p}><path d="M4 7h4l2-2h4l2 2h4v12H4V7z"/><circle cx="12" cy="13" r="3.5"/></Icon>;
const IconSun = (p) => <Icon {...p}><circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/></Icon>;
const IconMoon = (p) => <Icon {...p}><path d="M20 14a8 8 0 11-10-10 6 6 0 0010 10z"/></Icon>;
const IconMonitor = (p) => <Icon {...p}><rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/></Icon>;
const IconFace = (p) => <Icon {...p}><circle cx="12" cy="12" r="8"/><circle cx="9.5" cy="10.5" r="0.6" fill="currentColor"/><circle cx="14.5" cy="10.5" r="0.6" fill="currentColor"/><path d="M9 15c.8.9 1.8 1.4 3 1.4s2.2-.5 3-1.4"/></Icon>;
const IconNodLR = (p) => <Icon {...p}><circle cx="12" cy="9" r="3.5"/><path d="M5 14l-2 2 2 2M19 14l2 2-2 2M3 16h18"/></Icon>;
const IconNodUD = (p) => <Icon {...p}><circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M10 5l2-2 2 2M10 19l2 2 2-2"/></Icon>;
const IconTilt = (p) => <Icon {...p}><circle cx="12" cy="12" r="3.5"/><path d="M5 17c2-3 4-4.5 7-4.5s5 1.5 7 4.5"/></Icon>;
const IconBlink = (p) => <Icon {...p}><path d="M2 12c2-3.5 6-5.5 10-5.5s8 2 10 5.5"/><path d="M2 12c2 3.5 6 5.5 10 5.5s8-2 10-5.5"/></Icon>;
const IconShield = (p) => <Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/></Icon>;
const IconClose = (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>;
const IconClock = (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>;
const IconChevronDown = (p) => <Icon {...p}><path d="M6 9l6 6 6-6"/></Icon>;
const IconChevronRight = (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>;
const IconSettings = (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></Icon>;
const IconVolDown = (p) => <Icon {...p}><path d="M4 10v4h3l4 4V6l-4 4H4z"/><path d="M16 10l4 4M20 10l-4 4"/></Icon>;
const IconCalibration = ({ size=16, stroke='currentColor' }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 4v2M12 18v2M4 12h2M18 12h2"/><circle cx="12" cy="12" r="2"/></svg>;

Object.assign(window, {
  Icon, IconPlay, IconPause, IconVolUp, IconVolDown, IconSkip, IconRewind, IconBack,
  IconBrowse, IconPlayer, IconWarning, IconCheck, IconArrowLeft, IconArrowRight,
  IconCamera, IconSun, IconMoon, IconMonitor, IconFace, IconNodLR, IconNodUD,
  IconTilt, IconBlink, IconShield, IconClose, IconClock, IconChevronDown,
  IconChevronRight, IconSettings, IconCalibration,
});
