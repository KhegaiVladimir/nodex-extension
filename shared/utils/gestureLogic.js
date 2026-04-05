// MediaPipe Face Mesh landmark indices used throughout this file.
// Full map: https://github.com/google/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model_uv_visualization.png
const NOSE_TIP        = 1
const LEFT_FACE_SIDE  = 234   // left cheek edge
const RIGHT_FACE_SIDE = 454   // right cheek edge
const FOREHEAD        = 10    // top of forehead center
const CHIN            = 152   // bottom of chin center
const RIGHT_EYE_UPPER = 159
const RIGHT_EYE_LOWER = 145
const RIGHT_EYE_INNER = 133
const RIGHT_EYE_OUTER = 33
const LEFT_EYE_UPPER  = 386
const LEFT_EYE_LOWER  = 374
const LEFT_EYE_INNER  = 362
const LEFT_EYE_OUTER  = 263
const UPPER_LIP       = 13
const LOWER_LIP       = 14
const MOUTH_LEFT      = 78
const MOUTH_RIGHT     = 308

const MIN_SPAN = 0.001

/** 3-D Euclidean distance between two landmark points. */
function dist(a, b) {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

/**
 * computeYaw — horizontal head rotation in approximate degrees.
 *
 * Uses landmarks: NOSE_TIP (1), LEFT_FACE_SIDE (234), RIGHT_FACE_SIDE (454).
 * Computes how far the nose is offset from the midpoint between the two cheek
 * edges, then maps the ratio to ±45°.
 *
 * Sign is **inverted** to compensate for the mirrored webcam feed:
 * nose displaced to the left in frame → user turned right → positive yaw.
 *
 * @param {Array<{x:number, y:number, z:number}>} lm - 468 landmarks
 * @returns {number} degrees, positive = turned right
 */
export function computeYaw(lm) {
  if (!lm?.length) return 0
  const nose  = lm[NOSE_TIP]
  const left  = lm[LEFT_FACE_SIDE]
  const right = lm[RIGHT_FACE_SIDE]
  if (!nose || !left || !right) return 0

  const midX      = (left.x + right.x) / 2
  const halfWidth = Math.abs(right.x - left.x) / 2
  if (halfWidth < MIN_SPAN) return 0

  return -((nose.x - midX) / halfWidth) * 45
}

/**
 * computePitch — vertical head tilt in approximate degrees.
 *
 * Uses landmarks: NOSE_TIP (1), FOREHEAD (10), CHIN (152).
 * Measures how far the nose sits above or below the midpoint between
 * forehead and chin, mapped to ±40°.
 *
 * Screen y increases downward, so nose above midpoint (smaller y) yields
 * a positive value = looking up.
 *
 * @param {Array<{x:number, y:number, z:number}>} lm - 468 landmarks
 * @returns {number} degrees, positive = looking up
 */
export function computePitch(lm) {
  if (!lm?.length) return 0
  const nose     = lm[NOSE_TIP]
  const forehead = lm[FOREHEAD]
  const chin     = lm[CHIN]
  if (!nose || !forehead || !chin) return 0

  const midY       = (forehead.y + chin.y) / 2
  const halfHeight = Math.abs(chin.y - forehead.y) / 2
  if (halfHeight < MIN_SPAN) return 0

  return ((midY - nose.y) / halfHeight) * 40
}

/**
 * computeRoll — ear-to-shoulder head tilt in degrees.
 *
 * Uses landmarks: LEFT_FACE_SIDE (234), RIGHT_FACE_SIDE (454).
 * Computes the angle of the line connecting the two cheek edges via atan2.
 * Inverted so positive = tilted right, negative = tilted left.
 *
 * @param {Array<{x:number, y:number, z:number}>} lm - 468 landmarks
 * @returns {number} degrees
 */
export function computeRoll(lm) {
  if (!lm?.length) return 0
  const left  = lm[LEFT_FACE_SIDE]
  const right = lm[RIGHT_FACE_SIDE]
  if (!left || !right) return 0

  const dx = right.x - left.x
  const dy = right.y - left.y
  if (Math.abs(dx) < MIN_SPAN && Math.abs(dy) < MIN_SPAN) return 0

  return -Math.atan2(dy, dx) * (180 / Math.PI)
}

/**
 * computeEAR — Eye Aspect Ratio, averaged across both eyes.
 *
 * Per eye: vertical distance (upper–lower lid) / horizontal distance
 * (inner–outer corner). Typical values: ~0.25–0.35 open, <0.18 closed.
 *
 * Right eye landmarks: 159 (upper), 145 (lower), 133 (inner), 33 (outer).
 * Left eye landmarks:  386 (upper), 374 (lower), 362 (inner), 263 (outer).
 *
 * @param {Array<{x:number, y:number, z:number}>} lm - 468 landmarks
 * @returns {number} ratio, lower = more closed
 */
export function computeEAR(lm) {
  if (!lm?.length) return 0.3

  const rU = lm[RIGHT_EYE_UPPER], rL = lm[RIGHT_EYE_LOWER]
  const rI = lm[RIGHT_EYE_INNER], rO = lm[RIGHT_EYE_OUTER]
  const lU = lm[LEFT_EYE_UPPER],  lL = lm[LEFT_EYE_LOWER]
  const lI = lm[LEFT_EYE_INNER],  lO = lm[LEFT_EYE_OUTER]

  if (!rU || !rL || !rI || !rO || !lU || !lL || !lI || !lO) return 0.3

  const rHoriz = dist(rI, rO)
  const lHoriz = dist(lI, lO)
  if (rHoriz < MIN_SPAN || lHoriz < MIN_SPAN) return 0.3

  return (dist(rU, rL) / rHoriz + dist(lU, lL) / lHoriz) / 2
}

/**
 * computeMouthRatio — vertical mouth opening relative to mouth width.
 *
 * Uses landmarks: UPPER_LIP (13), LOWER_LIP (14), MOUTH_LEFT (78),
 * MOUTH_RIGHT (308). Returns ~0.0 when closed, ~0.3+ when wide open.
 *
 * @param {Array<{x:number, y:number, z:number}>} lm - 468 landmarks
 * @returns {number} ratio
 */
export function computeMouthRatio(lm) {
  if (!lm?.length) return 0

  const upper = lm[UPPER_LIP]
  const lower = lm[LOWER_LIP]
  const left  = lm[MOUTH_LEFT]
  const right = lm[MOUTH_RIGHT]
  if (!upper || !lower || !left || !right) return 0

  const width = dist(left, right)
  if (width < MIN_SPAN) return 0

  return dist(upper, lower) / width
}
