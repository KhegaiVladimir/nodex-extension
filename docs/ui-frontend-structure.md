# Nodex — Frontend & UI Structure

Complete visual and structural reference for every user-facing surface in the Nodex Chrome extension. Covers the side panel, onboarding overlay, HUD, focus ring, and all shared design tokens.

---

## 1. Design Tokens

Defined in `sidepanel/index.html` (CSS custom properties on `:root`) and mirrored inside Shadow DOM stylesheets.

### Color palette

| Token | Value | Usage |
|---|---|---|
| `--bg` | `#080808` | Page / side-panel background |
| `--surface` | `#0f0f0f` | Cards, primary surfaces |
| `--surface-2` | `#161616` | Secondary surfaces, nav bar |
| `--surface-3` | `#1e1e1e` | Input fields, tertiary wells |
| `--border` | `rgba(255,255,255,0.06)` | Subtle dividers |
| `--border-mid` | `rgba(255,255,255,0.09)` | Standard card borders |
| `--border-light` | `rgba(255,255,255,0.13)` | Hover / active borders |
| `--text` | `#f0f0f0` | Primary text |
| `--text-2` | `#a0a0a0` | Secondary / muted text |
| `--muted` | `#555` | Placeholder / disabled text |
| `--accent` / `--accent-active` | `#5bffd8` | Teal — primary CTA, highlights |
| `--accent-dim` | `rgba(91,255,216,0.08)` | Teal tinted backgrounds |
| `--accent-glow` | `rgba(91,255,216,0.18)` | Glow halos |
| `--red` | `#ff5555` | Destructive actions |
| `--amber` | `#f59e0b` | Warnings |
| `--green` | `#4ade80` | Live / active status dot |

### Typography

| Token | Stack |
|---|---|
| `--font-ui` | `system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Ubuntu', sans-serif` |
| `--font-mono` | `ui-monospace, 'SFMono-Regular', 'SF Mono', 'Cascadia Mono', 'Consolas', 'Courier New', monospace` |
| `--font-heading` | same as `--font-ui` |

Base: `font-size: 13px`, `line-height: 1.5`.

### Border radius

| Token | Value |
|---|---|
| `--radius-sm` | `8px` |
| `--radius-md` | `12px` |
| `--radius-lg` | `16px` |

### CSS animations (global)

| Class / keyframe | Definition | Usage |
|---|---|---|
| `fade-in` | `opacity 0→1, translateY 4px→0`, 0.22s ease | Section / card transitions |
| `cmd-flash` | scale 0.94→1.02→1, opacity 0→1, 0.28s spring `cubic-bezier(0.34,1.56,0.64,1)` | Last command card in main screen |
| `pulse-dot` | `box-shadow` 0→6px teal glow loop | Live status dot |
| `pulse-teal` | same as `pulse-dot` with teal color | Generic teal pulse |

---

## 2. Side Panel (`sidepanel/`)

Entry point: `sidepanel/index.html` → `sidepanel/main.jsx` → `sidepanel/App.jsx`

Width: Chrome side panel default (~360px). Dark background `var(--bg)`. Scrollbar: 3px wide, `rgba(255,255,255,0.08)` thumb.

### Layout skeleton

```
┌─────────────────────────────────────┐
│  Header (logo + version badge)      │
│  Nav tabs (3 tabs)                  │
├─────────────────────────────────────┤
│                                     │
│  Content area (active screen)       │
│                                     │
└─────────────────────────────────────┘
```

### Header

- Left: **logo mark** — 26×26px rounded square `(--radius-sm)`, teal background `rgba(91,255,216,0.12)`, `#5bffd8` border, inline SVG face icon.
- Right of mark: `NODEX` wordmark in `--font-heading`, weight 700, size 15px, letter-spacing `−0.02em`.
- Far right: version badge `v1.1` — `font-mono`, size 10px, `--accent` color, `--accent-dim` background, pill border-radius.

### Navigation bar

Three tabs: **Main**, **Calibration**, **Settings**. Each tab is a `<button>` inside `navWrap`.

Active tab: `--accent` text, `rgba(91,255,216,0.10)` background, `rgba(91,255,216,0.25)` border, `--radius-sm` border-radius.
Inactive tab: `--text-2` text, transparent background.

---

### 2.1 No-Tab State (`NoTabState`)

Shown when the extension is open on a non-YouTube page.

- Centered icon: 56×56px circle `rgba(255,255,255,0.04)` bg, `rgba(255,255,255,0.06)` border.
- Headline: "YouTube only" — `--text`, weight 600, 15px.
- Body: smaller muted text explaining the extension works on YouTube.
- Three numbered steps listed in mono `--accent` color (01, 02, 03) with step descriptions.

---

### 2.2 Main Screen (`MainScreen`)

Shown when a YouTube tab is active and the extension is running (or idle).

**Status row**
- Green/amber/muted dot with CSS animation `pulse-dot` when active.
- Status text (e.g. "Tracking active") next to dot.
- Mode badge pill (BROWSE / PLAYER): `--accent` teal when in browse mode, muted otherwise.

**Action buttons**
- **Start** (`btnPrimary`): full-width, `--accent` background, `#0a0a0a` text, `--radius-md` rounded, 44px height.
- **Stop** (`btnStop`): full-width, `rgba(255,255,255,0.06)` background, `--text-2` text.

**Last command card**
- Appears after any gesture fires.
- Dark `--surface-2` card, `--radius-md`, border `--border-mid`.
- Icon (16px SVG) + command label.
- Enters with `cmd-flash` animation (spring scale pop).

**First launch hint** (`FirstLaunchHint`)
- Teal-tinted card: `rgba(91,255,216,0.06)` bg, `rgba(91,255,216,0.18)` border.
- Teal CTA button to open calibration.

---

### 2.3 Calibration Screen (`CalibrationScreen`)

Accessed from the **Calibration** nav tab, or automatically on first launch.

**Metric tiles** — grid of vertical tiles:
- Each tile: label on top (uppercase mono), value below in `--accent` mono.
- Metrics shown: YAW, PITCH, ROLL (degrees), EAR (ratio).

**MetricBar component** (`sidepanel/MetricBar.jsx`)

Animated bar for each metric. EMA-smoothed display (α=0.14, visual only).

Two visual types:

| Type | Behavior | Metrics |
|---|---|---|
| `centered` | Grows from center left or right | YAW, PITCH, ROLL |
| `fill` | Left-to-right fill | EAR, MOUTH |

Specs:
- Bar height: 5px; wrapper height: 10px (ticks protrude above/below bar).
- Accent fill: `#64FFDA`; dim background: `rgba(100,255,218,0.22)`.
- Glow on trigger: `box-shadow: 0 0 7px rgba(100,255,218,0.50)`.
- Threshold tick marks: idle `#303030`, active `rgba(100,255,218,0.50)`.

**Calibration timestamp**: clock icon + mono timestamp, amber warning color if camera is off.

---

### 2.4 Settings Screen (`SettingsScreen`)

**Toggle component** (inline, reusable):
- 36×20px pill track.
- `--accent` fill when on, `rgba(255,255,255,0.12)` when off.
- 14px thumb with smooth `transform` transition.

**Save button**:
- Teal `--accent` background when there are unsaved changes.
- Becomes ghost (transparent bg, `--accent` text) once saved.

**Clear / Reset button**:
- Red `--red` text.
- Background `rgba(255,85,85,0.08)` on hover/confirm state.
- Two-step confirmation (first click shows confirm, second executes).

---

## 3. OnboardingOverlay (`content/OnboardingOverlay.js`)

A **full-viewport, Shadow DOM** overlay injected directly into the YouTube page. Not rendered in the side panel. Z-index `2147483647`.

### Structure

```
<div id="nodex-onboarding">  ← Shadow host, position: fixed, inset: 0
  #shadow-root
    <style>…</style>
    <div class="backdrop">   ← rgba(0,0,0,0.68) + blur(8px) saturate(0.7)
      <div class="card">     ← 480px max-width, border-radius: 22px
        .step-header         ← back button + progress dots
        .step-content        ← active step markup
      </div>
    </div>
```

### Card

- Size: 480px wide, `max-width: calc(100vw − 32px)`, scrollable vertically.
- Background: `rgba(12,12,12,0.94)`.
- Border: `1px solid rgba(255,255,255,0.07)`.
- Border-radius: 22px.
- Box-shadow: 4-layer deep shadow (4px + 16px + 48px + 96px spread).
- Padding: `40px 40px 36px`.
- Entrance animation: `translateY(20px) scale(0.97)` → `none`, spring easing `cubic-bezier(0.34,1.56,0.64,1)` 400ms.
- Respects `prefers-reduced-motion` — all animations reduced to 120ms instant.

### Progress dots

Row of 5 dots (one per step):
- Inactive: 5×5px circle, `rgba(255,255,255,0.12)`.
- **Active**: 22×5px pill (width animates), `#5bffd8`.
- Done: `rgba(91,255,216,0.35)`.
- Transition: `width 300ms ease, background 300ms ease`.

### Step transitions

Step content slides: outgoing exits with `opacity 0, translateY(-10px)`, entering comes in from `translateY(+10px)`. Duration 180ms.

### Typography

| Class | Size | Weight | Color |
|---|---|---|---|
| `.label` | 11px | 600 | `rgba(255,255,255,0.28)` uppercase monospaced label |
| `.title` | 27px | 700 | `rgba(255,255,255,0.96)` |
| `.body` | 15px | 400 | `rgba(255,255,255,0.55)` line-height 1.65 |

### Buttons

- **Primary** (`btn-primary`): 50px height, full width, `border-radius: 14px`, `#5bffd8` background, `#0a0a0a` text, weight 600.
  - Hover: `#80ffe9`.
  - Active: `scale(0.98)`.
  - Disabled: `opacity: 0.38`.
- **Ghost** (`btn-ghost`): transparent, 40px height, `rgba(255,255,255,0.3)` text.

### 5-Step Flow

| Step | Title | Key visual |
|---|---|---|
| 0 | Welcome / Feature overview | Logo icon (58px, teal ring), 34px "NODEX" wordmark, feature row cards |
| 1 | Camera permission | 100px animated camera ring (`rpulse` 2.4s loop), status dot |
| 2 | Neutral pose | 24-frame stability window; spread < 3.5° to lock; live yaw/pitch readout |
| 3 | Eye blink calibration | User blinks slowly 3 times; computes personal EAR threshold |
| 4 | Done | Check icon; "You're all set" card |

**Step 0 — Feature rows:**
Each feature card: `padding: 14px`, `rgba(255,255,255,0.03)` bg, `border-radius: 13px`. Icon in 34×34px square `rgba(255,255,255,0.06)`, text column with `.feature-h` (13px, 600) and `.feature-p` (12px, muted).

**Step 2 — Camera ring:**
- Outer ring: 100px, `border: 1.5px solid rgba(91,255,216,0.28)`, `rpulse` scale 1→1.15.
- Second ring: `inset: -16px`, `border: 1px solid rgba(91,255,216,0.10)`, offset pulse by 0.5s.
- Inner circle: 68px, `rgba(91,255,216,0.07)` bg; becomes `.ready` (bg `rgba(91,255,216,0.14)`, border `#5bffd8`) when camera is live.

**Step 3 — No-face warning banner:**
`rgba(251,191,36,0.07)` bg, `rgba(251,191,36,0.22)` border, `border-radius: 11px`, amber text. Shown when face not detected.

---

## 4. HUD (`content/HUD.js`)

Lightweight overlay injected on every YouTube page when Nodex is active. Shadow DOM, zero external deps.

```
<div id="nodex-hud">
  #shadow-root
    <style>…</style>
    <div class="toast">       ← command / warning notification
    <div class="panel">       ← bottom-right metrics panel
      <div class="mode-badge">
      <div class="metrics">
        <div class="metric"> × 4 (YAW / PITCH / ROLL / EAR)
```

### Toast

Position: `fixed; top: 68px; left: 50%; transform: translateX(-50%)`.

| State | Background | Border |
|---|---|---|
| Default | `rgba(8,8,12,0.72)` | `rgba(255,255,255,0.10)` |
| Warning | `rgba(30,8,8,0.82)` | `rgba(255,80,80,0.25)` |
| Browse hint | `rgba(6,18,14,0.82)` | `rgba(100,255,218,0.20)` |

- Backdrop-filter: `blur(20px) saturate(160%)`.
- Border-radius: 20px.
- Padding: `10px 16px 10px 10px`.
- Gap between icon and text: 10px.
- Enter: `opacity 0, scale(0.94)` → `opacity 1, scale(1)`, 200ms ease.
- Visible for **1400ms**, then 200ms fade-out (`TOAST_VISIBLE_MS = 1400`, `TOAST_FADE_MS = 200`).
- Warnings visible for **5000ms**.

**Toast icon** (`.toast-icon`): 32×32px rounded square `border-radius: 10px`, `rgba(255,255,255,0.08)` bg. Icon SVG: 18×18px white. Warning variant: `#ff6b6b`, `rgba(255,80,80,0.12)` bg. Browse hint: `#64FFDA`, `rgba(100,255,218,0.12)` bg.

**Toast text** (`.toast-text`): flex column, 2px gap.
- `.toast-label`: 14px, weight 500, `rgba(255,255,255,0.92)`.
- `.toast-subtitle`: 11px, `rgba(255,255,255,0.45)`. Only shown for browse-hint variant in `rgba(100,255,218,0.60)`.

**Browse hint text:** "Browse Mode" / "Nod left/right to navigate · Tilt to go back". Shown once (storage flag `nodex_browse_hint_shown`), visible 5s.

### HUD SVG icon set (17 icons)

All inline SVGs, `width/height: 18px` in toast context.

`play`, `pause`, `volUp`, `volDown`, `mute`, `rewind`, `skip`, `next`, `prev`, `back`, `browse`, `player`, `warning`, `check`, `arrowLeft`, `arrowRight`, `arrowUp`, `arrowDown`, `select`.

### Metrics panel

Position: `fixed; bottom: 16px; right: 16px`. Flex column, align right, gap 6px.

**Mode badge** (above metrics):
- Pill shape: `border-radius: 20px`, `padding: 3px 9px 3px 6px`.
- Default: `rgba(8,8,12,0.65)` bg, `rgba(255,255,255,0.5)` text.
- Browse active (`.browse`): `rgba(100,255,218,0.12)` bg, `#64FFDA` text, `rgba(100,255,218,0.3)` border.
- Transition: 0.25s ease.
- Label: "Player" or "Browse"; 10px, weight 600. Icon: 10×10px SVG.

**Metrics row** (`.metrics`):
- 4 columns: YAW | PITCH | ROLL | EAR.
- Container: `gap: 1px`, `rgba(255,255,255,0.06)` bg, `border-radius: 12px`, `border: 1px solid rgba(255,255,255,0.08)`, `backdrop-filter: blur(16px) saturate(140%)`.
- Each `.metric`: `padding: 5px 10px`, `min-width: 42px`, `rgba(8,8,12,0.65)` bg. Flex column, center-aligned.
  - `.metric-label`: 8px, weight 600, letter-spacing 0.08em, `rgba(255,255,255,0.35)`.
  - `.metric-value`: 12px, weight 600, monospace, `#64FFDA`. Updated ~30fps via `updateMetrics()`.
- **EAR column** has an extra `.ear-dot` (6×6px circle): teal (`#64FFDA`) when eyes open, red (`#ff6b6b`) when `EAR < 0.15`.

---

## 5. Focus Ring

The focus ring is a teal highlight drawn around the currently focused thumbnail in Browse Mode. It is part of `content/BrowseController.js`, injected as a `<div>` into the page (not Shadow DOM).

- `position: fixed`.
- `border: 2px solid #5bffd8`.
- `border-radius: 8px`.
- `box-shadow: 0 0 0 4px rgba(91,255,216,0.18)`.
- `pointer-events: none`.
- `transition: all 120ms ease` — smoothly repositions as focus moves between cards.
- Z-index high enough to appear above thumbnail overlays.

---

## 6. Component Inventory

| Component | File | Isolation | Notes |
|---|---|---|---|
| Side panel root | `sidepanel/App.jsx` | Chrome side panel iframe | React 18, inline styles via `S` object |
| MetricBar | `sidepanel/MetricBar.jsx` | Within side panel | EMA-smoothed, two visual modes |
| CalibrationWizard | `sidepanel/CalibrationWizard.jsx` | Within side panel | Standalone sub-flow |
| OnboardingOverlay | `content/OnboardingOverlay.js` | Shadow DOM, full viewport | Zero deps, injected into YouTube page |
| HUD | `content/HUD.js` | Shadow DOM, fixed position | Toast + metrics + mode badge |
| Focus Ring | `content/BrowseController.js` | Direct DOM, `position:fixed` | Not Shadow DOM |

---

## 7. Z-Index Strategy

| Surface | Z-index |
|---|---|
| Focus ring | ~2147483640 |
| HUD | default stacking (body append) |
| OnboardingOverlay `:host` | `2147483647` (max) |

The onboarding overlay always sits on top of everything, including the HUD and focus ring.

---

## 8. Responsiveness & Motion

- `prefers-reduced-motion: reduce` is checked once at parse time in `OnboardingOverlay.js`. When set, all transition durations drop to 120ms and transforms are removed.
- The side panel does not implement reduced-motion handling — its animations are short (≤ 280ms) and non-motion-critical.
- Card max-width `calc(100vw − 32px)` ensures the onboarding card never clips on small viewports.
