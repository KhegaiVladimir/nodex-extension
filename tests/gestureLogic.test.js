/**
 * Unit tests for shared/utils/gestureLogic.js
 *
 * All functions are pure math — no Chrome APIs, no side effects.
 * Tests are grouped by function and cover:
 *   - Null / degenerate inputs
 *   - Identity / zero cases
 *   - Known geometric outputs
 *   - Sign convention (mirrored webcam feed)
 *   - Boundary values near MIN_SPAN = 0.001
 *   - Proportionality
 */

import { describe, it, expect } from 'vitest'
import {
  computeYaw,
  computePitch,
  computeRoll,
  computeEAR,
  computeMouthRatio,
} from '../shared/utils/gestureLogic.js'

// ─── landmark indices (must match gestureLogic.js) ────────────────────────────
const NOSE_TIP        = 1
const LEFT_FACE_SIDE  = 234
const RIGHT_FACE_SIDE = 454
const FOREHEAD        = 10
const CHIN            = 152
const RIGHT_EYE_UPPER = 159, RIGHT_EYE_LOWER   = 145
const RIGHT_EYE_UPPER_2 = 158, RIGHT_EYE_LOWER_2 = 153
const RIGHT_EYE_INNER = 133, RIGHT_EYE_OUTER   = 33
const LEFT_EYE_UPPER  = 386, LEFT_EYE_LOWER    = 374
const LEFT_EYE_UPPER_2 = 385, LEFT_EYE_LOWER_2 = 380
const LEFT_EYE_INNER  = 362, LEFT_EYE_OUTER    = 263
const UPPER_LIP = 13, LOWER_LIP = 14
const MOUTH_LEFT = 78, MOUTH_RIGHT = 308

// ─── helpers ──────────────────────────────────────────────────────────────────

/** Shorthand: create a 3-D point. */
const pt = (x = 0, y = 0, z = 0) => ({ x, y, z })

/**
 * Build a 468-element landmark array.
 * Every slot is {x:0, y:0, z:0} unless overridden.
 *
 * @param {Record<number, {x:number,y:number,z:number}>} overrides
 * @param {number} length - 468 for standard mesh, 478 for refined
 */
function makeLandmarks(overrides = {}, length = 468) {
  const lm = Array.from({ length }, () => pt())
  for (const [idx, val] of Object.entries(overrides)) {
    lm[Number(idx)] = val
  }
  return lm
}

/**
 * Build a face with the cheek-side anchors spread apart symmetrically
 * (canonical "looking straight" geometry).  Individual functions only need
 * certain landmarks; the rest stay at origin.
 *
 *   LEFT_FACE_SIDE.x  = -0.5
 *   RIGHT_FACE_SIDE.x = +0.5
 *   FOREHEAD.y        = -0.5  (top — smaller y = higher on screen)
 *   CHIN.y            = +0.5  (bottom)
 */
function makeNeutralFace(overrides = {}) {
  return makeLandmarks({
    [LEFT_FACE_SIDE]:  pt(-0.5, 0, 0),
    [RIGHT_FACE_SIDE]: pt( 0.5, 0, 0),
    [FOREHEAD]:        pt( 0, -0.5, 0),
    [CHIN]:            pt( 0,  0.5, 0),
    [NOSE_TIP]:        pt( 0,  0,   0), // centered = no yaw/pitch
    ...overrides,
  })
}

/**
 * Build a landmark array with realistic open-eye geometry on BOTH eyes,
 * symmetric. Eye geometry uses 2-D distances in the XY plane.
 *
 * For each eye:
 *   horiz (inner→outer) = 0.40
 *   vert1 (upper→lower) = 0.28
 *   vert2 (upper2→lower2) = 0.20
 *   meanVert = (0.28 + 0.20) / 2 = 0.24
 *   EAR per eye = 0.24 / 0.40 = 0.60
 *   Total EAR = (0.60 + 0.60) / 2 = 0.60
 */
function makeOpenEyeLandmarks(overrides = {}) {
  return makeLandmarks({
    // ── right eye ────────────────────────────────
    [RIGHT_EYE_INNER]:   pt(0.40, 0.50),
    [RIGHT_EYE_OUTER]:   pt(0.00, 0.50),   // horiz = 0.40
    [RIGHT_EYE_UPPER]:   pt(0.20, 0.36),
    [RIGHT_EYE_LOWER]:   pt(0.20, 0.64),   // vert1 = 0.28
    [RIGHT_EYE_UPPER_2]: pt(0.15, 0.40),
    [RIGHT_EYE_LOWER_2]: pt(0.15, 0.60),   // vert2 = 0.20
    // ── left eye (mirror-symmetric x) ────────────
    [LEFT_EYE_INNER]:    pt(0.60, 0.50),
    [LEFT_EYE_OUTER]:    pt(1.00, 0.50),   // horiz = 0.40
    [LEFT_EYE_UPPER]:    pt(0.80, 0.36),
    [LEFT_EYE_LOWER]:    pt(0.80, 0.64),   // vert1 = 0.28
    [LEFT_EYE_UPPER_2]:  pt(0.85, 0.40),
    [LEFT_EYE_LOWER_2]:  pt(0.85, 0.60),   // vert2 = 0.20
    ...overrides,
  })
}

const EXPECTED_OPEN_EAR = 0.60  // derived from the geometry above

// ─── computeYaw ───────────────────────────────────────────────────────────────

describe('computeYaw', () => {

  // ── null / invalid inputs ──────────────────────────────────────────────────

  it('returns 0 for null', () => {
    expect(computeYaw(null)).toBe(0)
  })

  it('returns 0 for undefined', () => {
    expect(computeYaw(undefined)).toBe(0)
  })

  it('returns 0 for empty array', () => {
    expect(computeYaw([])).toBe(0)
  })

  it('returns 0 when required landmarks are missing (sparse array)', () => {
    const sparse = new Array(468)  // every slot is `undefined`
    expect(computeYaw(sparse)).toBe(0)
  })

  // ── degenerate geometry ────────────────────────────────────────────────────

  it('returns 0 when both cheek landmarks are at the same x (halfWidth < MIN_SPAN)', () => {
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0.5, 0),
      [RIGHT_FACE_SIDE]: pt(0.5, 0),  // same x → halfWidth = 0
    })
    expect(computeYaw(lm)).toBe(0)
  })

  it('returns 0 when cheeks are within MIN_SPAN = 0.001 of each other', () => {
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0.000, 0),
      [RIGHT_FACE_SIDE]: pt(0.0005, 0), // gap = 0.0005 < 0.001
    })
    expect(computeYaw(lm)).toBe(0)
  })

  // ── identity: nose at midpoint ─────────────────────────────────────────────

  it('returns 0 when nose is exactly at the midpoint of the two cheeks', () => {
    // left.x=0, right.x=1 → midX=0.5; nose.x=0.5 → no offset
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.5, 0),
    })
    expect(computeYaw(lm)).toBeCloseTo(0, 6)
  })

  // ── sign convention (mirrored feed) ────────────────────────────────────────

  it('returns POSITIVE when nose is displaced LEFT in frame (user turned right)', () => {
    // nose.x < midX → offset is negative → -(negative) = positive = turned right
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.25, 0),  // displaced left of midX=0.5
    })
    expect(computeYaw(lm)).toBeGreaterThan(0)
  })

  it('returns NEGATIVE when nose is displaced RIGHT in frame (user turned left)', () => {
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.75, 0),  // displaced right of midX=0.5
    })
    expect(computeYaw(lm)).toBeLessThan(0)
  })

  // ── known output values ────────────────────────────────────────────────────

  it('returns exactly +45° when nose is at the LEFT cheek edge (max right turn)', () => {
    // nose.x = left.x → offset = -(midX) / halfWidth = -(0.5)/0.5 = -1 → -(-1)*45 = +45
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0, 0),
    })
    expect(computeYaw(lm)).toBeCloseTo(45, 5)
  })

  it('returns exactly -45° when nose is at the RIGHT cheek edge (max left turn)', () => {
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(1, 0),
    })
    expect(computeYaw(lm)).toBeCloseTo(-45, 5)
  })

  it('returns ~22.5° for a half-rotation (nose at 25% of width)', () => {
    // offset = (0.25 - 0.5) / 0.5 = -0.5 → -(-0.5)*45 = 22.5
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.25, 0),
    })
    expect(computeYaw(lm)).toBeCloseTo(22.5, 4)
  })

  // ── proportionality ────────────────────────────────────────────────────────

  it('is proportional: doubling the offset doubles the angle', () => {
    const base = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.4, 0),  // offset = -0.1 → 9°
    })
    const doubled = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 0),
      [NOSE_TIP]:        pt(0.3, 0),  // offset = -0.2 → 18°
    })
    const yaw1 = computeYaw(base)
    const yaw2 = computeYaw(doubled)
    expect(yaw2).toBeCloseTo(yaw1 * 2, 4)
  })

  it('returns angle > 45° when nose is past the outer cheek edge (extreme rotation)', () => {
    // nose.x = -0.1, left.x = 0, right.x = 1 → midX = 0.5, halfWidth = 0.5
    // ratio = (-0.1 - 0.5) / 0.5 = -1.2  →  yaw = -(-1.2) * 45 = +54°
    const lm = makeNeutralFace({
      [LEFT_FACE_SIDE]:  pt(0.0, 0),
      [RIGHT_FACE_SIDE]: pt(1.0, 0),
      [NOSE_TIP]:        pt(-0.1, 0),  // past the left cheek edge
    })
    const yaw = computeYaw(lm)
    expect(yaw).toBeGreaterThan(45)
    expect(yaw).toBeCloseTo(54, 4)
  })

  it('is unaffected by y and z coordinates of the landmarks', () => {
    const flat = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(-0.5, 0,   0  ),
      [RIGHT_FACE_SIDE]: pt( 0.5, 0,   0  ),
      [NOSE_TIP]:        pt( 0,   0,   0  ),
    })
    const displaced = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(-0.5, 10,  5  ),
      [RIGHT_FACE_SIDE]: pt( 0.5, 10,  5  ),
      [NOSE_TIP]:        pt( 0,   10,  5  ),
    })
    expect(computeYaw(flat)).toBeCloseTo(computeYaw(displaced), 5)
  })

})

// ─── computePitch ─────────────────────────────────────────────────────────────

describe('computePitch', () => {

  // ── null / invalid inputs ──────────────────────────────────────────────────

  it('returns 0 for null', () => { expect(computePitch(null)).toBe(0) })
  it('returns 0 for empty array', () => { expect(computePitch([])).toBe(0) })
  it('returns 0 when required landmarks are absent', () => {
    expect(computePitch(new Array(468))).toBe(0)
  })

  // ── degenerate geometry ────────────────────────────────────────────────────

  it('returns 0 when forehead and chin share the same y (halfHeight < MIN_SPAN)', () => {
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0.5),
      [CHIN]:     pt(0, 0.5),  // same y → halfHeight = 0
    })
    expect(computePitch(lm)).toBe(0)
  })

  // ── identity ──────────────────────────────────────────────────────────────

  it('returns 0 when nose is exactly at the midpoint between forehead and chin', () => {
    // forehead.y=0, chin.y=1 → midY=0.5; nose.y=0.5 → no pitch
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.5),
    })
    expect(computePitch(lm)).toBeCloseTo(0, 6)
  })

  // ── sign convention ────────────────────────────────────────────────────────

  it('returns POSITIVE when nose is ABOVE midpoint (looking up)', () => {
    // Screen y increases downward.  Nose above midpoint → nose.y < midY.
    // (midY - nose.y) > 0 → positive pitch = looking up ✓
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.3),  // above midY=0.5
    })
    expect(computePitch(lm)).toBeGreaterThan(0)
  })

  it('returns NEGATIVE when nose is BELOW midpoint (looking down)', () => {
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.7),  // below midY=0.5
    })
    expect(computePitch(lm)).toBeLessThan(0)
  })

  // ── known output values ────────────────────────────────────────────────────

  it('returns exactly +40° when nose is at forehead position (max up)', () => {
    // nose.y = forehead.y = 0; midY = 0.5; halfHeight = 0.5
    // (0.5 - 0) / 0.5 * 40 = +40
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0),
    })
    expect(computePitch(lm)).toBeCloseTo(40, 5)
  })

  it('returns exactly -40° when nose is at chin position (max down)', () => {
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 1),
    })
    expect(computePitch(lm)).toBeCloseTo(-40, 5)
  })

  it('returns +20° for a half-upward look (nose at 25% of height)', () => {
    // (0.5 - 0.25) / 0.5 * 40 = 20
    const lm = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.25),
    })
    expect(computePitch(lm)).toBeCloseTo(20, 4)
  })

  // ── proportionality ────────────────────────────────────────────────────────

  it('is proportional: doubling the vertical offset doubles the angle', () => {
    const small = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.45),  // 0.05 above midpoint
    })
    const large = makeNeutralFace({
      [FOREHEAD]: pt(0, 0),
      [CHIN]:     pt(0, 1),
      [NOSE_TIP]: pt(0, 0.40),  // 0.10 above midpoint
    })
    expect(computePitch(large)).toBeCloseTo(computePitch(small) * 2, 4)
  })

  it('is unaffected by x and z coordinates', () => {
    const a = makeNeutralFace({
      [FOREHEAD]: pt(0, 0,  0), [CHIN]: pt(0, 1, 0), [NOSE_TIP]: pt(0, 0.4, 0),
    })
    const b = makeNeutralFace({
      [FOREHEAD]: pt(5, 0, 99), [CHIN]: pt(5, 1, 99), [NOSE_TIP]: pt(5, 0.4, 99),
    })
    expect(computePitch(a)).toBeCloseTo(computePitch(b), 5)
  })

})

// ─── computeRoll ──────────────────────────────────────────────────────────────

describe('computeRoll', () => {

  // ── null / invalid inputs ──────────────────────────────────────────────────

  it('returns 0 for null', () => { expect(computeRoll(null)).toBe(0) })
  it('returns 0 for empty array', () => { expect(computeRoll([])).toBe(0) })
  it('returns 0 when required landmarks are absent', () => {
    expect(computeRoll(new Array(468))).toBe(0)
  })

  // ── degenerate geometry ────────────────────────────────────────────────────

  it('returns 0 when both landmarks are at the same position', () => {
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0.5, 0.5),
      [RIGHT_FACE_SIDE]: pt(0.5, 0.5),
    })
    expect(computeRoll(lm)).toBe(0)
  })

  // ── identity: level face ───────────────────────────────────────────────────

  it('returns 0 for a perfectly level face (dy = 0)', () => {
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0.5),
      [RIGHT_FACE_SIDE]: pt(1, 0.5),  // same y
    })
    expect(computeRoll(lm)).toBeCloseTo(0, 5)
  })

  // ── sign convention ────────────────────────────────────────────────────────
  //
  // In a mirrored webcam feed:
  //   LEFT_FACE_SIDE (234)  = person's RIGHT ear
  //   RIGHT_FACE_SIDE (454) = person's LEFT ear
  //
  // Person tilts right → right ear goes DOWN (higher y), left ear goes UP.
  // So LEFT_FACE_SIDE.y increases, RIGHT_FACE_SIDE.y decreases.
  //   dy = right.y - left.y < 0
  //   roll = -atan2(negative, positive_dx) = positive → TILT_RIGHT ✓

  it('returns POSITIVE for a right head tilt (person perspective)', () => {
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0.1),   // right ear (mirrored) — goes DOWN
      [RIGHT_FACE_SIDE]: pt(1, -0.1),  // left ear (mirrored) — goes UP
    })
    expect(computeRoll(lm)).toBeGreaterThan(0)
  })

  it('returns NEGATIVE for a left head tilt (person perspective)', () => {
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, -0.1),  // right ear — goes UP
      [RIGHT_FACE_SIDE]: pt(1,  0.1),  // left ear — goes DOWN
    })
    expect(computeRoll(lm)).toBeLessThan(0)
  })

  // ── known output value ────────────────────────────────────────────────────

  it('returns exactly -45° for a pure 45° CCW tilt (dy = dx)', () => {
    // dy = 1, dx = 1 → atan2(1,1) = π/4 → roll = -π/4 * (180/π) = -45°
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, 1),  // right going down at 45°
    })
    expect(computeRoll(lm)).toBeCloseTo(-45, 4)
  })

  it('returns +45° for a pure 45° CW tilt (dy = -dx)', () => {
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0),
      [RIGHT_FACE_SIDE]: pt(1, -1), // right going up at 45°
    })
    expect(computeRoll(lm)).toBeCloseTo(45, 4)
  })

  it('returns -90° for a 90° CCW tilt (dx = 0, right ear directly below left ear)', () => {
    // dy = 1, dx = 0 → atan2(1, 0) = π/2 → roll = -90°
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0.5, 0  ),
      [RIGHT_FACE_SIDE]: pt(0.5, 1.0),  // same x, right ear lower → pure vertical
    })
    expect(computeRoll(lm)).toBeCloseTo(-90, 4)
  })

  it('returns +90° for a 90° CW tilt (dx = 0, right ear directly above left ear)', () => {
    // dy = -1, dx = 0 → atan2(-1, 0) = -π/2 → roll = +90°
    const lm = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0.5,  1.0),
      [RIGHT_FACE_SIDE]: pt(0.5, -1.0),  // right ear above left ear
    })
    expect(computeRoll(lm)).toBeCloseTo(90, 4)
  })

  // ── symmetry ──────────────────────────────────────────────────────────────

  it('left and right tilts of equal magnitude have equal absolute values', () => {
    const right = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, 0.2),
      [RIGHT_FACE_SIDE]: pt(1, -0.2),
    })
    const left = makeLandmarks({
      [LEFT_FACE_SIDE]:  pt(0, -0.2),
      [RIGHT_FACE_SIDE]: pt(1,  0.2),
    })
    expect(Math.abs(computeRoll(right))).toBeCloseTo(Math.abs(computeRoll(left)), 5)
    expect(Math.sign(computeRoll(right))).toBe(-Math.sign(computeRoll(left)))
  })

})

// ─── computeEAR ───────────────────────────────────────────────────────────────

describe('computeEAR', () => {

  // ── null / invalid inputs ──────────────────────────────────────────────────

  it('returns null for null', () => { expect(computeEAR(null)).toBeNull() })
  it('returns null for empty array', () => { expect(computeEAR([])).toBeNull() })
  it('returns null for sparse array (missing landmarks)', () => {
    expect(computeEAR(new Array(468))).toBeNull()
  })

  // ── degenerate: zero horizontal span ──────────────────────────────────────

  it('returns null when right eye inner = outer (zero horiz span)', () => {
    // All other landmarks provided but inner/outer of right eye coincide.
    const lm = makeOpenEyeLandmarks({
      [RIGHT_EYE_INNER]: pt(0.5, 0.5),
      [RIGHT_EYE_OUTER]: pt(0.5, 0.5),  // horiz = 0 < MIN_SPAN
    })
    expect(computeEAR(lm)).toBeNull()
  })

  it('returns null when left eye inner = outer (zero horiz span)', () => {
    const lm = makeOpenEyeLandmarks({
      [LEFT_EYE_INNER]: pt(0.5, 0.5),
      [LEFT_EYE_OUTER]: pt(0.5, 0.5),
    })
    expect(computeEAR(lm)).toBeNull()
  })

  // ── closed eye ────────────────────────────────────────────────────────────

  it('returns 0 when upper and lower lids are at the same position (fully closed)', () => {
    // All vertical spans = 0 → EAR numerator = 0
    const lm = makeOpenEyeLandmarks({
      [RIGHT_EYE_UPPER]:   pt(0.20, 0.50),
      [RIGHT_EYE_LOWER]:   pt(0.20, 0.50),  // coincide
      [RIGHT_EYE_UPPER_2]: pt(0.15, 0.50),
      [RIGHT_EYE_LOWER_2]: pt(0.15, 0.50),  // coincide
      [LEFT_EYE_UPPER]:    pt(0.80, 0.50),
      [LEFT_EYE_LOWER]:    pt(0.80, 0.50),
      [LEFT_EYE_UPPER_2]:  pt(0.85, 0.50),
      [LEFT_EYE_LOWER_2]:  pt(0.85, 0.50),
    })
    expect(computeEAR(lm)).toBeCloseTo(0, 6)
  })

  // ── open eye ──────────────────────────────────────────────────────────────

  it('returns the expected EAR for the canonical open-eye geometry', () => {
    const lm = makeOpenEyeLandmarks()
    expect(computeEAR(lm)).toBeCloseTo(EXPECTED_OPEN_EAR, 4)
  })

  it('returns a positive value for any open eye', () => {
    expect(computeEAR(makeOpenEyeLandmarks())).toBeGreaterThan(0)
  })

  // ── formula verification: Sukoi 6-point EAR ───────────────────────────────

  it('equals mean of two vertical distances divided by horizontal — manually computed', () => {
    // Right eye:
    //   inner={0.4, 0.5}, outer={0, 0.5}  → horiz = 0.4
    //   upper={0.2, 0.36}, lower={0.2, 0.64} → vert1 = 0.28
    //   upper2={0.15, 0.40}, lower2={0.15, 0.60} → vert2 = 0.20
    //   meanVert = (0.28+0.20)/2 = 0.24
    //   rEAR = 0.24/0.40 = 0.60
    // Both eyes symmetric → total = 0.60
    const lm = makeOpenEyeLandmarks()
    const ear = computeEAR(lm)
    expect(ear).toBeCloseTo(0.60, 4)
  })

  it('is symmetric: swapping both eye geometries gives the same result', () => {
    // Swap role of right/left eye values — total EAR is invariant.
    const normal = makeOpenEyeLandmarks()

    // Make right eye narrow and left eye wide, then compare to vice versa.
    const narrowRight = makeOpenEyeLandmarks({
      [RIGHT_EYE_UPPER]:   pt(0.20, 0.46),
      [RIGHT_EYE_LOWER]:   pt(0.20, 0.54), // vert1=0.08
      [RIGHT_EYE_UPPER_2]: pt(0.15, 0.47),
      [RIGHT_EYE_LOWER_2]: pt(0.15, 0.53), // vert2=0.06
    })
    const narrowLeft = makeOpenEyeLandmarks({
      [LEFT_EYE_UPPER]:    pt(0.80, 0.46),
      [LEFT_EYE_LOWER]:    pt(0.80, 0.54),
      [LEFT_EYE_UPPER_2]:  pt(0.85, 0.47),
      [LEFT_EYE_LOWER_2]:  pt(0.85, 0.53),
    })
    // Both have (narrow + wide) / 2 — should be equal.
    expect(computeEAR(narrowRight)).toBeCloseTo(computeEAR(narrowLeft), 4)
  })

  it('returns average of open and closed for an asymmetric (one-eye-open) face', () => {
    // Right eye open: EAR = 0.60.  Left eye closed: all vert spans = 0 → EAR = 0.
    // Total = (0.60 + 0.00) / 2 = 0.30
    const lm = makeOpenEyeLandmarks({
      [LEFT_EYE_UPPER]:   pt(0.80, 0.50),
      [LEFT_EYE_LOWER]:   pt(0.80, 0.50),  // same y → vert1 = 0
      [LEFT_EYE_UPPER_2]: pt(0.85, 0.50),
      [LEFT_EYE_LOWER_2]: pt(0.85, 0.50),  // same y → vert2 = 0
    })
    expect(computeEAR(lm)).toBeCloseTo(0.30, 4)
  })

  it('correctly recomputes the mean when only one secondary pair changes', () => {
    // Right eye baseline: vert1=0.28, change vert2 from 0.20 to 0.12
    //   meanVert = (0.28 + 0.12) / 2 = 0.20  →  EAR_right = 0.20/0.40 = 0.50
    // Left eye: same change
    // Total = 0.50
    const lm = makeOpenEyeLandmarks({
      [RIGHT_EYE_UPPER_2]: pt(0.15, 0.44),
      [RIGHT_EYE_LOWER_2]: pt(0.15, 0.56),  // vert2 = 0.12  (was 0.20)
      [LEFT_EYE_UPPER_2]:  pt(0.85, 0.44),
      [LEFT_EYE_LOWER_2]:  pt(0.85, 0.56),
    })
    expect(computeEAR(lm)).toBeCloseTo(0.50, 4)
  })

  it('includes z-axis depth when computing vertical lid distances', () => {
    // Upper and lower lids share the same x,y but differ in z.
    // dist(upper, lower) = 0.4 (pure z-axis).  horiz stays 0.40.
    // EAR per eye = 0.40 / 0.40 = 1.0  →  total = 1.0
    const lm = makeOpenEyeLandmarks({
      [RIGHT_EYE_UPPER]:   pt(0.20, 0.50, 0   ),
      [RIGHT_EYE_LOWER]:   pt(0.20, 0.50, 0.4 ),
      [RIGHT_EYE_UPPER_2]: pt(0.15, 0.50, 0   ),
      [RIGHT_EYE_LOWER_2]: pt(0.15, 0.50, 0.4 ),
      [LEFT_EYE_UPPER]:    pt(0.80, 0.50, 0   ),
      [LEFT_EYE_LOWER]:    pt(0.80, 0.50, 0.4 ),
      [LEFT_EYE_UPPER_2]:  pt(0.85, 0.50, 0   ),
      [LEFT_EYE_LOWER_2]:  pt(0.85, 0.50, 0.4 ),
    })
    expect(computeEAR(lm)).toBeCloseTo(1.0, 4)
  })

  it('scales proportionally when both eye geometries are uniformly scaled', () => {
    // Scale all coordinates by 2 — EAR is a ratio, must stay constant.
    const scale = (lm) => lm.map(p => pt(p.x * 2, p.y * 2, p.z * 2))
    const lm = makeOpenEyeLandmarks()
    const scaled = scale(lm)
    expect(computeEAR(scaled)).toBeCloseTo(computeEAR(lm), 4)
  })

  // ── range sanity ──────────────────────────────────────────────────────────

  it('typical open-eye EAR (0.3 range) is between 0.2 and 1.0', () => {
    const ear = computeEAR(makeOpenEyeLandmarks())
    expect(ear).toBeGreaterThan(0.2)
    expect(ear).toBeLessThan(1.0)
  })

})

// ─── computeMouthRatio ────────────────────────────────────────────────────────

describe('computeMouthRatio', () => {

  // ── null / invalid inputs ──────────────────────────────────────────────────

  it('returns 0 for null', () => { expect(computeMouthRatio(null)).toBe(0) })
  it('returns 0 for empty array', () => { expect(computeMouthRatio([])).toBe(0) })
  it('returns 0 for sparse array', () => {
    expect(computeMouthRatio(new Array(468))).toBe(0)
  })

  // ── closed mouth ──────────────────────────────────────────────────────────

  it('returns 0 when upper and lower lip are at the same position', () => {
    const lm = makeLandmarks({
      [UPPER_LIP]:  pt(0.5, 0.6),
      [LOWER_LIP]:  pt(0.5, 0.6),  // same → dist = 0
      [MOUTH_LEFT]: pt(0.3, 0.6),
      [MOUTH_RIGHT]:pt(0.7, 0.6),
    })
    expect(computeMouthRatio(lm)).toBeCloseTo(0, 6)
  })

  // ── degenerate: zero mouth width ──────────────────────────────────────────

  it('returns 0 when left and right corners coincide (width < MIN_SPAN)', () => {
    const lm = makeLandmarks({
      [UPPER_LIP]:  pt(0.5, 0.58),
      [LOWER_LIP]:  pt(0.5, 0.62),
      [MOUTH_LEFT]: pt(0.5, 0.60),
      [MOUTH_RIGHT]:pt(0.5, 0.60),  // same position
    })
    expect(computeMouthRatio(lm)).toBe(0)
  })

  // ── known values ──────────────────────────────────────────────────────────

  it('returns opening/width for a proportional mouth', () => {
    // width = 1.0, opening = 0.2 → ratio = 0.2
    const lm = makeLandmarks({
      [MOUTH_LEFT]:  pt(0.0, 0.5),
      [MOUTH_RIGHT]: pt(1.0, 0.5),  // width = 1.0
      [UPPER_LIP]:   pt(0.5, 0.4),
      [LOWER_LIP]:   pt(0.5, 0.6),  // opening = 0.2
    })
    expect(computeMouthRatio(lm)).toBeCloseTo(0.2, 5)
  })

  it('returns 0.5 for a "square" open mouth (opening = half the width)', () => {
    const lm = makeLandmarks({
      [MOUTH_LEFT]:  pt(0,   0.5),
      [MOUTH_RIGHT]: pt(0.4, 0.5),  // width = 0.4
      [UPPER_LIP]:   pt(0.2, 0.4),
      [LOWER_LIP]:   pt(0.2, 0.6),  // opening = 0.2 → ratio = 0.2/0.4 = 0.5
    })
    expect(computeMouthRatio(lm)).toBeCloseTo(0.5, 5)
  })

  // ── scale invariance ──────────────────────────────────────────────────────

  it('is scale-invariant (ratio of distances → uniform scaling has no effect)', () => {
    const base = makeLandmarks({
      [MOUTH_LEFT]: pt(0, 0.5), [MOUTH_RIGHT]: pt(1, 0.5),
      [UPPER_LIP]:  pt(0.5, 0.4), [LOWER_LIP]: pt(0.5, 0.6),
    })
    const scaled = makeLandmarks({
      [MOUTH_LEFT]: pt(0, 5), [MOUTH_RIGHT]: pt(10, 5),
      [UPPER_LIP]:  pt(5, 4), [LOWER_LIP]:   pt(5,  6),
    })
    expect(computeMouthRatio(base)).toBeCloseTo(computeMouthRatio(scaled), 5)
  })

  // ── real-world range ──────────────────────────────────────────────────────

  it('returns ratio > 1 when mouth opening exceeds mouth width (very wide yawn)', () => {
    // opening = 1.2, width = 0.8 → ratio = 1.5
    const lm = makeLandmarks({
      [MOUTH_LEFT]:  pt(0.0, 0.5),
      [MOUTH_RIGHT]: pt(0.8, 0.5),   // width = 0.8
      [UPPER_LIP]:   pt(0.4, 0.0),
      [LOWER_LIP]:   pt(0.4, 1.2),   // opening = 1.2
    })
    const ratio = computeMouthRatio(lm)
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).toBeCloseTo(1.5, 4)
  })

  it('includes z-axis depth when computing lip separation', () => {
    // Upper and lower lips share the same x,y but differ in z by 0.5.
    // dist(upper, lower) = 0.5.  width (x-only) = 1.0.  ratio = 0.5.
    const lm = makeLandmarks({
      [UPPER_LIP]:   pt(0.5, 0.6, 0  ),
      [LOWER_LIP]:   pt(0.5, 0.6, 0.5),  // z-only separation
      [MOUTH_LEFT]:  pt(0.0, 0.6, 0  ),
      [MOUTH_RIGHT]: pt(1.0, 0.6, 0  ),
    })
    expect(computeMouthRatio(lm)).toBeCloseTo(0.5, 4)
  })

  it('wide open mouth gives ratio > DEFAULT_THRESHOLDS.mouthOpen (0.55)', () => {
    // Create a mouth where opening ≈ 70% of width → ratio ≈ 0.7
    const lm = makeLandmarks({
      [MOUTH_LEFT]:  pt(0, 0.5),
      [MOUTH_RIGHT]: pt(1, 0.5),   // width = 1.0
      [UPPER_LIP]:   pt(0.5, 0.15),
      [LOWER_LIP]:   pt(0.5, 0.85), // opening = 0.70
    })
    expect(computeMouthRatio(lm)).toBeGreaterThan(0.55)
  })

})
