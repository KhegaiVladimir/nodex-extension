# Nodex

Control YouTube hands-free with head gestures. Chrome MV3 extension.

> *Experience Vision Pro–like navigation on your \$500 laptop with a \$10 webcam.*

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

## Math (landmarks → signals)

Implementation lives in [`shared/utils/gestureLogic.js`](shared/utils/gestureLogic.js). Below is the same geometry in compact form ([mathematical expressions in Markdown](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/writing-mathematical-expressions) on GitHub).

**3-D distance** between MediaPipe landmarks $\mathbf{p}$ and $\mathbf{q}$:

$$
d(\mathbf{p}, \mathbf{q}) = \sqrt{(p_x - q_x)^2 + (p_y - q_y)^2 + (p_z - q_z)^2}.
$$

**6-point Eye Aspect Ratio (per eye)** — two vertical spans (primary + secondary eyelid pairs) over horizontal eye width (inner–outer corners); one scalar averages both eyes:

$$
\mathrm{EAR}_{\mathrm{eye}} = \frac{\frac{1}{2}\bigl(d^{(1)}_{\mathrm{vert}} + d^{(2)}_{\mathrm{vert}}\bigr)}{d_{\mathrm{inner},\mathrm{outer}}}, \qquad
\mathrm{EAR} = \tfrac{1}{2}\bigl(\mathrm{EAR}_{\mathrm{right}} + \mathrm{EAR}_{\mathrm{left}}\bigr).
$$

Lower **EAR** ⇒ eyes more closed (used with calibrated enter/exit thresholds and frame streaks so ordinary blinks ≠ commands).

**Head pose (degrees, approximate):** with cheek edge landmarks $L,R$, nose $N$, forehead $F$, chin $C$, and midpoints $x_{\mathrm{mid}}=\frac{x_L+x_R}{2}$, $y_{\mathrm{mid}}=\frac{y_F+y_C}{2}$,

$$
\psi = -\frac{x_N - x_{\mathrm{mid}}}{|x_R - x_L|/2}\cdot 45^{\circ} \quad (\text{yaw}), \qquad
\phi = \frac{y_{\mathrm{mid}} - y_N}{|y_C - y_F|/2}\cdot 40^{\circ} \quad (\text{pitch}),
$$

$$
\rho = -\operatorname{atan2}(y_R - y_L,\, x_R - x_L)\cdot\frac{180^{\circ}}{\pi} \quad (\text{roll}).
$$

**Mouth opening ratio** (upper/lower lip vs mouth width):

$$
m = \frac{d(\mathrm{upper},\mathrm{lower})}{d(\mathrm{mouth\ L},\mathrm{mouth\ R})}.
$$

**Hysteresis (concept):** a head gesture turns **on** when $|\theta| > T$ and turns **off** only when $|\theta| < T - h$ (threshold $T$, gap $h$ per axis in code) so the boundary does not chatter at 30 Hz.

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
npm run zip:source      # sources → nodex-extension-source.zip (excludes node_modules, dist, .git)
```

Project map and file roles (AI / onboarding): [AGENTS.md](./AGENTS.md).

Load unpacked: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`.

## Privacy
See [PRIVACY.md](./PRIVACY.md). TL;DR: nothing leaves your device.

## License
MIT
