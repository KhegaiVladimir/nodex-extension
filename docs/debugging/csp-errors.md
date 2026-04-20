# Debug: CSP / Trusted Types Errors

## Symptoms

- Console: `This document requires 'TrustedScript' assignment`
- Console: `Refused to evaluate a string as JavaScript because 'unsafe-eval' is not an allowed source`
- MediaPipe fails to initialize silently (no landmarks arrive)
- Console: `[Nodex] bridge error: ...` with WASM-related message

## Understanding the Error

YouTube enforces **Trusted Types** CSP. This policy blocks:
- `innerHTML = ...` with untrusted strings
- `eval()`, `new Function()`, dynamic script creation
- WASM compilation via `eval`-equivalent paths

MediaPipe WASM loading uses patterns that violate Trusted Types when run in YouTube's JavaScript context (ISOLATED world).

## The Fix That Already Exists

MediaPipe runs in **MAIN world** (`content/mediapipe-bridge.js`). Extension MAIN world scripts operate under the extension's own CSP:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

The extension's CSP allows WASM compilation. YouTube's page CSP does not apply to MAIN world extension scripts.

## If You See a New CSP Error

### Check which world the error is in

DevTools → Console → click the error source. Is it in `mediapipe-bridge.js` (MAIN world) or `content/index.js` (ISOLATED world)?

- **Error in ISOLATED world:** something in the ISOLATED world is trying to do what only MAIN world can do. Check if any MediaPipe code accidentally moved there.
- **Error in MAIN world:** unexpected — the extension CSP should allow this. Check if you accidentally changed `manifest.json` CSP.

### Did `manifest.json` CSP change?

Verify:
```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

`wasm-unsafe-eval` must be present.

### Did MediaPipe asset paths change?

Check that WASM files are still in `assets/mediapipe/` and referenced via `chrome.runtime.getURL()`. If a path is wrong, the WASM file won't load and may generate a confusing error.

### Did someone add eval() or innerHTML in ISOLATED world?

Search the codebase:
```bash
grep -r "innerHTML\|eval(" content/ --include="*.js"
```

Any `innerHTML` assignment in ISOLATED world scripts will throw Trusted Types violation on YouTube. Use `textContent` or create elements via `document.createElement`.

## Shadow DOM Injected UI (Overlays)

Nodex UI overlays (`OnboardingOverlay`, `HUD`, focus ring) use Shadow DOM and `createElement` — no `innerHTML` with untrusted strings. If you add new injected UI, follow this same pattern.

```js
// WRONG — throws Trusted Types violation
el.innerHTML = '<div class="card">...</div>'

// RIGHT — safe in ISOLATED world
const div = document.createElement('div')
div.className = 'card'
const text = document.createTextNode('...')
div.appendChild(text)
el.appendChild(div)
```

Exception: template literals with known-safe content inside Shadow DOM `adoptedStyleSheets` or `innerHTML` of shadow-root attached to extension-owned elements are generally safe since they don't touch the YouTube DOM. Verify case-by-case.
