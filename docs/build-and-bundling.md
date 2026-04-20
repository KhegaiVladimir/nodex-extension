# Build & Bundling

## Commands

```bash
npm run dev      # Vite watch mode — rebuilds on file save
npm run build    # Production build → dist/
npm run prod     # Clean build + creates nodex.zip for upload
```

Load unpacked extension: `chrome://extensions` → Developer mode → Load unpacked → select `dist/`

## Output Structure

```
dist/
├── manifest.json
├── assets/mediapipe/        ← copied as-is (WASM, .task, face_mesh.js)
├── background/
│   └── service-worker.js    ← copied as-is (not bundled)
├── content/
│   ├── index.js             ← bundled IIFE (ISOLATED world)
│   └── mediapipe-bridge.js  ← copied as-is (MAIN world)
└── sidepanel/
    ├── index.html           ← React app entry
    └── *.js / *.css         ← React bundle
```

## Vite Config Summary (`vite.config.js`)

Two build targets:

**1. Side Panel (React):**
- Input: `sidepanel/index.html`
- Standard Vite React build, minified
- Chunks allowed

**2. Content Script (IIFE):**
- Input: `content/index.js`
- Output: single IIFE, no code splitting
- `external: [/^@mediapipe\//]` — MediaPipe never bundled
- Dynamic imports inlined
- Minified

**Custom plugins:**
- `buildContentScript()` — `closeBundle` hook that compiles content/index.js as a separate IIFE using Rollup
- `copyStaticFiles()` — `closeBundle` hook that copies manifest, MediaPipe assets, service-worker, and bridge

## Why MediaPipe Is Not Bundled

MediaPipe's WASM loading depends on its own internal path resolution. If bundled by Vite, the internal paths break. The files are copied verbatim to `dist/assets/mediapipe/` and loaded at runtime via `chrome.runtime.getURL()`.

## Why Service Worker Is Not Bundled

MV3 service workers must be a single script at a static path declared in manifest.json. Vite code splitting would break this. The service worker is copied as-is.

## Why mediapipe-bridge.js Is Not Bundled

The bridge runs in MAIN world. Chrome injects it separately per manifest declaration. Bundling it with the ISOLATED world script would merge the two worlds incorrectly.

## WASM Patching

MediaPipe WASM files may require patching to work with Chrome's extension sandbox. The `buildContentScript()` plugin handles this automatically during build. Never manually edit `.wasm` files.

## Source Maps

Not generated for production (`npm run build`). Dev mode (`npm run dev`) produces inline source maps in the content script for easier debugging.

## Common Build Errors

**`Cannot find module '@mediapipe/...'`** — expected, MediaPipe is external. If this breaks the build, check the `external` config in vite.config.js.

**`RollupError: Invalid value for option "output.inlineDynamicImports"`** — content script bundle cannot use code splitting. Must be single IIFE.

**`wasm file not found`** — check that `assets/mediapipe/` exists in the source and is listed in `copyStaticFiles()` glob.
