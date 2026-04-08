# Nodex Privacy Policy

Nodex processes camera input entirely on your device. No video, image, or
facial data is transmitted, stored, or shared with any server, including
Anthropic, Google, or third parties.

## What we access

- **Camera**: Required for face gesture detection. Video frames are processed
  locally by MediaPipe Face Mesh running in your browser. Frames are never
  saved or transmitted.
- **YouTube page content**: Required to control playback and navigate
  thumbnails. We read DOM elements (video element, thumbnail anchors) and
  trigger navigation events. We do not collect, log, or transmit page content.

## What we store

- **chrome.storage.local**: Calibration profile (head pose baseline, gesture
  thresholds), custom gesture-to-command mappings, UI preferences. Stored
  locally on your device only. Removed when you uninstall the extension.

## What we do NOT do

- We do not collect analytics.
- We do not have a backend server.
- We do not use cookies or trackers.
- We do not share data with third parties.

## Permissions

- `storage`: To save your calibration and settings locally.
- `sidePanel`: To show the Nodex control panel.
- `host_permissions: youtube.com`: To inject the gesture controller into
  YouTube tabs.

## Contact

For questions, open an issue at [https://github.com/KhegaiVladimir/nodex-extension](https://github.com/KhegaiVladimir/nodex-extension).
