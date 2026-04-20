# Trusted Types — What YouTube Requires

## What Is Trusted Types?

A browser security policy that prevents DOM XSS by requiring "trusted" wrappers around values assigned to dangerous sinks like `innerHTML`, `eval()`, and `src` of scripts. YouTube enforces it via CSP header.

## YouTube's Actual CSP (approximate)

YouTube sets a CSP that includes:
```
require-trusted-types-for 'script'
trusted-types ...
```

This means:
- `element.innerHTML = untrustedString` → throws
- `eval(string)` → throws
- `new Function(string)` → throws
- WASM compilation that uses eval-equivalent paths → throws

## Why This Affects MediaPipe

MediaPipe's JavaScript wrapper compiles WASM modules in ways that the Trusted Types policy blocks. Specifically, MediaPipe uses dynamic code patterns that YouTube's policy won't allow.

## The Extension Escape Hatch

Extension content scripts running in **MAIN world** use the **extension's own CSP**, not the page's. The extension CSP is declared in `manifest.json`:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'"
}
```

`wasm-unsafe-eval` explicitly allows WASM compilation. YouTube's Trusted Types restriction does not apply to extension MAIN world scripts.

**ISOLATED world** content scripts still inherit aspects of the page's environment. While the exact policy enforcement differs by Chrome version, it's safer to treat ISOLATED world as subject to Trusted Types and avoid any eval-equivalent operations there.

## Safe DOM Operations in ISOLATED World

```js
// SAFE
const div = document.createElement('div')
div.textContent = userValue        // textContent is safe
div.setAttribute('class', cls)     // attributes are safe
parent.appendChild(div)

// UNSAFE — may throw on YouTube
div.innerHTML = '<span>' + userValue + '</span>'
```

**Exception:** `innerHTML` inside a Shadow Root you own (not attached to YouTube's DOM) is generally safe. OnboardingOverlay and HUD use template literal HTML in their shadow roots — this is fine because it's not touching YouTube's Trusted Types-enforced document.

## Testing CSP Violations

1. DevTools → Console — Trusted Types violations appear as red errors
2. DevTools → Network → Response headers for youtube.com — look for `Content-Security-Policy` header
3. If you add a new DOM operation that might violate TT, test it on youtube.com (not localhost)
