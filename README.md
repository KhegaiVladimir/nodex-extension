# Nodex

Nodex is a Chrome extension for hands-free YouTube control using head and face
gestures processed fully on-device.

## Features

- Player mode controls playback (play/pause, seek, volume, mute, next/previous).
- Browse mode navigates YouTube thumbnails with a visible focus ring.
- Side panel for onboarding, calibration, gesture mapping, and sensitivity.
- HUD overlay with mode indicator, commands, and live metrics.
- Local MediaPipe Face Mesh assets (no remote code execution).

## Privacy

Nodex processes camera frames locally in the browser and does not transmit video
or facial data to any server. See `PRIVACY.md` for details.

## Development

```bash
npm install
npm run build
```

## Release

```bash
npm run prod
```

This produces `nodex.zip` ready for Chrome Web Store upload.
