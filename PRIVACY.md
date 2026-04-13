# Nodex Privacy Policy

**Last updated:** April 8, 2026

Nodex is a Chrome extension that controls YouTube playback and browsing
through head gestures detected via your webcam. This document describes
exactly what data Nodex accesses, processes, and stores.

## Summary

**Nodex does not collect, transmit, or share any personal data.** All
processing happens on your device. No video, image, face data, or usage
analytics leaves your browser.

## What Nodex accesses

### Camera
Nodex requests access to your webcam to detect head gestures via MediaPipe
Face Mesh. Video frames are processed locally in your browser and are
**never saved, uploaded, or transmitted**. The camera stream is discarded
frame-by-frame as gestures are computed.

### YouTube page content
Nodex reads DOM elements on youtube.com pages:
- The `<video>` element — to control playback (play, pause, seek, volume).
- Thumbnail anchors — to display the navigation focus ring and open videos.

Nodex does not read page content outside these elements. It does not
access your watch history, comments, or account information.

## What Nodex stores

Nodex uses `chrome.storage.local` to save (on your device only):
- **Calibration profile**: head pose baseline, personalized gesture
  thresholds from the calibration flow.
- **Gesture-to-command mappings**: which head gestures trigger which
  YouTube actions.
- **UI preferences**: HUD visibility, last used mode.

This data stays on your device. It is removed when you uninstall the
extension or clear Chrome's extension storage.

## What Nodex does NOT do

- Does not collect analytics, telemetry, or crash reports.
- Does not use cookies or tracking pixels.
- Does not have a backend server — there is nothing to send data to.
- Does not share data with advertisers, data brokers, or third parties.
- Does not use remote code — all JavaScript and WASM is bundled in the
  extension package.

## Permissions explained

| Permission | Why |
|------------|-----|
| `storage` | Save calibration and settings locally. |
| `sidePanel` | Show the Nodex control panel. |
| `scripting` | Inject MediaPipe face tracking into YouTube tabs. |
| `tabs` | Find YouTube tabs to control from the side panel. |
| `host_permissions: youtube.com` | Access only YouTube pages to control playback and browsing. |

## Contact

Questions, bug reports, or privacy concerns:
- Email: khegai.dev@gmail.com
- GitHub: https://github.com/KhegaiVladimir/nodex

## Changes

If this policy changes, the extension version will be incremented and the
"Last updated" date above will reflect the change.
