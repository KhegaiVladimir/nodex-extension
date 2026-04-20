/**
 * OnboardingOverlay — content script, Shadow DOM, zero dependencies.
 *
 * Mounts a full-viewport guided setup flow directly on the YouTube page.
 * Survives SPA navigation (position:fixed in Shadow DOM). Unmounts itself
 * when the user finishes or when `onboarding_complete` is set in storage.
 *
 * Metrics (yaw / pitch / EAR) are received directly from NodexPersistent
 * via _overlayMetricsListener — no chrome.runtime round-trip needed since
 * we share the same JS context as GestureEngine.
 */
import { computeBlinkThreshold } from '../shared/utils/blinkCalibration.js'
import { GESTURES } from '../shared/constants/gestures.js'
import { saveCalibration } from '../shared/storage.js'

const ACCENT         = '#6ee7c7'
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches

// ─── SVG Icons (inline, no external deps) ────────────────────────────────────

const I = {
  face: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/><path d="M19 3l2 2-2 2"/><path d="M5 3L3 5l2 2"/></svg>`,
  cam:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,
  lock: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
  eye:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12S5 5 12 5s11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>`,
  arL:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18 9 12l6-6"/></svg>`,
  arR:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M9 18l6-6-6-6"/></svg>`,
  arU:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 15l-6-6-6 6"/></svg>`,
  chk:  `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M20 6 9 17l-5-5"/></svg>`,
}

// ─── Stylesheet ───────────────────────────────────────────────────────────────

const DUR = REDUCED_MOTION ? '120ms' : '300ms'
const DUR_SLOW = REDUCED_MOTION ? '120ms' : '400ms'
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)'
const EASE   = 'cubic-bezier(0.2, 0, 0, 1)'

const CSS = /* css */`
  :host {
    all: initial;
    position: fixed;
    inset: 0;
    z-index: 2147483647;
    pointer-events: none;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "Ubuntu", sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  /* ── Backdrop ── */
  .backdrop {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.72);
    backdrop-filter: blur(10px) saturate(0.6);
    -webkit-backdrop-filter: blur(10px) saturate(0.6);
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: all;
    opacity: 0;
    transition: opacity ${REDUCED_MOTION ? '120ms' : '250ms'} ${EASE};
  }
  .backdrop.visible { opacity: 1; }

  /* ── Card ── */
  .card {
    width: 480px;
    max-width: calc(100vw - 32px);
    max-height: calc(100vh - 48px);
    overflow-y: auto;
    overflow-x: hidden;
    background: rgba(10,11,13,0.96);
    border: 1px solid rgba(255,255,255,0.07);
    border-radius: 22px;
    box-shadow:
      0 0 0 1px rgba(255,255,255,0.03),
      0 8px 24px rgba(0,0,0,0.4),
      0 24px 64px rgba(0,0,0,0.5),
      0 48px 100px rgba(0,0,0,0.55);
    padding: 40px 40px 36px;
    opacity: 0;
    transform: ${REDUCED_MOTION ? 'none' : 'translateY(18px) scale(0.97)'};
    transition:
      opacity ${DUR_SLOW} ${SPRING},
      transform ${DUR_SLOW} ${SPRING};
    scrollbar-width: none;
    -ms-overflow-style: none;
  }
  .card::-webkit-scrollbar { display: none; }
  .card.visible { opacity: 1; transform: none; }

  /* ── Step header (back button + dots) ── */
  .step-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
  }
  .btn-back {
    display: flex;
    align-items: center;
    gap: 5px;
    background: none;
    border: none;
    cursor: pointer;
    color: rgba(255,255,255,0.28);
    font-family: inherit;
    font-size: 13px;
    padding: 6px 2px;
    border-radius: 8px;
    transition: color 120ms ${EASE};
    outline: none;
    visibility: hidden;
  }
  .btn-back.visible { visibility: visible; }
  .btn-back:hover  { color: rgba(255,255,255,0.60); }
  .btn-back:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 2px; }
  .btn-back svg { width: 16px; height: 16px; }

  .dots { display: flex; gap: 6px; align-items: center; }
  .dot {
    height: 5px;
    width: 5px;
    border-radius: 3px;
    background: rgba(255,255,255,0.10);
    transition: background ${DUR} ${EASE}, width ${DUR} ${EASE};
    flex-shrink: 0;
  }
  .dot.active { width: 22px; background: ${ACCENT}; }
  .dot.done   { background: rgba(110,231,199,0.3); }

  .header-spacer { width: 54px; }

  /* ── Step content transition ── */
  .step-content {
    opacity: 1;
    transform: none;
    transition:
      opacity ${REDUCED_MOTION ? '80ms' : '180ms'} ${EASE},
      transform ${REDUCED_MOTION ? '80ms' : '180ms'} ${EASE};
  }
  .step-content.exit  { opacity: 0; transform: ${REDUCED_MOTION ? 'none' : 'translateY(-8px)'}; }
  .step-content.enter { opacity: 0; transform: ${REDUCED_MOTION ? 'none' : 'translateY(8px)'}; }

  /* ── Typography ── */
  .label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.25);
    margin-bottom: 10px;
  }
  .title {
    font-size: 26px;
    font-weight: 700;
    letter-spacing: -0.025em;
    color: rgba(255,255,255,0.95);
    line-height: 1.2;
    margin-bottom: 10px;
  }
  .body {
    font-size: 14.5px;
    line-height: 1.65;
    color: rgba(255,255,255,0.48);
    margin-bottom: 28px;
  }

  /* ── Buttons ── */
  .btn {
    display: block;
    width: 100%;
    height: 44px;
    border: none;
    border-radius: 11px;
    cursor: pointer;
    font-family: inherit;
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    transition: transform 120ms ${EASE}, opacity 120ms ${EASE};
    outline: none;
    -webkit-tap-highlight-color: transparent;
  }
  .btn:focus-visible { outline: 2px solid ${ACCENT}; outline-offset: 3px; }
  .btn:disabled { opacity: 0.35; cursor: not-allowed; transform: none !important; }

  .btn-primary { background: ${ACCENT}; color: #080a0b; }
  .btn-primary:hover:not(:disabled) { opacity: 0.9; }
  .btn-primary:active:not(:disabled) { transform: scale(0.98); }

  .btn-ghost {
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.08);
    color: rgba(255,255,255,0.32);
    height: 40px;
    margin-top: 6px;
    font-size: 13px;
    font-weight: 500;
  }
  .btn-ghost:hover { color: rgba(255,255,255,0.55); background: rgba(255,255,255,0.07); }

  /* ── Feature rows (step 1) ── */
  .logo-wrap {
    text-align: center;
    margin-bottom: 30px;
  }
  .logo-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 56px;
    height: 56px;
    border-radius: 16px;
    background: rgba(110,231,199,0.07);
    border: 1px solid rgba(110,231,199,0.16);
    margin-bottom: 16px;
    color: ${ACCENT};
  }
  .logo-icon svg { width: 26px; height: 26px; }
  .logo-name {
    display: block;
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.035em;
    color: rgba(255,255,255,0.96);
    line-height: 1;
  }
  .logo-sub {
    font-size: 13.5px;
    color: rgba(255,255,255,0.34);
    margin-top: 6px;
  }

  .features { display: flex; flex-direction: column; gap: 7px; margin-bottom: 30px; }
  .feature {
    display: flex;
    gap: 14px;
    align-items: center;
    padding: 13px 14px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.055);
    border-radius: 12px;
  }
  .feature-icon {
    width: 33px; height: 33px;
    border-radius: 9px;
    background: rgba(255,255,255,0.055);
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    color: rgba(255,255,255,0.4);
    flex-shrink: 0;
  }
  .feature-icon svg { width: 16px; height: 16px; }
  .feature-h { font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.86); margin-bottom: 2px; }
  .feature-p { font-size: 12px; color: rgba(255,255,255,0.38); line-height: 1.5; }

  /* ── Camera visual (step 2) ── */
  .cam-visual {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
  }
  .cam-ring {
    position: relative;
    width: 100px;
    height: 100px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cam-pulse {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 1.5px solid rgba(110,231,199,0.25);
    animation: ${REDUCED_MOTION ? 'none' : 'rpulse 2.4s ease-in-out infinite'};
  }
  .cam-pulse-2 {
    position: absolute;
    inset: -16px;
    border-radius: 50%;
    border: 1px solid rgba(110,231,199,0.09);
    animation: ${REDUCED_MOTION ? 'none' : 'rpulse 2.4s ease-in-out infinite 0.5s'};
  }
  .cam-inner {
    width: 68px;
    height: 68px;
    border-radius: 50%;
    background: rgba(110,231,199,0.06);
    border: 1.5px solid rgba(110,231,199,0.20);
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${ACCENT};
    transition: background ${DUR} ${EASE}, border-color ${DUR} ${EASE};
  }
  .cam-inner.ready { background: rgba(110,231,199,0.13); border-color: ${ACCENT}; }
  .cam-inner svg { width: 27px; height: 27px; }

  @keyframes rpulse {
    0%, 100% { transform: scale(1); opacity: 0.85; }
    50%       { transform: scale(1.15); opacity: 0.25; }
  }

  /* ── Status row ── */
  .status {
    display: flex;
    align-items: center;
    gap: 9px;
    min-height: 22px;
    margin-bottom: 22px;
  }
  .sdot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
    background: rgba(255,255,255,0.16);
    transition: background ${DUR} ${EASE};
  }
  .sdot.on  { background: ${ACCENT}; }
  .sdot.err { background: #ff5d5d; }
  .stext {
    font-size: 13px;
    color: rgba(255,255,255,0.36);
    transition: color ${DUR} ${EASE};
  }
  .stext.on  { color: ${ACCENT}; }
  .stext.err { color: #ff5d5d; }

  /* ── No-face warning (step 3) ── */
  .no-face-warn {
    display: none;
    align-items: center;
    gap: 10px;
    padding: 11px 14px;
    background: rgba(228,168,74,0.07);
    border: 1px solid rgba(228,168,74,0.20);
    border-radius: 10px;
    margin-bottom: 16px;
    font-size: 13px;
    color: rgba(228,168,74,0.9);
    line-height: 1.45;
  }
  .no-face-warn.show { display: flex; }
  .no-face-warn svg { width: 16px; height: 16px; flex-shrink: 0; opacity: 0.8; }

  /* ── Pose bars (step 3) ── */
  .bars { display: flex; flex-direction: column; gap: 13px; margin-bottom: 22px; }
  .bar-row { display: flex; align-items: center; gap: 12px; }
  .bar-lbl {
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(255,255,255,0.28);
    width: 32px;
    flex-shrink: 0;
  }
  .bar-track {
    flex: 1;
    height: 5px;
    background: rgba(255,255,255,0.06);
    border-radius: 3px;
    position: relative;
    overflow: hidden;
  }
  .bar-fill {
    position: absolute;
    top: 0; bottom: 0;
    left: 50%;
    transform: translateX(-50%);
    width: 2px;
    border-radius: 3px;
    background: rgba(255,255,255,0.18);
    transition: background 0.35s ${EASE};
  }
  .bar-fill.stable { background: ${ACCENT}; }
  .bar-val {
    width: 42px;
    font-size: 11px;
    font-family: ui-monospace, "SF Mono", "Cascadia Mono", "Consolas", monospace;
    color: rgba(255,255,255,0.25);
    text-align: right;
    flex-shrink: 0;
  }

  /* ── Countdown circle ── */
  .cd-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 18px;
  }
  .cd-svg { width: 60px; height: 60px; }
  .cd-bg { stroke: rgba(255,255,255,0.07); fill: none; stroke-width: 3; }
  .cd-arc {
    stroke: ${ACCENT};
    fill: none;
    stroke-width: 3;
    stroke-linecap: round;
    transform-origin: center;
    transform: rotate(-90deg);
    transition: stroke-dashoffset 80ms linear;
  }
  .cd-num {
    font-size: 17px;
    font-weight: 700;
    fill: rgba(255,255,255,0.72);
    dominant-baseline: middle;
    text-anchor: middle;
  }

  /* ── Eye SVG (step 4) ── */
  .eye-wrap {
    display: flex;
    justify-content: center;
    margin-bottom: 28px;
    height: 76px;
  }
  .eye-svg { width: 180px; height: 76px; overflow: visible; }

  /* ── Tutorial gesture cards (step 5) ── */
  .grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 9px;
    margin-bottom: 26px;
  }
  .gcard {
    padding: 20px 12px 16px;
    background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.065);
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    transition: background ${DUR} ${EASE}, border-color ${DUR} ${EASE};
  }
  .gcard.done {
    background: rgba(110,231,199,0.06);
    border-color: rgba(110,231,199,0.26);
  }
  .gcard-icon {
    width: 40px; height: 40px;
    border-radius: 12px;
    background: rgba(255,255,255,0.055);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(255,255,255,0.38);
    transition: color ${DUR} ${EASE}, background ${DUR} ${EASE};
  }
  .gcard-icon svg { width: 20px; height: 20px; }
  .gcard.done .gcard-icon { color: ${ACCENT}; background: rgba(110,231,199,0.10); }
  .gcard-lbl {
    font-size: 12px;
    font-weight: 500;
    color: rgba(255,255,255,0.38);
    text-align: center;
    transition: color ${DUR} ${EASE};
    line-height: 1.35;
  }
  .gcard.done .gcard-lbl { color: rgba(255,255,255,0.80); }
  .gcheck {
    width: 22px; height: 22px;
    border-radius: 50%;
    background: ${ACCENT};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #080a0b;
    opacity: 0;
    transform: scale(0.4);
    transition: opacity ${DUR} ${SPRING}, transform ${DUR} ${SPRING};
  }
  .gcard.done .gcheck { opacity: 1; transform: scale(1); }
  .gcheck svg { width: 12px; height: 12px; }

  /* ── Success icon ── */
  .success-wrap { display: flex; justify-content: center; margin-bottom: 22px; }
  .success-circle {
    width: 68px; height: 68px;
    border-radius: 50%;
    background: rgba(74,222,128,0.10);
    border: 1.5px solid rgba(74,222,128,0.25);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #4ade80;
    animation: ${REDUCED_MOTION ? 'none' : 'pop 0.5s cubic-bezier(0.34,1.56,0.64,1)'};
  }
  .success-circle svg { width: 30px; height: 30px; }

  @keyframes pop {
    from { transform: scale(0.5); opacity: 0; }
    to   { transform: scale(1);   opacity: 1; }
  }

  /* ── Error text ── */
  .err {
    display: none;
    font-size: 13px;
    color: #ff5d5d;
    margin-top: 12px;
    line-height: 1.5;
    padding: 10px 14px;
    background: rgba(255,93,93,0.07);
    border: 1px solid rgba(255,93,93,0.18);
    border-radius: 9px;
  }
`

// ─── Class ────────────────────────────────────────────────────────────────────

export class OnboardingOverlay {
  /**
   * @param {object} persistent  NodexPersistent instance (same JS context)
   */
  constructor(persistent) {
    this._p = persistent

    // DOM refs
    this._host    = null
    this._shadow  = null
    this._card    = null
    this._content = null  // current step-content div

    // State
    this._step     = 0
    this._dead     = false

    // Step 2 — camera
    this._camStarted = false
    this._camReady   = false

    // Step 3 — neutral pose
    this._neutralEl          = null
    this._neutralYaws        = []
    this._neutralPitches     = []
    this._neutralStableMs    = null
    this._neutralDone        = false
    this._capturedBaseline   = null  // { yaw, pitch }

    // Step 4 — blink calibration
    this._blinkEl      = null
    this._blinkPhase   = 'idle'  // idle | open | await_close | closed | done
    this._openSamples  = []
    this._closedSamples = []
    this._blinkTimer   = null

    // Step 4 — live eye animation
    this._earSmooth    = 0.32
    this._earTarget    = 0.32
    this._rafId        = null

    // Step 5 — tutorial
    this._tutorialEl   = null
    this._done         = new Set()

    // No-face detection (neutral step)
    this._lastMetricAt    = 0
    this._noFaceTimerRef  = null

    // Bound listeners — hooked onto NodexPersistent directly
    this._onMetrics = this._handleMetrics.bind(this)
    this._onCommand = this._handleCommand.bind(this)
  }

  // ── Mount ──────────────────────────────────────────────────────────────────

  mount() {
    if (this._host || this._dead) return

    this._host   = document.createElement('div')
    this._shadow = this._host.attachShadow({ mode: 'open' })

    const style = document.createElement('style')
    style.textContent = CSS
    this._shadow.appendChild(style)

    const backdrop = document.createElement('div')
    backdrop.className = 'backdrop'
    backdrop.setAttribute('role', 'dialog')
    backdrop.setAttribute('aria-modal', 'true')
    backdrop.setAttribute('aria-label', 'Nodex setup')
    this._backdrop = backdrop
    this._shadow.appendChild(backdrop)

    this._card = document.createElement('div')
    this._card.className = 'card'
    backdrop.appendChild(this._card)

    document.documentElement.appendChild(this._host)

    // Wire metrics & command listeners into the persistent singleton
    this._p._overlayMetricsListener = this._onMetrics
    this._p._overlayCommandListener = this._onCommand

    // Block gesture engine immediately — gestures should not fire on YouTube
    // during onboarding. Tutorial step (4) unblocks and uses tutorialMode instead.
    this._p._gestureEngine?.updateSettings({ blocked: true })

    // Animate backdrop then card
    requestAnimationFrame(() => {
      backdrop.classList.add('visible')
      setTimeout(() => {
        this._card.classList.add('visible')
        this._goStep(0)
      }, REDUCED_MOTION ? 0 : 120)
    })
  }

  // ── Unmount ────────────────────────────────────────────────────────────────

  unmount() {
    if (this._dead) return
    this._dead = true

    // Detach listeners
    this._p._overlayMetricsListener = null
    this._p._overlayCommandListener = null

    // Cancel pending timers / rAF
    if (this._rafId)     { cancelAnimationFrame(this._rafId); this._rafId = null }
    if (this._blinkTimer){ clearTimeout(this._blinkTimer);    this._blinkTimer = null }
    this._clearNoFaceTimer()

    // Unblock engine if we left it blocked
    this._p._gestureEngine?.updateSettings({ blocked: false })
    // End tutorial mode if active
    if (this._p._tutorialMode) this._p._tutorialMode = false

    // Fade card up (feels like it dissolves into the page)
    if (this._card) {
      this._card.style.transition = `opacity 380ms ease-out, transform 380ms ease-out`
      this._card.style.opacity   = '0'
      this._card.style.transform = 'scale(1.025) translateY(-6px)'
    }
    if (this._backdrop) {
      this._backdrop.style.transition = 'opacity 380ms ease-out'
      this._backdrop.style.opacity    = '0'
    }
    setTimeout(() => { this._host?.remove(); this._host = null }, 420)
  }

  // ── Step navigation ────────────────────────────────────────────────────────

  /** Transition to step index, rendering new content with a cross-fade. */
  _goStep(index) {
    this._step = index

    // Build new content off-screen
    const next = document.createElement('div')
    next.className = 'step-content enter'
    this._buildHeader(next, index)

    const body = document.createElement('div')
    next.appendChild(body)

    switch (index) {
      case 0: this._buildWelcome(body);  break
      case 1: this._buildCamera(body);   break
      case 2: this._buildNeutral(body);  break
      case 3: this._buildBlink(body);    break
      case 4: this._buildTutorial(body); break
    }

    const prev = this._content

    if (prev) {
      prev.classList.add('exit')
      setTimeout(() => {
        prev.remove()
        this._appendContent(next)
      }, REDUCED_MOTION ? 60 : 190)
    } else {
      this._appendContent(next)
    }
  }

  _appendContent(el) {
    this._card.appendChild(el)
    this._content = el
    requestAnimationFrame(() => {
      el.classList.remove('enter')
      // Move focus to first interactive element
      setTimeout(() => el.querySelector('button:not(:disabled)')?.focus(), 40)
    })
  }

  _next() { if (this._step < 4) this._goStep(this._step + 1) }

  _goBack() {
    if (this._step <= 0) return

    // Clean up whatever the current step had running
    if (this._step === 2) {
      // Neutral: just reset state, camera keeps running
      this._neutralDone     = false
      this._neutralYaws     = []
      this._neutralPitches  = []
      this._neutralStableMs = null
      this._neutralEl       = null
      this._clearNoFaceTimer()
    }

    if (this._step === 3) {
      // Blink: cancel timers, stop eye animation, unblock engine
      if (this._blinkTimer) { clearTimeout(this._blinkTimer); this._blinkTimer = null }
      if (this._rafId)      { cancelAnimationFrame(this._rafId); this._rafId = null }
      this._p._gestureEngine?.updateSettings({ blocked: false })
      this._blinkPhase  = 'idle'
      this._openSamples = []
      this._closedSamples = []
      this._blinkEl     = null
    }

    if (this._step === 4) {
      // Tutorial: end tutorial mode
      this._p._tutorialMode = false
      this._tutorialEl      = null
      this._done            = new Set()
    }

    // Going back from step 2 (camera) — stop the engine if we started it,
    // so the next time the user reaches step 2 it starts fresh.
    if (this._step === 1 && this._camStarted) {
      this._p.stop()
      this._camStarted = false
      this._camReady   = false
    }

    this._goStep(this._step - 1)
  }

  // ── Step header (back button + progress dots) ─────────────────────────────

  _buildHeader(parent, active) {
    const header = document.createElement('div')
    header.className = 'step-header'

    // Back button — hidden on step 0, hidden on step 5 (tutorial; calibration saved)
    const back = document.createElement('button')
    back.className = 'btn-back' + (active > 0 && active < 5 ? ' visible' : '')
    back.setAttribute('aria-label', 'Go back')
    back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 18 9 12l6-6"/></svg>`
    back.addEventListener('click', () => this._goBack())
    header.appendChild(back)

    // Dots centred
    const dots = document.createElement('div')
    dots.className = 'dots'
    dots.setAttribute('aria-label', `Step ${active + 1} of 5`)
    for (let i = 0; i < 5; i++) {
      const d = document.createElement('div')
      d.className = 'dot' + (i === active ? ' active' : i < active ? ' done' : '')
      dots.appendChild(d)
    }
    header.appendChild(dots)

    // Spacer mirrors back button width so dots stay centred
    const spacer = document.createElement('div')
    spacer.className = 'header-spacer'
    header.appendChild(spacer)

    parent.appendChild(header)
  }

  // ── Step 1 — Welcome ──────────────────────────────────────────────────────

  _buildWelcome(el) {
    el.innerHTML = `
      <div class="logo-wrap">
        <div class="logo-icon">${I.face}</div>
        <span class="logo-name">Nodex</span>
        <p class="logo-sub">Hands-free YouTube control</p>
      </div>
      <div class="features">
        <div class="feature">
          <div class="feature-icon">${I.face}</div>
          <div>
            <div class="feature-h">Head gestures</div>
            <div class="feature-p">Nod, turn, tilt — seek, volume, play/pause without touching anything</div>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">${I.lock}</div>
          <div>
            <div class="feature-h">100% on-device</div>
            <div class="feature-p">MediaPipe runs in your browser. No video ever leaves your machine.</div>
          </div>
        </div>
        <div class="feature">
          <div class="feature-icon">${I.eye}</div>
          <div>
            <div class="feature-h">Calibrates to you</div>
            <div class="feature-p">A 2-minute setup adapts thresholds to your unique face and posture.</div>
          </div>
        </div>
      </div>
      <button class="btn btn-primary" id="ob-start">Get started →</button>
      <p style="text-align:center;font-size:11px;color:rgba(255,255,255,0.2);margin-top:12px;letter-spacing:0.02em;">Setup takes about 2 minutes</p>
    `
    el.querySelector('#ob-start').addEventListener('click', () => this._next())
  }

  // ── Step 2 — Camera ───────────────────────────────────────────────────────

  _buildCamera(el) {
    el.innerHTML = `
      <p class="label">Step 1 of 3 — Camera</p>
      <h2 class="title">Allow camera access</h2>
      <p class="body">Your video is processed locally by MediaPipe. Nothing is recorded or transmitted.</p>
      <div class="cam-visual">
        <div class="cam-ring">
          <div class="cam-pulse"></div>
          <div class="cam-pulse-2"></div>
          <div class="cam-inner" id="ob-cam-inner">${I.cam}</div>
        </div>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot" id="ob-sdot"></div>
        <span class="stext" id="ob-stext">Ready to connect</span>
      </div>
      <button class="btn btn-primary" id="ob-cam-btn">Enable camera</button>
    `

    const btn  = el.querySelector('#ob-cam-btn')
    const dot  = el.querySelector('#ob-sdot')
    const txt  = el.querySelector('#ob-stext')
    const inner= el.querySelector('#ob-cam-inner')
    let errTimer = null

    btn.addEventListener('click', () => {
      if (this._camStarted) return
      this._camStarted = true
      btn.disabled = true
      dot.className = 'sdot on'
      txt.textContent = 'Starting camera…'
      txt.className   = 'stext on'

      this._p.start()

      // Timeout: if no metric arrives in 10 s, surface an error
      errTimer = setTimeout(() => {
        if (this._camReady || this._dead) return
        dot.className = 'sdot err'
        txt.textContent = 'Camera did not start — check browser permissions'
        txt.className   = 'stext err'
        btn.disabled = false
        this._camStarted = false
      }, 10_000)

      // Signal for _handleMetrics to pick up
      this._camErrTimer = errTimer
      this._camInnerEl  = inner
    })
  }

  _signalCameraReady() {
    if (this._camReady || this._step !== 1) return
    this._camReady = true
    clearTimeout(this._camErrTimer)

    const inner = this._camInnerEl
    const dot   = this._content?.querySelector('#ob-sdot')
    const txt   = this._content?.querySelector('#ob-stext')
    if (inner) inner.classList.add('ready')
    if (dot)   dot.className  = 'sdot on'
    if (txt)   { txt.textContent = 'Camera connected'; txt.className = 'stext on' }

    setTimeout(() => this._next(), 1100)
  }

  _clearNoFaceTimer() {
    if (this._noFaceTimerRef) { clearInterval(this._noFaceTimerRef); this._noFaceTimerRef = null }
  }

  // ── Step 3 — Neutral pose ─────────────────────────────────────────────────

  _buildNeutral(el) {
    this._neutralYaws     = []
    this._neutralPitches  = []
    this._neutralStableMs = null
    this._neutralDone     = false
    this._lastMetricAt    = Date.now()
    this._clearNoFaceTimer()

    el.innerHTML = `
      <p class="label">Step 2 of 3 — Neutral Pose</p>
      <h2 class="title">Look straight ahead</h2>
      <p class="body">Hold your head the way you normally watch video. Stay still for 2 seconds to set your resting position.</p>
      <div class="no-face-warn" id="ob-noface" aria-live="polite">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17" stroke-width="2.5"/>
        </svg>
        Face not visible — move closer or check lighting, then hold still
      </div>
      <div class="bars">
        <div class="bar-row">
          <span class="bar-lbl">Yaw</span>
          <div class="bar-track"><div class="bar-fill" id="ob-yf"></div></div>
          <span class="bar-val" id="ob-yv">—</span>
        </div>
        <div class="bar-row">
          <span class="bar-lbl">Pitch</span>
          <div class="bar-track"><div class="bar-fill" id="ob-pf"></div></div>
          <span class="bar-val" id="ob-pv">—</span>
        </div>
      </div>
      <div class="cd-wrap" id="ob-cd" style="display:none;">
        <svg class="cd-svg" viewBox="0 0 60 60">
          <circle class="cd-bg" cx="30" cy="30" r="24"/>
          <circle class="cd-arc" id="ob-arc" cx="30" cy="30" r="24"
            stroke-dasharray="${(2 * Math.PI * 24).toFixed(2)}"
            stroke-dashoffset="0"/>
          <text class="cd-num" x="30" y="30" id="ob-num">2</text>
        </svg>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot on"></div>
        <span class="stext on" id="ob-ns">Hold your head still…</span>
      </div>
    `
    this._neutralEl = el

    // Poll every 1.5 s — if no metrics arrived recently, the face is lost
    this._noFaceTimerRef = setInterval(() => {
      if (this._dead || !this._neutralEl || this._neutralDone) {
        this._clearNoFaceTimer()
        return
      }
      const warn = this._neutralEl.querySelector('#ob-noface')
      if (!warn) return
      const lost = Date.now() - this._lastMetricAt > 1800
      warn.classList.toggle('show', lost)
      // Reset stability counter when face is lost so we don't count stale frames
      if (lost) this._neutralStableMs = null
    }, 800)
  }

  _tickNeutral(yaw, pitch) {
    const el = this._neutralEl
    if (!el || this._neutralDone) return

    // Rolling window — keep last 24 frames (~0.8 s at 30 fps)
    this._neutralYaws.push(yaw)
    this._neutralPitches.push(pitch)
    if (this._neutralYaws.length > 24) {
      this._neutralYaws.shift()
      this._neutralPitches.shift()
    }

    // Stability = spread (max−min) of the window is small.
    // This lets the user sit at ANY natural angle — we capture it as-is.
    const spread = (arr) => arr.length < 2 ? 99 : Math.max(...arr) - Math.min(...arr)
    const stable = this._neutralYaws.length >= 12 &&
                   spread(this._neutralYaws)   < 3.5 &&
                   spread(this._neutralPitches) < 3.5

    const yf  = el.querySelector('#ob-yf')
    const pf  = el.querySelector('#ob-pf')
    const yv  = el.querySelector('#ob-yv')
    const pv  = el.querySelector('#ob-pv')
    const ns  = el.querySelector('#ob-ns')
    const cd  = el.querySelector('#ob-cd')
    const arc = el.querySelector('#ob-arc')
    const num = el.querySelector('#ob-num')

    if (!yf) return  // element gone (step changed)

    // Bars show movement magnitude relative to the window median, not to zero
    const median = (arr) => {
      const s = [...arr].sort((a, b) => a - b)
      const m = Math.floor(s.length / 2)
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
    }
    const yMed = this._neutralYaws.length ? median(this._neutralYaws) : 0
    const pMed = this._neutralPitches.length ? median(this._neutralPitches) : 0
    const yDelta = Math.abs(yaw - yMed)
    const pDelta = Math.abs(pitch - pMed)

    // Bar fill grows with movement, shrinks when still
    yf.style.width = Math.min(Math.max(yDelta / 4, 0.05) * 100, 100) + '%'
    pf.style.width = Math.min(Math.max(pDelta / 4, 0.05) * 100, 100) + '%'
    yf.classList.toggle('stable', stable)
    pf.classList.toggle('stable', stable)
    yv.textContent = (yaw >= 0 ? '+' : '') + yaw.toFixed(1) + '°'
    pv.textContent = (pitch >= 0 ? '+' : '') + pitch.toFixed(1) + '°'

    if (stable) {
      if (!this._neutralStableMs) this._neutralStableMs = Date.now()
      const elapsed = Date.now() - this._neutralStableMs
      const circ    = 2 * Math.PI * 24
      const frac    = Math.min(elapsed / 2000, 1)

      cd.style.display = 'flex'
      arc.style.strokeDashoffset = String(circ * (1 - frac))
      num.textContent = frac >= 1 ? '✓' : String(Math.max(0, Math.ceil((2000 - elapsed) / 1000)))
      if (ns) { ns.textContent = 'Hold still…'; ns.className = 'stext on' }

      if (elapsed >= 2000 && !this._neutralDone) {
        // Capture the median of the window as the true neutral pose
        const capturedYaw   = median(this._neutralYaws)
        const capturedPitch = median(this._neutralPitches)
        this._neutralDone      = true
        this._neutralEl        = null
        this._capturedBaseline = { yaw: capturedYaw, pitch: capturedPitch }
        this._clearNoFaceTimer()
        void this._saveNeutralAndAdvance(capturedYaw, capturedPitch)
      }
    } else {
      this._neutralStableMs = null
      cd.style.display = 'none'
      if (ns) { ns.textContent = 'Hold your head still…'; ns.className = 'stext' }
    }
  }

  async _saveNeutralAndAdvance(yaw, pitch) {
    try {
      this._p._gestureEngine?.setNeutralPose({
        yawBaseline:   yaw,
        pitchBaseline: pitch,
        rollBaseline:  0,
      })
      await saveCalibration({ yaw, pitch, roll: 0 })
    } catch (e) {
      console.error('[Nodex] overlay: neutral save failed', e)
    }
    this._next()
  }

  // ── Step 4 — Blink calibration ────────────────────────────────────────────

  _buildBlink(el) {
    // Reset state
    this._blinkPhase    = 'open'
    this._openSamples   = []
    this._closedSamples = []
    this._earSmooth     = 0.32
    this._earTarget     = 0.32
    if (this._blinkTimer) { clearTimeout(this._blinkTimer); this._blinkTimer = null }

    el.innerHTML = `
      <p class="label">Step 3 of 3 — Eye Blink</p>
      <h2 class="title">Calibrate your blink</h2>
      <p class="body" id="ob-bb">Keep your eyes open naturally. We're sampling your baseline — 3 seconds.</p>
      <div class="eye-wrap">
        <svg class="eye-svg" viewBox="0 0 180 76">
          <defs>
            <clipPath id="ob-eye-clip">
              <path d="M8,38 Q90,2 172,38 Q90,74 8,38 Z"/>
            </clipPath>
          </defs>
          <!-- eye white -->
          <path d="M8,38 Q90,2 172,38 Q90,74 8,38 Z"
            fill="rgba(255,255,255,0.035)"
            stroke="rgba(255,255,255,0.14)"
            stroke-width="1.5"/>
          <!-- iris ring -->
          <circle cx="90" cy="38" r="20"
            fill="rgba(91,255,216,0.12)"
            stroke="rgba(91,255,216,0.45)"
            stroke-width="1.5"/>
          <!-- pupil -->
          <circle cx="90" cy="38" r="9"
            fill="rgba(91,255,216,0.65)"/>
          <!-- upper eyelid — closes down from top -->
          <rect id="ob-lid-t" x="0" y="0" width="180" height="40"
            fill="rgba(12,12,12,0.98)"
            clip-path="url(#ob-eye-clip)"
            style="transform-origin: 90px 0px; transform: scaleY(0);"/>
          <!-- lower eyelid — closes up from bottom -->
          <rect id="ob-lid-b" x="0" y="36" width="180" height="40"
            fill="rgba(12,12,12,0.98)"
            clip-path="url(#ob-eye-clip)"
            style="transform-origin: 90px 76px; transform: scaleY(0);"/>
        </svg>
      </div>
      <div class="status" aria-live="polite">
        <div class="sdot on" id="ob-bsdot"></div>
        <span class="stext on" id="ob-bst">Sampling open eyes… 3s</span>
      </div>
      <button class="btn btn-primary" id="ob-blink-btn" style="display:none;">Close my eyes now</button>
      <div class="err" id="ob-berr"></div>
    `
    this._blinkEl = el

    // Block gestures during calibration so no accidental triggers
    this._p._gestureEngine?.updateSettings({ blocked: true })

    // Start eye animation loop
    this._startEyeAnim()

    // Auto-advance from open phase after 3 s
    this._blinkTimer = setTimeout(() => {
      this._blinkTimer  = null
      this._blinkPhase  = 'await_close'
      this._p._gestureEngine?.updateSettings({ blocked: false })

      const bb  = el.querySelector('#ob-bb')
      const bst = el.querySelector('#ob-bst')
      const dot = el.querySelector('#ob-bsdot')
      const btn = el.querySelector('#ob-blink-btn')

      if (bb)  bb.textContent  = `Open-eye baseline captured (${this._openSamples.length} frames). Now gently close your eyes when ready.`
      if (bst) { bst.textContent = 'Ready for closed-eye phase'; bst.className = 'stext' }
      if (dot) dot.className   = 'sdot'
      if (btn) btn.style.display = 'block'
      btn?.addEventListener('click', () => this._startClosedPhase(el))
    }, 3100)
  }

  _startEyeAnim() {
    if (this._rafId) cancelAnimationFrame(this._rafId)
    const tick = () => {
      if (this._dead || !this._blinkEl) return

      // Lerp the displayed EAR toward the latest target (0.3 per frame ≈ smooth at 30fps)
      this._earSmooth += (this._earTarget - this._earSmooth) * 0.28

      // Map EAR to lid closure:
      // earOpen ~0.30 → lidScale = 0 (fully open)
      // earClosed ~0.08 → lidScale = 1 (fully closed)
      const EAR_OPEN   = 0.30
      const EAR_CLOSED = 0.09
      const t = 1 - Math.max(0, Math.min(1, (this._earSmooth - EAR_CLOSED) / (EAR_OPEN - EAR_CLOSED)))

      const lidT = this._blinkEl.querySelector('#ob-lid-t')
      const lidB = this._blinkEl.querySelector('#ob-lid-b')
      if (lidT) lidT.style.transform = `scaleY(${t.toFixed(3)})`
      if (lidB) lidB.style.transform = `scaleY(${t.toFixed(3)})`

      this._rafId = requestAnimationFrame(tick)
    }
    this._rafId = requestAnimationFrame(tick)
  }

  _startClosedPhase(el) {
    if (this._blinkPhase !== 'await_close') return
    this._blinkPhase    = 'closed'
    this._closedSamples = []

    const btn = el.querySelector('#ob-blink-btn')
    const bst = el.querySelector('#ob-bst')
    const dot = el.querySelector('#ob-bsdot')
    const err = el.querySelector('#ob-berr')

    if (btn) btn.style.display = 'none'
    if (err) err.style.display = 'none'
    if (dot) dot.className = 'sdot on'
    if (bst) { bst.textContent = 'Listening for countdown…'; bst.className = 'stext on' }

    this._p._gestureEngine?.updateSettings({ blocked: true })
    this._speakCountdown()

    // Collect closed-eye samples for 3.2 s (countdown is 2.8 s, extra 0.4 s buffer)
    this._blinkTimer = setTimeout(async () => {
      this._blinkTimer = null
      this._p._gestureEngine?.updateSettings({ blocked: false })
      await this._finishBlink(el)
    }, 3200)
  }

  _speakCountdown() {
    const say = (text, delayMs) => setTimeout(() => {
      try {
        const u = new SpeechSynthesisUtterance(text)
        u.lang = 'en-US'
        u.rate = 1
        window.speechSynthesis.speak(u)
      } catch (_) { /* ignore if speechSynthesis unavailable */ }
    }, delayMs)
    say('Close your eyes.', 0)
    say('Three', 700)
    say('Two',   1400)
    say('One',   2100)
    say('Open',  2800)
  }

  async _finishBlink(el) {
    const result = computeBlinkThreshold(this._openSamples, this._closedSamples)

    if (!result.ok) {
      const errEl = el.querySelector('#ob-berr')
      const btn   = el.querySelector('#ob-blink-btn')
      const bst   = el.querySelector('#ob-bst')
      const dot   = el.querySelector('#ob-bsdot')

      if (errEl) {
        errEl.style.display = 'block'
        errEl.textContent   = result.reason === 'insufficient_range'
          ? 'Not enough contrast between open and closed — try a more deliberate close, then retry.'
          : 'Calibration failed. Retry.'
      }
      if (bst) { bst.textContent = 'Retry'; bst.className = 'stext' }
      if (dot) dot.className = 'sdot'
      if (btn) { btn.textContent = 'Try again'; btn.style.display = 'block' }

      // Reset to await_close so user can retry the closed phase
      // (open samples are still valid)
      this._blinkPhase    = 'await_close'
      this._closedSamples = []
      btn?.removeEventListener('click', this._closedBtnHandler)
      this._closedBtnHandler = () => this._startClosedPhase(el)
      btn?.addEventListener('click', this._closedBtnHandler)
      return
    }

    this._blinkPhase = 'done'

    // Apply to engine immediately
    this._p._gestureEngine?.setBlinkCalibration(result)

    // Persist
    try {
      await chrome.storage.local.set({
        earCalibration:           result,
        calibrationCompleted:     true,
        calibrationCompletedAt:   Date.now(),
      })
    } catch (e) {
      console.error('[Nodex] overlay: blink calibration save failed', e)
    }

    // Stop eye anim — step is changing
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null }
    this._blinkEl = null

    this._next()
  }

  // ── Step 5 — Tutorial ─────────────────────────────────────────────────────

  _buildTutorial(el) {
    this._done = new Set()
    this._tutorialEl = el

    // Unblock gesture engine — tutorial mode intercepts commands before YouTube
    // acts on them, so gestures are safe to fire (they route to _overlayCommandListener)
    this._p._gestureEngine?.updateSettings({ blocked: false })

    // Enable tutorial mode so gestures route to _overlayCommandListener, not YouTube
    this._p._tutorialMode         = true
    this._p._tutorialModeDeadline = Date.now() + 5 * 60 * 1_000

    const CARDS = [
      { g: GESTURES.HEAD_LEFT,   icon: I.arL, label: 'Head Left'  },
      { g: GESTURES.HEAD_RIGHT,  icon: I.arR, label: 'Head Right' },
      { g: GESTURES.HEAD_UP,     icon: I.arU, label: 'Head Up'    },
      { g: GESTURES.EYES_CLOSED, icon: I.eye, label: 'Blink'      },
    ]
    const gridHtml = CARDS.map(({ g, icon, label }) => `
      <div class="gcard" id="gc-${g}" tabindex="-1" aria-label="${label}">
        <div class="gcard-icon">${icon}</div>
        <span class="gcard-lbl">${label}</span>
        <div class="gcheck">${I.chk}</div>
      </div>
    `).join('')

    el.innerHTML = `
      <h2 class="title">Try it out</h2>
      <p class="body">Do each gesture — Nodex will confirm it detected them.</p>
      <div class="grid">${gridHtml}</div>
      <button class="btn btn-primary" id="ob-finish" style="display:none;">You're all set →</button>
      <button class="btn btn-ghost"   id="ob-skip">Skip tutorial</button>
    `
    el.querySelector('#ob-finish')?.addEventListener('click', () => this._finish())
    el.querySelector('#ob-skip')  ?.addEventListener('click', () => this._finish())
  }

  _markGesture(gesture) {
    const TUTORIAL = [GESTURES.HEAD_LEFT, GESTURES.HEAD_RIGHT, GESTURES.HEAD_UP, GESTURES.EYES_CLOSED]
    if (!TUTORIAL.includes(gesture) || this._done.has(gesture)) return

    this._done.add(gesture)
    this._tutorialEl?.querySelector(`#gc-${gesture}`)?.classList.add('done')

    if (this._done.size === TUTORIAL.length) {
      const btn  = this._tutorialEl?.querySelector('#ob-finish')
      const skip = this._tutorialEl?.querySelector('#ob-skip')
      if (btn)  btn.style.display  = 'block'
      if (skip) skip.style.display = 'none'
      btn?.focus()
    }
  }

  async _finish() {
    this._p._tutorialMode = false

    try {
      await chrome.storage.local.set({ onboarding_complete: true })
    } catch (e) {
      console.error('[Nodex] overlay: finish save failed', e)
    }

    // Show a brief success state before fading out
    if (this._content) {
      const inner = this._content
      inner.classList.add('exit')
      setTimeout(() => {
        inner.innerHTML = `
          <div style="padding:8px 0;text-align:center;">
            <div class="success-wrap">
              <div class="success-circle">${I.chk}</div>
            </div>
            <h2 class="title" style="text-align:center;margin-bottom:8px;">All set!</h2>
            <p class="body"  style="text-align:center;margin-bottom:0;">Nodex is active. Nod to control YouTube.</p>
          </div>
        `
        inner.classList.remove('exit')
      }, REDUCED_MOTION ? 60 : 180)
    }
    setTimeout(() => this.unmount(), 2200)
  }

  // ── Metrics / Command handlers ────────────────────────────────────────────

  /** Called every processed frame by NodexPersistent._gestureEngine onMetrics. */
  _handleMetrics(metrics) {
    if (this._dead) return

    // Step 2 — detect first live frame (camera is up)
    if (this._step === 1 && this._camStarted && !this._camReady) {
      this._signalCameraReady()
    }

    // Step 3 — neutral pose stability detection
    if (this._step === 2) {
      this._lastMetricAt = Date.now()
      const yaw   = typeof metrics.yaw   === 'number' ? metrics.yaw   : 0
      const pitch = typeof metrics.pitch === 'number' ? metrics.pitch : 0
      this._tickNeutral(yaw, pitch)
    }

    // Step 4 — collect EAR samples + drive eye animation
    if (this._step === 3) {
      const ear = metrics.ear
      if (typeof ear === 'number' && Number.isFinite(ear)) {
        this._earTarget = ear
        if (this._blinkPhase === 'open') {
          this._openSamples.push(ear)
        } else if (this._blinkPhase === 'closed') {
          this._closedSamples.push(ear)
        }
      }
    }
  }

  /** Called by NodexPageScoped.handleCommand when tutorialMode is active. */
  _handleCommand({ gesture }) {
    if (this._dead || this._step !== 4) return
    this._markGesture(gesture)
  }
}
