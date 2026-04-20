# MV3 Service Worker Lifecycle

## Key Difference from MV2

MV2 background pages ran persistently. MV3 service workers are **event-driven** — Chrome starts them on demand and suspends them when idle. They can be restarted at any time between events.

## Implications for Nodex

### Never store state in module-level variables

```js
// WRONG — resets to undefined every time SW wakes up
let currentTabId = null

// RIGHT — always read from chrome.storage.local
```

### Always handle chrome.runtime.lastError

```js
chrome.runtime.sendMessage(tabId, msg, response => {
  if (chrome.runtime.lastError) {
    // Tab may have closed, page navigated, etc.
    // Do NOT throw — just log and return
    console.error('[Nodex SW]', chrome.runtime.lastError.message)
    return
  }
  // process response
})
```

### Wrap sendMessage in try-catch

```js
try {
  chrome.runtime.sendMessage({ type: 'UPDATE', data })
} catch (e) {
  // Extension context invalidated or receiver not listening
}
```

### Keep event handlers fast

The SW must respond to events quickly or Chrome considers it unresponsive. Don't do heavy computation in the SW. Nodex SW only relays messages — no computation.

## SW Restart Scenarios

Chrome can restart the service worker:
1. After ~30 seconds of inactivity
2. When Chrome restarts
3. When the extension is updated
4. When the user wakes their computer from sleep

After restart, the SW re-runs the module initialization but has no memory of previous state.

## chrome.runtime.onInstalled

Fires when:
- Extension first installed
- Extension updated to a new version
- Chrome updated (if `reason === 'chrome_update'`)

Nodex uses this to inject content scripts into already-open YouTube tabs. This is idempotent — the injection check prevents double-loading.

## Debugging a Sleeping Service Worker

The SW DevTools connection closes when the SW goes to sleep. To keep it alive for debugging:
1. Open SW DevTools from `chrome://extensions`
2. The DevTools connection itself prevents the SW from sleeping
3. Remember to close DevTools when done testing — it changes SW behavior

## When to Use chrome.alarms Instead

If you need periodic SW logic that survives sleep cycles, use `chrome.alarms` (not `setInterval`). `setInterval` is cancelled when the SW sleeps. Nodex currently has no periodic SW logic — watchdog runs in the content script.
