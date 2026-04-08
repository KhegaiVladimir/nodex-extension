# Chrome Web Store Submission Data — Nodex v1.0.0

## Basic info

**Name:** Nodex

**Summary (132 chars max):**
Control YouTube hands-free with head gestures. Face tracking runs entirely on your device — no video leaves the browser.

**Category:** Accessibility

**Language:** English

## Description (full, 16000 chars max)

Nodex lets you control YouTube with your head. Turn, tilt, nod, blink — and
the video responds. No hands, no voice, no physical contact with your
computer.

### What you can do

**While watching a video:**
- Turn your head left or right to rewind or skip forward
- Tilt up or down to change volume
- Blink to pause and resume
- Tilt sideways to mute

**While browsing the YouTube home page:**
- Move a focus ring across thumbnails with head movements
- Open the selected video with a blink
- Navigate Shorts shelves horizontally

### How it works

Nodex uses MediaPipe Face Mesh — Google's open-source face tracking
library — to detect 468 points on your face 30 times per second. From
these points it computes head orientation (yaw, pitch, roll), eye aspect
ratio (for blink detection), and mouth aperture. When a recognized gesture
crosses its threshold, Nodex triggers the mapped YouTube command.

Everything runs locally in your browser. The WebAssembly face tracking
module is bundled inside the extension — no code is downloaded at runtime,
no video is uploaded anywhere.

### Features

- **Two modes**: Player mode controls the video element directly; Browse
  mode navigates thumbnail grids with a custom focus ring.
- **Automatic mode switching** based on page type.
- **Guided calibration**: a 60-second flow personalizes gesture thresholds
  to your face and head range.
- **Custom mappings**: remap any gesture to any command, separately for
  Player and Browse modes.
- **Live metrics panel**: see yaw, pitch, eye aspect ratio in real time.
- **HUD overlay**: compact indicator on the YouTube page shows current
  mode and last command.

### Use cases

- Accessibility: people with limited hand mobility can watch YouTube
  independently.
- Hands-busy contexts: cooking, exercising, eating.
- Power users who want an extra input channel.

### Privacy

Nodex does not collect, transmit, or share any data. The camera stream is
processed frame-by-frame and discarded. Calibration and settings are
stored locally via `chrome.storage.local` and never leave your device.

Full policy: https://github.com/KhegaiVladimir/nodex/blob/main/PRIVACY.md

## Single purpose statement

Control YouTube playback and browse videos using head gestures detected on-device via the webcam.

## Permission justifications

- **storage**: Save user calibration profile and gesture-to-command mappings locally.
- **sidePanel**: Display the Nodex control panel with live metrics and settings.
- **scripting**: Inject the MediaPipe face tracking bridge into YouTube tabs.
- **tabs**: Find YouTube tabs so the side panel can send commands to the active one.
- **webNavigation**: Detect YouTube SPA navigation events to keep the gesture controller synchronized with URL changes.
- **host_permissions (https://www.youtube.com/*)**: Access YouTube pages to read the video element and thumbnail DOM, and to control playback.

## Data usage disclosure

- Personally identifiable information: **No**
- Health information: **No**
- Financial/payment: **No**
- Authentication: **No**
- Personal communications: **No**
- Location: **No**
- Web history: **No**
- User activity: **No** (gesture events are not logged)
- Website content: **No** (reads only DOM structure, does not collect content)

Certifications:
- [x] I do not sell or transfer user data to third parties, outside of approved use cases
- [x] I do not use or transfer user data for purposes unrelated to my item's single purpose
- [x] I do not use or transfer user data to determine creditworthiness or for lending purposes

## Remote code

**No** — the extension does not execute remote code. MediaPipe WASM and
all JavaScript is bundled in the package.

## Privacy policy URL

https://github.com/KhegaiVladimir/nodex/blob/main/PRIVACY.md

## Contact email

khegai.dev@gmail.com

## Distribution

- Visibility: **Unlisted** (for first release — switch to Public later)
- Regions: **All regions**
- Pricing: **Free**
