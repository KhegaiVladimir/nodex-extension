# Nodex

Control YouTube hands-free with head gestures. Chrome MV3 extension.

## Features
- **Player mode**: seek, volume, play/pause via head tilts, nods, and blinks.
- **Browse mode**: navigate video thumbnails on the home page with a focus ring controlled by head movements.
- **On-device**: face tracking runs entirely in your browser via MediaPipe. No video leaves your device.
- **Calibration**: guided flow adapts to your face and head range.
- **Custom mappings**: remap any gesture to any command.

## How it works
Nodex injects a content script into youtube.com that captures webcam frames,
runs MediaPipe Face Mesh (468 landmarks at 30 FPS), computes head pose
(yaw/pitch/roll), eye aspect ratio, and mouth aperture, and maps recognized
gestures to YouTube commands.

## Tech stack
- Manifest V3 Chrome Extension
- MediaPipe Face Mesh (WASM + SIMD, bundled locally)
- React 18 side panel
- Vite build
- Shadow DOM HUD overlay
- Split MAIN/ISOLATED world content scripts to bypass Trusted Types CSP

## Install
Chrome Web Store: [coming soon]

## Development
```bash
npm install
npm run build           # one-off build → dist/
npm run dev             # watch mode
npm run prod            # clean build + zip → nodex.zip
```

Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Privacy
See [PRIVACY.md](./PRIVACY.md). TL;DR: nothing leaves your device.

## License
MIT
