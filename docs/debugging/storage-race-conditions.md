# Debug: Storage Race Conditions

## Symptoms

- Settings saved in side panel revert to defaults after page reload
- Gesture map changes don't persist
- `onboarding_complete` keeps resetting
- Two settings changes cancel each other out

## How Storage Works in Nodex

All persistence is `chrome.storage.local`. Wrappers are in `shared/storage.js`.

**Serialized writes:** `saveSettings(patch)` uses an internal write queue. Concurrent saves are serialized — the second write waits for the first to complete before running. This prevents the classic "read-modify-write" race.

**Direct writes** (not serialized): `chrome.storage.local.set({ earCalibration: ... })`, `chrome.storage.local.set({ onboarding_complete: true })`. If two contexts write the same key simultaneously, last write wins.

## Diagnosing

### Check what's in storage

DevTools (YouTube tab) → Application → Storage → `chrome-extension://[your-id]/` → Local Storage equivalent → actually use:

```js
// DevTools console
chrome.storage.local.get(null, console.log)
// Logs all keys and values
```

Or in the extension context:
```js
chrome.storage.local.get(null, d => console.log(JSON.stringify(d, null, 2)))
```

### Is the write reaching storage?

Add temporary logging in `shared/storage.js`:

```js
export async function saveSettings(patch) {
  console.log('[Nodex] saveSettings called with:', patch)
  // ...existing code
}
```

Check if the log appears when saving from side panel. If not, the UI call isn't reaching the function.

### Is the read returning stale data?

`loadSettings(defaults)` merges with defaults. If a key is missing from storage, the default value is used. This is expected behavior, not a bug.

Check: after saving, immediately call `loadSettings()` and log the result. If the saved value isn't there, the write failed silently.

## Common Root Causes

### Multiple writers to the same key

The content script and side panel may both write `nodex_settings` in rapid succession (e.g. user clicks a setting while a gesture fires). Only `saveSettings` is serialized — other keys are not.

**Fix:** Route all settings writes through `saveSettings()`. Don't call `chrome.storage.local.set` directly for settings.

### Service worker suspended during write

MV3 service workers can sleep between events. If the SW is the one writing and it gets suspended mid-operation, the write may not complete.

**Fix:** Don't write settings from the service worker. Content script and side panel write directly — no SW relay needed for storage.

### Settings key mismatch

If `saveSettings` writes to `nodex_settings` but something else reads from `nodex_user_settings` (typo/rename), data will never be found.

Check all storage keys in one place: `shared/storage.js` key constants.

### `loadSettings` called before `saveSettings` completes

If two async operations run in parallel:
```js
await saveSettings({ yaw: 18 })   // writes
const s = await loadSettings()    // reads — may get old value if race
```

Since `saveSettings` is serialized internally, this shouldn't happen if you `await` it. If you fire `saveSettings` without awaiting, a subsequent `loadSettings` may get stale data.

## Prevention Rules

1. Always `await saveSettings()` before reading back
2. Use the exported wrappers (`saveSettings`, `savePlayerGestureMap`) — never `chrome.storage.local.set` directly for settings
3. Do not write the same key from multiple contexts simultaneously
4. For new storage keys: add them to the constants in `shared/storage.js` and document here
