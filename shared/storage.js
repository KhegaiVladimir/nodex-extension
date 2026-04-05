const KEYS = {
  CALIBRATION: 'nodex_calibration',
  SETTINGS:    'nodex_settings',
  GESTURE_MAP: 'nodex_gesture_map',
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
  return { ...defaults, ...stored }
}

export async function saveSettings(patch) {
  const current = await get(KEYS.SETTINGS)
  const merged = { ...current, ...patch }
  await set(KEYS.SETTINGS, merged)
  return merged
}

export async function loadGestureMap(defaults = {}) {
  const stored = await get(KEYS.GESTURE_MAP)
  return { ...defaults, ...(stored ?? {}) }
}

export async function saveGestureMap(map) {
  await set(KEYS.GESTURE_MAP, map)
}
