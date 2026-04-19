/**
 * @param {number[]} sortedAsc
 * @returns {number[]}
 */
function filterOpenSamples(sortedAsc) {
  const n = sortedAsc.length
  if (n === 0) return []
  // Drop bottom 15 % (blink frames) and top 35 % (wide-eyed staring during calibration).
  // The 15th–65th percentile is representative of relaxed open-eye EAR,
  // which avoids inflating earOpen and pushing the threshold too high.
  const dropBot = Math.floor(n * 0.15)
  const dropTop = Math.floor(n * 0.35)
  const end = n - dropTop
  return dropBot < end ? sortedAsc.slice(dropBot, end) : sortedAsc.slice(dropBot)
}

/**
 * @param {number[]} sortedAsc
 * @returns {number[]}
 */
function filterClosedSamples(sortedAsc) {
  const n = sortedAsc.length
  if (n === 0) return []
  const dropBot = Math.floor(n * 0.1)
  const dropTop = Math.floor(n * 0.2)
  const end = n - dropTop
  if (dropBot >= end) return []
  return sortedAsc.slice(dropBot, end)
}

/** @param {number[]} nums */
function medianOf(nums) {
  if (nums.length === 0) return 0
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/** @param {number[]} nums */
function standardDeviation(nums) {
  if (nums.length < 2) return 0
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length
  const v = nums.reduce((s, x) => s + (x - mean) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(v)
}

import { REFINE_LANDMARKS } from '../constants/mediapipe.js'

/**
 * Two-phase blink calibration: open-eye vs closed-eye blink metric (EAR or iris ratio).
 * @param {number[]} openSamples
 * @param {number[]} closedSamples
 * @returns {{
 *   ok: true,
 *   earOpen: number,
 *   earClosed: number,
 *   range: number,
 *   threshold: number,
 *   exitThreshold: number,
 *   noiseFloor: number,
 *   samplesOpen: number,
 *   samplesClosed: number,
 *   calibratedAt: number,
 *   signalType: 'iris' | 'ear',
 * } | { ok: false, reason: string }}
 */
export function computeBlinkThreshold(openSamples, closedSamples) {
  const oRaw = Array.isArray(openSamples) ? openSamples.filter((x) => typeof x === 'number' && Number.isFinite(x)) : []
  const cRaw = Array.isArray(closedSamples) ? closedSamples.filter((x) => typeof x === 'number' && Number.isFinite(x)) : []

  const oSorted = [...oRaw].sort((a, b) => a - b)
  const cSorted = [...cRaw].sort((a, b) => a - b)

  const oFilt = filterOpenSamples(oSorted)
  const cFilt = filterClosedSamples(cSorted)

  if (oFilt.length === 0 || cFilt.length === 0) {
    return { ok: false, reason: 'insufficient_range' }
  }

  const earOpen = medianOf(oFilt)
  const earClosed = medianOf(cFilt)
  const range = earOpen - earClosed

  if (range < 0.02) {
    return { ok: false, reason: 'insufficient_range' }
  }

  let coeff = 0.35
  if (range > 0.25) {
    console.warn(
      '[Nodex] blink calibration: unusually large EAR range — using conservative threshold coefficient 0.5',
    )
    coeff = 0.5
  }

  let threshold = earClosed + range * coeff
  if (threshold > 0.3 && earOpen < 0.35) {
    threshold = earClosed + range * 0.5
  }
  threshold = Math.min(threshold, earOpen * 0.85)
  // exitThreshold sits just above threshold — narrow dead zone (~0.03) so the
  // signal crosses it in 1–2 frames when eyes open. A wide dead zone (old: 72%
  // of range) caused the open-eye EAR to never reach exitThreshold when the
  // user's posture or lighting changed slightly between calibration and use.
  const exitThreshold = Math.min(threshold + 0.03, earOpen * 0.80)
  const noiseFloor = standardDeviation(oFilt)

  return {
    ok: true,
    earOpen,
    earClosed,
    range,
    threshold,
    exitThreshold,
    noiseFloor,
    samplesOpen: oRaw.length,
    samplesClosed: cRaw.length,
    calibratedAt: Date.now(),
    signalType: REFINE_LANDMARKS ? 'iris' : 'ear',
  }
}
