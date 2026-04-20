# chrome.scripting API Reference (Nodex Context)

## How Nodex Uses It

The service worker uses `chrome.scripting.executeScript` to inject content scripts into YouTube tabs, both on install and on tab navigation.

## executeScript with world parameter

```js
await chrome.scripting.executeScript({
  target: { tabId },
  files: ['content/mediapipe-bridge.js'],
  world: 'MAIN',          // ← runs in page JS context, bypasses Trusted Types CSP
})

await chrome.scripting.executeScript({
  target: { tabId },
  files: ['content/index.js'],
  world: 'ISOLATED',      // ← default, sandboxed content script context
})
```

**Critical:** `world: 'MAIN'` is required for `mediapipe-bridge.js`. Without it, MediaPipe WASM will fail due to Trusted Types.

## Idempotent Injection

Before injecting, the SW checks if scripts are already running to avoid double-injection:

```js
// Check by running a probe script that returns a flag
const [result] = await chrome.scripting.executeScript({
  target: { tabId },
  func: () => window.__nodexInjected,
  world: 'MAIN',
})
if (result?.result) return  // already injected
```

## Required Permission

```json
"permissions": ["scripting"]
"host_permissions": ["https://www.youtube.com/*"]
```

`scripting` permission alone is not enough — host permission for the target URL is also required.

## Dynamic Script Injection (MediaPipe sub-scripts)

When the MAIN world bridge needs to load a MediaPipe sub-script dynamically, it sends a message to the SW which calls:

```js
chrome.scripting.executeScript({
  target: { tabId, frameIds: [frameId] },
  files: [path],   // must start with 'assets/mediapipe/'
  world: 'MAIN',
})
```

**Security whitelist in SW:** only paths starting with `assets/mediapipe/` are allowed. Anything else is rejected to prevent script injection attacks.

## Error Handling

Common errors from `executeScript`:
- `"Cannot access contents of url"` — host_permissions doesn't cover the tab URL
- `"No tab with id"` — tab was closed before injection completed
- `"Extension context invalidated"` — extension was reloaded mid-operation

All should be caught and logged, never thrown unhandled.
