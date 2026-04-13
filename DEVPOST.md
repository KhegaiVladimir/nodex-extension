# Nodex — project write-up (Devpost-style)

**Tagline:** Control YouTube hands-free — with head turns, tilts, and face gestures.

> **Vision Pro energy, real-world budget:** *Experience Vision Pro–like navigation on your \$500 laptop with a \$10 webcam.*

---

## Edge AI: zero video to the network

**Key message for judges and users:** **not a single byte of video** from your camera goes to the cloud. The webcam stream is processed **entirely on-device** inside the extension: frames go into a local MediaPipe (WASM) runtime and are discarded as gestures are inferred — **no recording, streaming, or uploading face imagery**.

- Face Mesh models and runtime are **bundled with the extension** (no CDN).
- Settings and calibration live in **`chrome.storage.local`** on your machine only.
- Classic **edge inference**: intelligence at the edge; data never leaves the browser.

*One-liner:* **«0 bytes of video to the network — all AI runs locally in Chrome.»**

---

## What it is

**Nodex** is a Google Chrome extension (Manifest V3) that adds **head and face gesture** control on [youtube.com](https://www.youtube.com). Player mode is the baseline; **what sets it apart from typical hands-free players** is in the next section.

---

## Killer feature: Browse — pick videos with your head on the thumbnail grid

Player control (pause, volume, seek) is table stakes. **What differentiates Nodex** is **Browse** mode: you **never touch** mouse or keyboard to **move across the YouTube home surface**, sliding a **focus ring** over the thumbnail grid with **head turns and tilts**, then open the clip you want with a **confirm gesture** (separate mapping for browse vs play).

- Row/column navigation over previews — **like a remote**, but the camera sees your face.
- **Separate gesture maps** for Browse and Player — the same motion can mean different things depending on page context.

*Devpost demo tip:* show **10–15 s of player**, then **home with the focus ring on thumbnails** — that’s the strongest hook.

---

## Player mode — baseline

- **Head left / right** — seek backward / forward.
- **Nod up / down** — volume (repeat while held, with cooldown).
- **Head roll left / right** — previous / next video in playlist.
- **Eyes closed for a meaningful duration** — play/pause (see algorithms section).
- **Mouth open** — mute by default.

Commands go through **HTMLVideoElement**, picking the correct `<video>` among ads and multiple SPA elements.

---

## Calibration and UI

- Step-by-step **calibration** in the side panel: neutral pose and **personal thresholds** (including blink).
- **Sensitivity** presets and user-defined **gesture → command** mapping.
- **HUD** in Shadow DOM over the page — without breaking YouTube layout.

---

## Fighting false positives (algorithm depth)

Judges and engineers care about more than “it uses a camera” — **robustness to noise** matters. Nodex layers several filters:

### Blink vs “eyes closed” command
Per frame we compute an **eye openness** signal (**EAR** — eye aspect ratio — or an **iris** metric when available). Firing is tied to the **closed → open transition**: **closed duration must fall in a valid frame range** — too short (a typical blink) **does not** count as a command; too long may map differently (scenario-specific thresholds). **Personal enter/exit thresholds** and **blink calibration** from the wizard adapt to your face and camera.

### Head vs eyes
When the **head turns or tilts strongly**, face geometry in the frame shifts and “eyes closed” can look like a real squint. The engine **tracks recent head pose** and **suppresses** eye-close while the head is outside a **neutral band** relative to calibration — fewer false pauses when turning.

### Hysteresis and cooldowns
- **Angular hysteresis** (yaw / pitch / roll): a gesture **turns on** past threshold and **only releases** after returning below threshold minus margin — no 30 Hz flicker at the edge.
- **Cooldowns** between repeated commands from the same gesture (per-gesture intervals).
- For volume, **holding** head up/down **re-emits** on an interval; other gestures mostly fire on **activation edges**.

**Pitch line:** *“We’re not just an EAR threshold — calibration, a closed-duration window, a head-pose conflict gate, and hysteresis on every axis.”*

---

## Privacy and architecture (short)

- **MediaPipe Face Mesh** (~468 points), **WASM + local assets**, no CDN.
- Service worker **only** relays messages; logic lives in the content script and side panel.

---

## Stack

| Layer | Tech |
|------|------|
| Extension | Chrome MV3, side panel, content scripts |
| Vision | MediaPipe Face Mesh (local), yaw / pitch / roll, EAR / iris, mouth ratio |
| UI | React 18, Vite |
| YouTube CSP | MAIN world bridge for MediaPipe + ISOLATED world for orchestration |
| Build | Vite (IIFE for content, bundle for side panel) |

---

## Who it’s for

- **Hands-free** use cases, dirty or busy hands.
- **Accessibility** and alternative input.
- Anyone who cares about **privacy**: **edge AI, zero video to the network**.

---

## Limitations

- Requires a **camera** and permission to use it.
- Targets **youtube.com**.
- Quality depends on lighting, camera, and calibration.

---

## License and docs

- **License:** MIT.
- Privacy: [PRIVACY.md](./PRIVACY.md).
- Repo map for developers: [AGENTS.md](./AGENTS.md).

---

## Screenshot / video ideas for Devpost

### “Dirty hands” (≈5 s — strong relatability)

Film a short **unglamorous** clip: you’re **eating chicken wings** or **working with flour** in the kitchen — hands busy or sticky — and you **switch tracks, pause, or browse the home feed** with **head gestures only**. Viewers and judges instantly get it: *“Oh, I need that too.”* Best placed **after** the title card or **between** player and Browse demos.

### Shots and order

1. **YouTube home with focus ring on thumbnails** (Browse) — first or second shot after the title.
2. Diagram: **camera → local WASM only → gestures** (cross out “cloud” or label **0 B video uploaded**).
3. Side panel: calibration and mapping.
4. Player with HUD (volume / seek) — proof of baseline mode.
5. **Bonus:** insert the **dirty hands** clip (~5 s), keep the edit light.

---

*You can paste sections of this file into Devpost fields: Inspiration, What it does, How we built it, Accomplishments.*
