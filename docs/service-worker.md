# Service Worker

## Role

Pure message relay. Holds no persistent state. Every message it receives is forwarded to another target (content script or side panel). It also handles script injection on tab load.

## Message Relay

```
Side Panel ──sendMessage──► Service Worker ──sendMessage──► Content (tab)
Content    ──sendMessage──► Service Worker ──sendMessage──► Side Panel (tab)
```

**Message type constants:**
- `CONTENT_TO_SIDEPANEL` — content → SW → panel
- `SIDEPANEL_TO_CONTENT` — panel → SW → content
- `REQUEST_STATUS` — panel asks SW to poll the content script for current engine status

## Script Injection

On `chrome.runtime.onInstalled`: injects both content scripts into all currently open YouTube tabs (idempotent check prevents double injection).

On `chrome.tabs.onUpdated` (status === 'complete', URL matches `youtube.com`): injects if not already present.

**Injection order:**
1. `content/mediapipe-bridge.js` (MAIN world)
2. `content/index.js` (ISOLATED world)

Injection is idempotent — the SW checks if each script is already running before calling `executeScript`.

## INJECT_MEDIAPIPE / INJECT_SCRIPT

When the MAIN world needs to load a MediaPipe sub-script, it sends a message to the service worker which uses `chrome.scripting.executeScript` to inject it.

**Security:** path whitelist — only paths starting with `assets/mediapipe/` are allowed. Anything else is rejected without injection.

## MV3 Lifecycle

Service workers can be suspended by Chrome between events. Rules:

- **Never store state in module-level variables.** They reset on wake.
- **Always handle `chrome.runtime.lastError`** after every async Chrome API call.
- **Wrap sendMessage in try-catch** — the side panel may not be open, the tab may be gone.

If the SW is suspended while a long operation is pending, it will be restarted fresh on next message. Nodex handles this gracefully — content scripts are self-sufficient; the SW is only needed for UI sync.

## Uninstall URL

```
https://khegaivladimir.github.io/nodex/uninstall
```

Set via `chrome.runtime.setUninstallURL` on install.

## Debugging the Service Worker

1. `chrome://extensions` → Nodex → "Service Worker" link → DevTools opens
2. Service workers have separate DevTools from the page
3. `console.log` in SW shows in SW DevTools, not in the page console
