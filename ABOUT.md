# Nodex

> Control YouTube hands-free — with head turns, tilts, and face gestures.
> **Zero bytes of video to the network. All AI runs locally in Chrome.**

---

## What it is

Nodex is a Chrome extension (Manifest V3) that lets you control YouTube using only your head and face — no hands, no keyboard, no mouse. A standard webcam is all you need.

Two modes:

- **Player mode** — control the video you're watching (volume, seek, pause, mute)
- **Browse mode** — navigate the YouTube home feed, pick a video with your head, open it

---

## Features

### Player Mode
| Gesture | Action |
|---|---|
| Turn head left | Rewind 10 s |
| Turn head right | Skip 10 s |
| Nod up (hold) | Volume up |
| Nod down (hold) | Volume down |
| Tilt left | Previous video |
| Tilt right | Next video |
| Close eyes ~0.5 s | Play / Pause |
| Open mouth | Mute |

### Browse Mode
Navigate the thumbnail grid with the same head gestures — left, right, up, down to move focus, eyes-close to open. A glowing focus ring tracks which video is selected.

### Smart Features
- **Auto-pause on no face** — if you leave the camera frame for 2+ seconds the video pauses automatically; returns when you come back. Toggle on/off in Settings.
- **Separate gesture maps** — Player and Browse modes have independent gesture-to-command mappings
- **Calibration wizard** — step-by-step setup: neutral pose + personal blink threshold tuned to your eyes and camera
- **Sensitivity presets** — Low / Medium / High for different motion ranges
- **HUD overlay** — live YAW / PITCH / ROLL / EAR metrics in the corner, mode badge, command toasts. Fully isolated in Shadow DOM, doesn't break YouTube layout

### Robustness
- Hysteresis on every gesture axis — no 30 Hz flicker at the threshold edge
- Per-gesture cooldowns — prevents double-firing
- Head-pose conflict gate — suppresses blink detection while you're actively gesturing with your head
- Dynamic EAR auto-calibration — adapts open-eye baseline in ~1 s without manual setup
- Dead-zone decay — prevents phantom blink fires from noisy EAR signal near the threshold boundary
- Watchdog with exponential backoff — auto-recovers the camera stream if it drops

---

## Stack

| Layer | Tech |
|---|---|
| Extension | Chrome Manifest V3, Side Panel API, Scripting API |
| Vision | MediaPipe Face Mesh (local WASM, 468 landmarks, ~30 FPS) |
| Signals | Yaw / Pitch / Roll from face geometry, EAR (Eye Aspect Ratio), Iris openness, Mouth ratio |
| UI | React 18, inline styles (no global CSS) |
| Build | Vite 6 — IIFE for content scripts, ESM bundle for side panel |
| Storage | `chrome.storage.local` only — nothing leaves the machine |

---

## Project Structure

```
nodex-extension/
│
├── manifest.json                  # MV3 manifest — permissions, CSP, content script worlds
│
├── background/
│   └── service-worker.js          # Message relay only (content ↔ side panel)
│                                  # + programmatic script injection into YouTube tabs
│
├── content/                       # Runs on youtube.com
│   ├── mediapipe-bridge.js        # MAIN world — loads MediaPipe WASM, runs camera,
│   │                              # posts NODEX_LANDMARKS / NODEX_NO_FACE via postMessage
│   ├── index.js                   # ISOLATED world — lifecycle orchestrator
│   │                              # NodexPersistent (camera + GestureEngine, survives SPA nav)
│   │                              # NodexPageScoped (HUD + controllers, recreated per route)
│   ├── GestureEngine.js           # Pose detection, hysteresis, blink calibration, gesture emission
│   ├── YouTubeController.js       # Dispatches keydown/keyup events to #movie_player
│   ├── BrowseController.js        # Focus ring + geometric grid navigation on home feed
│   └── HUD.js                     # Shadow DOM overlay — toasts, mode badge, live metrics
│
├── sidepanel/
│   ├── index.html                 # Entry point
│   ├── App.jsx                    # Main React app — engine control, metrics, settings
│   └── CalibrationWizard.jsx      # Guided calibration flow (pose + blink threshold)
│
├── shared/
│   ├── storage.js                 # chrome.storage.local wrapper with write-queue
│   ├── constants/
│   │   ├── commands.js            # PLAY, PAUSE, VOL_UP, REWIND, SKIP, NEXT, PREV, BACK, MUTE…
│   │   ├── gestures.js            # HEAD_LEFT/RIGHT/UP/DOWN, TILT_LEFT/RIGHT, EYES_CLOSED, MOUTH_OPEN
│   │   ├── messages.js            # MSG constants for runtime.sendMessage + postMessage types
│   │   ├── defaults.js            # Default gesture maps, cooldowns, threshold presets
│   │   └── mediapipe.js           # REFINE_LANDMARKS flag (sync with bridge)
│   └── utils/
│       ├── gestureLogic.js        # Pure math: computeYaw, computePitch, computeRoll, computeEAR, computeMouthRatio
│       ├── blinkCalibration.js    # Two-phase blink calibration: open/closed EAR stats → personal thresholds
│       ├── cooldown.js            # Cooldown class — timestamp-based per-gesture rate limiter
│       └── thresholds.js          # Threshold helpers
│
└── assets/
    ├── icons/                     # Extension icons
    └── mediapipe/                 # Bundled MediaPipe WASM + JS assets (no CDN)
        ├── face_mesh.js
        ├── face_mesh.binarypb
        ├── face_mesh_solution_simd_wasm_bin.wasm
        └── camera_utils.js
```

---

## Two-World Architecture

YouTube enforces a strict Trusted Types CSP that blocks dynamic script injection. To load MediaPipe (which patches its own loader) we split into two content script worlds:

```
MAIN world  (mediapipe-bridge.js)
  └─ loads MediaPipe WASM via chrome.scripting.executeScript (bypasses CSP)
  └─ runs Camera + FaceMesh at ~30 FPS
  └─ posts NODEX_LANDMARKS / NODEX_NO_FACE via window.postMessage

ISOLATED world  (content/index.js + GestureEngine + controllers)
  └─ receives landmarks, runs gesture logic, controls YouTube DOM
  └─ relays messages to side panel via chrome.runtime.sendMessage

Side Panel  (React)
  └─ settings, calibration wizard, live metrics display
  └─ sends commands back to content via service worker relay
```

---

## Gesture Detection Pipeline

```
Raw landmarks (468 points)
    │
    ▼
computeYaw / computePitch / computeRoll   ← geometry from face edges + nose tip
computeEAR                                ← 6-point Eye Aspect Ratio (both eyes)
computeMouthRatio                         ← lip distance / mouth width
    │
    ▼
Subtract calibrated neutral pose baseline
    │
    ▼
Head-pose conflict gate                   ← suppress blink if head is moving
    │
    ▼
Dwell counter (3–4 frames)                ← ignore single-frame spikes
    │
    ▼
Hysteresis check                          ← on at T°, off at T−margin°
    │
    ▼
Cooldown gate                             ← per-gesture rate limit
    │
    ▼
gestureMap lookup → command → YouTubeController / BrowseController
```

---

## Privacy

- MediaPipe models and WASM runtime are **bundled with the extension** — no CDN, no network calls
- Camera frames are processed entirely in-browser and **discarded after inference**
- No frame, landmark, or user data is ever sent anywhere
- All settings and calibration live in `chrome.storage.local` on your machine only

---

## Build

```bash
npm install

npm run dev      # Vite watch mode → dist/
npm run build    # Production build → dist/
npm run prod     # Clean build + nodex.zip (ready to submit)
```

Load unpacked at `chrome://extensions` → point to `dist/`.
