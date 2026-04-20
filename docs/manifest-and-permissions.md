# Manifest & Permissions

## manifest.json Quick Reference

```json
{
  "manifest_version": 3,
  "name": "Nodex",
  "version": "1.1.0"
}
```

## Permissions

| Permission | Why |
|---|---|
| `storage` | `chrome.storage.local` — settings, calibration, gesture maps |
| `sidePanel` | Side panel UI (settings, calibration wizard) |
| `scripting` | `chrome.scripting.executeScript` — inject MediaPipe into YouTube tabs |
| `tabs` | Read tab URL to detect YouTube navigation and inject scripts |

**Host permissions:** `https://www.youtube.com/*` only.

## Web Accessible Resources

```json
"web_accessible_resources": [{
  "resources": ["assets/mediapipe/*"],
  "matches": ["https://www.youtube.com/*"]
}]
```

All MediaPipe `.wasm` and `.task` files live under `assets/mediapipe/`. They must be referenced via `chrome.runtime.getURL('assets/mediapipe/...')` — never hardcoded paths.

## Content Security Policy

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

`wasm-unsafe-eval` is required for MediaPipe WASM compilation. This applies to extension pages only — not to the YouTube page.

## Content Scripts Injection Order

Two scripts are injected into YouTube tabs:

1. `content/mediapipe-bridge.js` — **MAIN world**, `document_idle`
2. `content/index.js` — **ISOLATED world**, `document_idle`

MAIN world runs first (lower index in manifest). ISOLATED world starts after and immediately begins listening for `window.postMessage` from the bridge.

The service worker also injects both scripts programmatically on `chrome.tabs.onUpdated` for tabs already open when the extension installs.

## Adding a New Permission

1. Add to `manifest.json` `permissions` array
2. Check if it requires a new `host_permissions` entry
3. Rebuild (`npm run build`)
4. Test unpacked at `chrome://extensions`
5. If publishing: update store listing (some permissions trigger review)
