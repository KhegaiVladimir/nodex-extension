const KEYS = {
  CALIBRATION:       'nodex_calibration',
  SETTINGS:          'nodex_settings',
  GESTURE_MAP:       'nodex_gesture_map',
  PLAYER_GESTURE_MAP: 'nodex_player_gesture_map',
  BROWSE_GESTURE_MAP: 'nodex_browse_gesture_map',
}

async function get(key) {
  const result = await chrome.storage.local.get(key)
  return result[key] ?? null
}

async function set(key, value) {
  await chrome.storage.local.set({ [key]: value })
}

export async function loadCalibration() {
  return get(KEYS.CALIBRATION)
}

export async function saveCalibration(data) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new TypeError('calibration data must be a plain object')
  }
  await set(KEYS.CALIBRATION, data)
}

export async function loadSettings(defaults = {}) {
  const stored = await get(KEYS.SETTINGS)
  // Normalize onboarding_complete: accept any truthy value as "onboarded"
  // to survive past bugs where it might have been saved as "true" (string) or 1.
  if (stored && stored.onboarding_complete) {
    stored.onboarding_complete = true
  }
  return { ...defaults, ...(stored ?? {}) }
}

let settingsWriteQueue = Promise.resolve()

export async function saveSettings(patch) {
  // Serialize all writes to prevent read-modify-write races between
  // the side panel, content script, and service worker all writing
  // to the same settings object concurrently.
  const next = settingsWriteQueue.then(async () => {
    const current = (await get(KEYS.SETTINGS)) ?? {}
    const merged = { ...current, ...patch }
    await set(KEYS.SETTINGS, merged)
    return merged
  })
  settingsWriteQueue = next.catch(() => {})
  return next
}

export async function loadGestureMap(defaults = {}) {
  const stored = await get(KEYS.GESTURE_MAP)
  return { ...defaults, ...(stored ?? {}) }
}

export async function saveGestureMap(map) {
  await set(KEYS.GESTURE_MAP, map)
}

export async function loadPlayerGestureMap(defaults = {}) {
  const stored = await get(KEYS.PLAYER_GESTURE_MAP)
  if (stored) return { ...defaults, ...stored }
  const legacy = await get(KEYS.GESTURE_MAP)
  return { ...defaults, ...(legacy ?? {}) }
}

export async function savePlayerGestureMap(map) {
  await set(KEYS.PLAYER_GESTURE_MAP, map)
}

export async function loadBrowseGestureMap(defaults = {}) {
  const stored = await get(KEYS.BROWSE_GESTURE_MAP)
  return { ...defaults, ...(stored ?? {}) }
}

export async function saveBrowseGestureMap(map) {
  await set(KEYS.BROWSE_GESTURE_MAP, map)
}
