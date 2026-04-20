# Architecture Overview

## Three Isolated Contexts

Nodex runs across three JavaScript contexts that cannot share memory directly.

```
┌─────────────────────────────────────────────────────────────────┐
│  YouTube Tab                                                    │
│                                                                 │
│  ┌──────────────────────┐     window.postMessage               │
│  │  MAIN world          │ ──────────────────────────►          │
│  │  mediapipe-bridge.js │                             │        │
│  │  FaceEngine.js       │ ◄──────────────────────────         │
│  │  (MediaPipe WASM)    │                             │        │
│  └──────────────────────┘                             │        │
│                                                       ▼        │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  ISOLATED world (content/index.js)                       │  │
│  │                                                          │  │
│  │  NodexPersistent  ── one per tab, camera lifetime        │  │
│  │   └ GestureEngine ── yaw/pitch/roll/EAR → gestures       │  │
│  │                                                          │  │
│  │  NodexPageScoped  ── recreated on yt-navigate-finish     │  │
│  │   └ YouTubeController  (player keyboard shortcuts)       │  │
│  │   └ BrowseController   (feed grid navigation)            │  │
│  │   └ HUD                (toast + metrics overlay)         │  │
│  │                                                          │  │
│  │  OnboardingOverlay  ── mounted once, survives SPA nav    │  │
│  └──────────────────────────────────────────────────────────┘  │
│                      │  chrome.runtime.sendMessage             │
└──────────────────────┼──────────────────────────────────────────┘
                       │
         ┌─────────────▼──────────────┐
         │  Service Worker            │
         │  background/sw.js          │
         │  (relay only, no state)    │
         └─────────────┬──────────────┘
                       │  chrome.runtime.sendMessage
         ┌─────────────▼──────────────┐
         │  Side Panel (React)        │
         │  sidepanel/App.jsx         │
         │  Settings, calibration     │
         └────────────────────────────┘
```

## Why Two Content Worlds?

YouTube enforces Trusted Types CSP which blocks `eval()` and dynamic script creation. MediaPipe loads its WASM module using techniques that violate this policy. Running MediaPipe in the **MAIN world** bypasses the page's CSP (extension MAIN world scripts have their own policy: `wasm-unsafe-eval`). The ISOLATED world content script handles all DOM interaction and gesture logic — it never touches MediaPipe directly.

## NodexPersistent vs NodexPageScoped

| | NodexPersistent | NodexPageScoped |
|---|---|---|
| Created | Once per tab, on first load | On every `yt-navigate-finish` |
| Destroyed | Tab close or camera failure | Next SPA navigation |
| Contains | Camera, GestureEngine, watchdog | HUD, YouTubeController, BrowseController |
| Camera | Starts here | Never touches camera |

OnboardingOverlay is attached to `document.documentElement` in Shadow DOM — `position: fixed` — so it survives SPA navigation without being recreated.

## Data Flow (per frame, ~30fps)

```
Camera frame
  → MediaPipe Face Mesh (MAIN world)
    → 468 landmarks via window.postMessage('NODEX_LANDMARKS')
      → GestureEngine.processLandmarks()
        → computeYaw/Pitch/Roll/EAR (gestureLogic.js)
          → hysteresis state machine
            → gesture event (e.g. HEAD_LEFT)
              → NodexPageScoped.handleCommand()
                → YouTubeController or BrowseController
                  → keyboard event → YouTube
```

## Shared Constants (no Chrome API deps)

`shared/` is imported by both content worlds and the side panel. It has zero Chrome API calls — pure functions and plain objects only.

- `shared/constants/defaults.js` — default thresholds, gesture maps, sensitivity presets
- `shared/constants/gestures.js` — gesture name enum
- `shared/constants/mediapipe.js` — feature flag `REFINE_LANDMARKS`
- `shared/utils/gestureLogic.js` — landmark math (yaw, pitch, roll, EAR, mouth ratio)
- `shared/utils/blinkCalibration.js` — `computeBlinkThreshold()` for calibration wizard
- `shared/storage.js` — `chrome.storage.local` wrappers (serialized writes)

## SPA Navigation Handling

YouTube is a Polymer SPA. `DOMContentLoaded` fires once; subsequent page changes emit `yt-navigate-finish`. Nodex listens for this event and calls `NodexPageScoped.destroy()` then recreates it for the new page context. The camera never stops between navigations.

## Mode Switching

`NodexPageScoped` checks the current URL on creation:

- `/watch`, `/shorts/`, `/live/`, `/clip/`, `/embed/` → **Player Mode**
- Everything else → **Browse Mode**

Mode switches happen automatically on each `yt-navigate-finish`.
