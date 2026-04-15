/**
 * Unit tests for content/GestureEngine.js
 *
 * Strategy:
 *   - All cooldowns are set to 0 ms so every fire() succeeds without time mocking.
 *   - Private methods (_shouldDeactivate, _detect, _updateHeadPoseDwellStreaks,
 *     _processBlinkFrame) are called directly — they hold the critical logic.
 *   - Integration tests drive processFrame() end-to-end and verify callbacks.
 *
 * Coverage areas:
 *   1. _shouldDeactivate  — hysteresis boundary math for all 7 gesture types
 *   2. _detect            — detection threshold, dwell requirements, disambiguation
 *   3. _updateHeadPoseDwellStreaks — accumulation, decay, pre-warm zone
 *   4. _processBlinkFrame — 3-zone state machine, personal/fallback calibration
 *   5. Auto-EAR calibration EMA — seed, update, warmup threshold
 *   6. setNeutralPose / baseline application
 *   7. processFrame integration — blocked state, wizard mode, full gesture pipeline
 *   8. destroy() — idempotent cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { GestureEngine } from '../content/GestureEngine.js'
import { GESTURES } from '../shared/constants/gestures.js'
import { COMMANDS } from '../shared/constants/commands.js'
import { DEFAULT_THRESHOLDS, PLAYER_GESTURE_MAP } from '../shared/constants/defaults.js'

// ─── helpers ──────────────────────────────────────────────────────────────────

/** All cooldowns set to 0 ms so fire() always succeeds immediately. */
const ZERO_COOLDOWNS = Object.fromEntries(
  Object.values(GESTURES).filter(g => g !== GESTURES.NONE).map(g => [g, 0])
)

/**
 * Create a GestureEngine ready for isolated unit testing.
 * @param {object} opts - merged with defaults
 */
function makeEngine(opts = {}) {
  return new GestureEngine({
    cooldowns: ZERO_COOLDOWNS,
    gestureMap: PLAYER_GESTURE_MAP,
    thresholds: { ...DEFAULT_THRESHOLDS },
    ...opts,
  })
}

/** Create a minimal 468-point landmark array (all zeros). */
function makeLandmarks(overrides = {}, n = 468) {
  const lm = Array.from({ length: n }, () => ({ x: 0, y: 0, z: 0 }))
  for (const [idx, val] of Object.entries(overrides)) lm[Number(idx)] = val
  return lm
}

/**
 * Create a 468-landmark array encoding specific metric values.
 * Uses the inverse of the math in gestureLogic.js.
 *
 *   YAW:   left.x=0, right.x=1, nose.x = 0.5 - (yaw/45)*0.5
 *   PITCH: forehead.y=0, chin.y=1, nose.y = 0.5 - (pitch/40)*0.5
 *   ROLL:  level by default (same y for left/right cheek)
 *   EAR:   encoded as a large horiz span and vert proportional to ear value
 */
function makeFaceLandmarks({ yaw = 0, pitch = 0, roll = 0, ear = 0.3, mouth = 0 } = {}) {
  // Cheek x positions
  const leftX  = -0.5
  const rightX =  0.5

  // Yaw: nose.x = midX - (yaw/45)*halfWidth
  const midX      = (leftX + rightX) / 2          // 0
  const halfWidth = (rightX - leftX) / 2           // 0.5
  const noseX     = midX - (yaw / 45) * halfWidth  // inverts the formula

  // Pitch: nose.y = midY - (pitch/40)*halfHeight
  const topY       = -0.5
  const botY       =  0.5
  const midY       = (topY + botY) / 2             // 0
  const halfHeight = (botY - topY) / 2             // 0.5
  const noseY      = midY - (pitch / 40) * halfHeight

  // Roll: encode via dy/dx = tan(−roll_radians)
  // roll = -atan2(dy, dx) * (180/π) → atan2(dy,dx) = -roll_rad
  const rollRad = -roll * (Math.PI / 180)
  const cheekDy = Math.sin(rollRad)   // dy proportional to sin
  const cheekDx = Math.cos(rollRad)   // dx proportional to cos

  // EAR: use simple 2-D eye geometry.  horiz = 0.4, vert = ear * 0.4
  const horiz  = 0.40
  const vHalf  = (ear * horiz) / 2  // half of total vert span
  const eBase  = { y: 0.5 }

  // MOUTH: opening = mouth * 1.0 (unit width)
  const mHalf = mouth / 2

  const NOSE  = 1
  const LFS   = 234  // LEFT_FACE_SIDE
  const RFS   = 454  // RIGHT_FACE_SIDE
  const FORE  = 10
  const CHIN  = 152
  const REU   = 159, REL   = 145, REU2 = 158, REL2 = 153
  const REI   = 133, REO   =  33
  const LEU   = 386, LEL   = 374, LEU2 = 385, LEL2 = 380
  const LEI   = 362, LEO   = 263
  const UL    = 13,  LL    = 14
  const ML    = 78,  MR    = 308

  return makeLandmarks({
    [NOSE]: { x: noseX,       y: noseY,           z: 0 },
    [LFS]:  { x: leftX,       y: cheekDy / 2,     z: 0 },
    [RFS]:  { x: rightX,      y: -cheekDy / 2,    z: 0 },
    [FORE]: { x: 0,           y: topY,             z: 0 },
    [CHIN]: { x: 0,           y: botY,             z: 0 },
    // Right eye
    [REU]:  { x: 0.20, y: eBase.y - vHalf, z: 0 },
    [REL]:  { x: 0.20, y: eBase.y + vHalf, z: 0 },
    [REU2]: { x: 0.15, y: eBase.y - vHalf, z: 0 },
    [REL2]: { x: 0.15, y: eBase.y + vHalf, z: 0 },
    [REI]:  { x: 0.40, y: eBase.y, z: 0 },
    [REO]:  { x: 0.00, y: eBase.y, z: 0 },
    // Left eye (mirror)
    [LEU]:  { x: 0.80, y: eBase.y - vHalf, z: 0 },
    [LEL]:  { x: 0.80, y: eBase.y + vHalf, z: 0 },
    [LEU2]: { x: 0.85, y: eBase.y - vHalf, z: 0 },
    [LEL2]: { x: 0.85, y: eBase.y + vHalf, z: 0 },
    [LEI]:  { x: 0.60, y: eBase.y, z: 0 },
    [LEO]:  { x: 1.00, y: eBase.y, z: 0 },
    // Mouth
    [UL]: { x: 0.5, y: 0.8 - mHalf, z: 0 },
    [LL]: { x: 0.5, y: 0.8 + mHalf, z: 0 },
    [ML]: { x: 0.0, y: 0.8,         z: 0 },
    [MR]: { x: 1.0, y: 0.8,         z: 0 },
  })
}

// Shorthand for running engine._updateHeadPoseDwellStreaks N times at a fixed pose.
function dwellFrames(engine, yaw, pitch, n = 1) {
  const T = engine._thresholds
  for (let i = 0; i < n; i++) engine._updateHeadPoseDwellStreaks(yaw, pitch, T)
}

// ─── 1. _shouldDeactivate ─────────────────────────────────────────────────────

describe('GestureEngine._shouldDeactivate', () => {
  let engine
  beforeEach(() => { engine = makeEngine() })

  // Using DEFAULT_THRESHOLDS: yaw=22, pitch=13, roll=15, hysteresis=4, hysteresisYaw=7, hysteresisPitch=7
  // Deactivation zone = fire_threshold − hysteresis:
  //   HEAD_LEFT/RIGHT: |yaw| < 15°
  //   HEAD_UP/DOWN:    |pitch| < 6°
  //   TILT_LEFT/RIGHT: |roll| < 11°

  // ── HEAD_LEFT ─────────────────────────────────────────────────────────────

  it('HEAD_LEFT: deactivates when yaw returns above -(threshold - hysteresis)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -10, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_LEFT: stays active when yaw is still clearly past threshold', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -20, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('HEAD_LEFT: deactivates exactly at the hysteresis boundary (inclusive)', () => {
    // boundary = -(22-7) = -15; yaw = -15 → -15 >= -15 → true
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -15, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_LEFT: stays active just past boundary (-15.1)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -15.1, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  // ── HEAD_RIGHT ────────────────────────────────────────────────────────────

  it('HEAD_RIGHT: deactivates when yaw drops back below threshold', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_RIGHT, 10, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_RIGHT: stays active far past threshold', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_RIGHT, 20, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('HEAD_RIGHT: deactivates exactly at the hysteresis boundary', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_RIGHT, 15, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_RIGHT: stays active just above boundary (15.1)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_RIGHT, 15.1, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  // ── HEAD_UP ───────────────────────────────────────────────────────────────

  it('HEAD_UP: deactivates when pitch drops back to neutral', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_UP, 0, 5, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_UP: stays active when pitch is still above the exit zone', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_UP, 0, 10, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('HEAD_UP: deactivates exactly at boundary (pTh - hPitch = 6)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_UP, 0, 6, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_UP: stays active just above boundary (6.1°)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_UP, 0, 6.1, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  // ── HEAD_DOWN ─────────────────────────────────────────────────────────────

  it('HEAD_DOWN: deactivates when pitch returns near neutral', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_DOWN, 0, -5, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_DOWN: stays active when pitch is still below the exit zone', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_DOWN, 0, -10, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('HEAD_DOWN: deactivates exactly at boundary (-(pTh - hPitch) = -6)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_DOWN, 0, -6, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('HEAD_DOWN: stays active just below boundary (-6.1)', () => {
    expect(engine._shouldDeactivate(GESTURES.HEAD_DOWN, 0, -6.1, 0, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  // ── TILT_LEFT ─────────────────────────────────────────────────────────────

  it('TILT_LEFT: deactivates when roll returns near neutral', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_LEFT, 0, 0, -5, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('TILT_LEFT: stays active when roll is clearly negative', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_LEFT, 0, 0, -15, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('TILT_LEFT: deactivates exactly at boundary (-(roll - hysteresis) = -11)', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_LEFT, 0, 0, -11, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  // ── TILT_RIGHT ────────────────────────────────────────────────────────────

  it('TILT_RIGHT: deactivates when roll returns near neutral', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_RIGHT, 0, 0, 5, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('TILT_RIGHT: stays active when roll is clearly positive', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_RIGHT, 0, 0, 15, 0, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('TILT_RIGHT: deactivates exactly at boundary (+11)', () => {
    expect(engine._shouldDeactivate(GESTURES.TILT_RIGHT, 0, 0, 11, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  // ── MOUTH_OPEN ────────────────────────────────────────────────────────────

  it('MOUTH_OPEN: deactivates when mouth closes below 80% of threshold', () => {
    // 0.55 * 0.8 = 0.44
    expect(engine._shouldDeactivate(GESTURES.MOUTH_OPEN, 0, 0, 0, 0.3, DEFAULT_THRESHOLDS)).toBe(true)
  })

  it('MOUTH_OPEN: stays active when mouth is still open above 80% threshold', () => {
    expect(engine._shouldDeactivate(GESTURES.MOUTH_OPEN, 0, 0, 0, 0.5, DEFAULT_THRESHOLDS)).toBe(false)
  })

  it('MOUTH_OPEN: deactivates at exactly 80% of threshold', () => {
    expect(engine._shouldDeactivate(GESTURES.MOUTH_OPEN, 0, 0, 0, 0.44, DEFAULT_THRESHOLDS)).toBe(true)
  })

  // ── unknown gesture ────────────────────────────────────────────────────────

  it('deactivates immediately for unknown gesture (default branch)', () => {
    expect(engine._shouldDeactivate('UNKNOWN_GESTURE', 0, 0, 0, 0, DEFAULT_THRESHOLDS)).toBe(true)
  })

  // ── custom thresholds ─────────────────────────────────────────────────────

  it('respects custom hysteresis values', () => {
    const T = { yaw: 30, pitch: 20, roll: 20, hysteresis: 5, hysteresisYaw: 10, hysteresisPitch: 10 }
    // HEAD_LEFT deactivates at yaw >= -(30-10) = -20
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -15, 0, 0, 0, T)).toBe(true)  // -15 > -20 ✓
    expect(engine._shouldDeactivate(GESTURES.HEAD_LEFT, -25, 0, 0, 0, T)).toBe(false) // -25 < -20 ✓
  })

})

// ─── 2. _detect ───────────────────────────────────────────────────────────────

describe('GestureEngine._detect', () => {
  let engine
  const T  = DEFAULT_THRESHOLDS
  const dY = 4   // dwellYaw
  const dP = 3   // dwellPitch (HEAD_POSE_DWELL_FRAMES_PITCH)

  beforeEach(() => {
    engine = makeEngine()
    // Pre-set dwell counters so detection fires on the first call.
    engine._dwellYawLeft   = dY
    engine._dwellYawRight  = dY
    engine._dwellPitchUp   = dP
    engine._dwellPitchDown = 2  // HEAD_POSE_DWELL_FRAMES_PITCH_DOWN
  })

  // ── head-up ───────────────────────────────────────────────────────────────

  it('detects HEAD_UP when pitch > threshold and dwell is satisfied', () => {
    expect(engine._detect(0, 15, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_UP)
  })

  it('does not detect HEAD_UP when pitch is below threshold', () => {
    expect(engine._detect(0, 10, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does not detect HEAD_UP when dwell is insufficient', () => {
    engine._dwellPitchUp = dP - 1
    expect(engine._detect(0, 15, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does not detect HEAD_UP when yaw dominates (absPitch + 4 < absYaw)', () => {
    // pitch=14 (>13), yaw=30: absPitch+4=18 < absYaw=30 → disambiguated as HEAD_RIGHT
    expect(engine._detect(30, 14, 0, 0, T, dY, dP)).not.toBe(GESTURES.HEAD_UP)
  })

  // ── head-down ─────────────────────────────────────────────────────────────

  it('detects HEAD_DOWN when pitch < -threshold and dwell is satisfied', () => {
    expect(engine._detect(0, -15, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_DOWN)
  })

  it('does not detect HEAD_DOWN when pitch is above -threshold', () => {
    expect(engine._detect(0, -10, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does not detect HEAD_DOWN when dwell is insufficient', () => {
    engine._dwellPitchDown = 1   // < HEAD_POSE_DWELL_FRAMES_PITCH_DOWN=2
    expect(engine._detect(0, -15, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does not detect HEAD_DOWN when yaw dominates (absPitch + 6 < absYaw)', () => {
    // pitch=-14 (<-13), yaw=-25: absPitch+6=20 < absYaw=25 → no HEAD_DOWN
    expect(engine._detect(-25, -14, 0, 0, T, dY, dP)).not.toBe(GESTURES.HEAD_DOWN)
  })

  // ── head-left ─────────────────────────────────────────────────────────────

  it('detects HEAD_LEFT when yaw < -threshold and dwell satisfied', () => {
    expect(engine._detect(-25, 0, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_LEFT)
  })

  it('does not detect HEAD_LEFT below threshold', () => {
    expect(engine._detect(-20, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does not detect HEAD_LEFT with insufficient yaw dwell', () => {
    engine._dwellYawLeft = dY - 1
    expect(engine._detect(-25, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  // ── head-right ────────────────────────────────────────────────────────────

  it('detects HEAD_RIGHT when yaw > threshold and dwell satisfied', () => {
    expect(engine._detect(25, 0, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_RIGHT)
  })

  it('does not detect HEAD_RIGHT below threshold', () => {
    expect(engine._detect(20, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  // ── tilt (no dwell requirement) ───────────────────────────────────────────

  it('detects TILT_LEFT immediately (no dwell) when roll < -threshold', () => {
    engine._dwellYawLeft = engine._dwellYawRight = 0  // zero dwell
    expect(engine._detect(0, 0, -20, 0, T, dY, dP)).toBe(GESTURES.TILT_LEFT)
  })

  it('detects TILT_RIGHT immediately (no dwell) when roll > threshold', () => {
    expect(engine._detect(0, 0, 20, 0, T, dY, dP)).toBe(GESTURES.TILT_RIGHT)
  })

  it('does not detect TILT_LEFT when roll is above -threshold', () => {
    expect(engine._detect(0, 0, -10, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  // ── mouth ─────────────────────────────────────────────────────────────────

  it('detects MOUTH_OPEN immediately (no dwell) when mouth > threshold', () => {
    expect(engine._detect(0, 0, 0, 0.6, T, dY, dP)).toBe(GESTURES.MOUTH_OPEN)
  })

  it('does not detect MOUTH_OPEN below threshold', () => {
    expect(engine._detect(0, 0, 0, 0.5, T, dY, dP)).toBe(GESTURES.NONE)
  })

  // ── priority / disambiguation ─────────────────────────────────────────────

  it('prioritises HEAD_UP over HEAD_RIGHT when pitch dominates', () => {
    // pitch=15, yaw=16: absPitch+4=19 >= absYaw=16 → HEAD_UP wins
    expect(engine._detect(16, 15, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_UP)
  })

  it('prioritises HEAD_RIGHT when yaw clearly dominates over pitch', () => {
    // pitch=14 (crosses threshold), yaw=25: absPitch+4=18 < absYaw=25 → HEAD_RIGHT
    const result = engine._detect(25, 14, 0, 0, T, dY, dP)
    expect(result).toBe(GESTURES.HEAD_RIGHT)
  })

  it('returns NONE when all signals are below threshold', () => {
    engine._dwellPitchUp = engine._dwellPitchDown = engine._dwellYawLeft = engine._dwellYawRight = 0
    expect(engine._detect(0, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  // ── strict threshold boundary (all gestures use > / <, never >=) ───────────

  it('does NOT fire HEAD_UP when pitch is exactly at threshold (strict >)', () => {
    // pitch=13 is NOT > 13 → NONE
    expect(engine._detect(0, 13, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('fires HEAD_UP when pitch is one epsilon above threshold', () => {
    expect(engine._detect(0, 13.001, 0, 0, T, dY, dP)).toBe(GESTURES.HEAD_UP)
  })

  it('does NOT fire HEAD_DOWN when pitch is exactly at -threshold', () => {
    expect(engine._detect(0, -13, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does NOT fire HEAD_LEFT when yaw is exactly at -threshold', () => {
    expect(engine._detect(-22, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does NOT fire HEAD_RIGHT when yaw is exactly at threshold', () => {
    expect(engine._detect(22, 0, 0, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does NOT fire TILT_LEFT when roll equals -threshold (strict <)', () => {
    // roll=-15 is NOT < -15 → NONE
    expect(engine._detect(0, 0, -15, 0, T, dY, dP)).toBe(GESTURES.NONE)
  })

  it('does NOT fire MOUTH_OPEN when ratio equals threshold (strict >)', () => {
    // mouth=0.55 is NOT > 0.55 → NONE
    expect(engine._detect(0, 0, 0, 0.55, T, dY, dP)).toBe(GESTURES.NONE)
  })

})

// ─── 3. _updateHeadPoseDwellStreaks ───────────────────────────────────────────

describe('GestureEngine._updateHeadPoseDwellStreaks', () => {
  let engine
  beforeEach(() => { engine = makeEngine() })

  const T = DEFAULT_THRESHOLDS  // yaw=22, pitch=13 → pThDown = 11

  it('increments dwellYawRight and resets dwellYawLeft when yaw > threshold', () => {
    engine._updateHeadPoseDwellStreaks(25, 0, T)
    expect(engine._dwellYawRight).toBe(1)
    expect(engine._dwellYawLeft).toBe(0)
  })

  it('increments dwellYawLeft and resets dwellYawRight when yaw < -threshold', () => {
    engine._updateHeadPoseDwellStreaks(-25, 0, T)
    expect(engine._dwellYawLeft).toBe(1)
    expect(engine._dwellYawRight).toBe(0)
  })

  it('resets dwellYawRight when yaw drops back below threshold', () => {
    engine._updateHeadPoseDwellStreaks(25, 0, T)
    engine._updateHeadPoseDwellStreaks(20, 0, T)  // below threshold
    expect(engine._dwellYawRight).toBe(0)
  })

  it('accumulates yaw dwell across consecutive frames', () => {
    dwellFrames(engine, 25, 0, 4)
    expect(engine._dwellYawRight).toBe(4)
  })

  it('increments dwellPitchUp when pitch > threshold', () => {
    engine._updateHeadPoseDwellStreaks(0, 15, T)
    expect(engine._dwellPitchUp).toBe(1)
  })

  it('resets dwellPitchUp when pitch drops', () => {
    dwellFrames(engine, 0, 15, 3)
    engine._updateHeadPoseDwellStreaks(0, 5, T)
    expect(engine._dwellPitchUp).toBe(0)
  })

  // ── HEAD_DOWN pre-warm zone ────────────────────────────────────────────────
  // pTh = 13, pThDown = 11 → pre-warm starts at pitch < -11°, fires at pitch < -13°

  it('increments dwellPitchDown when pitch is in the pre-warm zone (pTh-2 < |pitch| < pTh)', () => {
    engine._updateHeadPoseDwellStreaks(0, -12, T)  // -12 < -11 → pre-warm zone
    expect(engine._dwellPitchDown).toBe(1)
  })

  it('increments dwellPitchDown when pitch exceeds the fire threshold', () => {
    engine._updateHeadPoseDwellStreaks(0, -15, T)
    expect(engine._dwellPitchDown).toBe(1)
  })

  it('decays dwellPitchDown by 1 when pitch is between 0 and the pre-warm threshold', () => {
    engine._dwellPitchDown = 3
    engine._updateHeadPoseDwellStreaks(0, -8, T)  // -8 > -11 → not in pre-warm → decay
    expect(engine._dwellPitchDown).toBe(2)
  })

  it('clamps dwellPitchDown decay at 0 (never negative)', () => {
    engine._dwellPitchDown = 0
    engine._updateHeadPoseDwellStreaks(0, 0, T)  // neutral → decay path
    expect(engine._dwellPitchDown).toBe(0)
  })

  it('single noisy frame (gap in pre-warm) only decays by 1, not to 0', () => {
    dwellFrames(engine, 0, -12, 3)        // 3 frames in pre-warm → dwell = 3
    engine._updateHeadPoseDwellStreaks(0, -8, T) // one noisy frame → dwell = 2
    expect(engine._dwellPitchDown).toBe(2)
  })

  it('accumulates dwellPitchDown across multiple pre-warm frames', () => {
    dwellFrames(engine, 0, -12, 5)
    expect(engine._dwellPitchDown).toBe(5)
  })

  it('pre-warm + fire-threshold frames both count as accumulation', () => {
    engine._updateHeadPoseDwellStreaks(0, -12, T)  // pre-warm
    engine._updateHeadPoseDwellStreaks(0, -15, T)  // fire zone
    expect(engine._dwellPitchDown).toBe(2)
  })

})

// ─── 4. _processBlinkFrame — 3-zone state machine ─────────────────────────────

describe('GestureEngine._processBlinkFrame', () => {
  let engine
  let commands

  // Personal calibration that produces minClosed=9 (noiseFloor < 0.012)
  const personalCal = {
    threshold:     0.20,
    exitThreshold: 0.30,
    noiseFloor:    0.005,
    earOpen:       0.35,
    earClosed:     0.12,
    range:         0.23,
    signalType:    'ear',
    calibratedAt:  Date.now(),
  }

  beforeEach(() => {
    commands = []
    engine = makeEngine({
      onCommand: (cmd, gesture) => commands.push({ cmd, gesture }),
    })
    engine._blinkCalibration    = { ...personalCal }
    engine._blinkFallbackWarned = true  // suppress console.warn
  })

  // ── CLOSED zone ───────────────────────────────────────────────────────────

  it('increments closedStreak when signal is in the CLOSED zone', () => {
    engine._processBlinkFrame(0.10, {}, false)
    expect(engine._closedStreak).toBe(1)
  })

  it('increments closedStreak on each consecutive closed frame', () => {
    for (let i = 0; i < 5; i++) engine._processBlinkFrame(0.10, {}, false)
    expect(engine._closedStreak).toBe(5)
  })

  it('resets deadZoneFrames to 0 when entering CLOSED zone', () => {
    engine._deadZoneFrames = 3
    engine._processBlinkFrame(0.10, {}, false)
    expect(engine._deadZoneFrames).toBe(0)
  })

  // ── OPEN zone — fire condition ─────────────────────────────────────────────

  it('fires EYES_CLOSED after exactly minClosed (9) frames below threshold', () => {
    for (let i = 0; i < 9; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)  // OPEN
    expect(commands).toHaveLength(1)
    expect(commands[0].gesture).toBe(GESTURES.EYES_CLOSED)
  })

  it('does NOT fire when streak is below minClosed (8 frames)', () => {
    for (let i = 0; i < 8; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(0)
  })

  it('does NOT fire when streak exceeds maxClosed (35 frames = ~1.2 s)', () => {
    for (let i = 0; i < 36; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(0)
  })

  it('fires at exactly maxClosed (35 frames) — the last valid frame', () => {
    for (let i = 0; i < 35; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(1)
  })

  it('resets closedStreak and deadZoneFrames after OPEN zone', () => {
    for (let i = 0; i < 9; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)  // OPEN
    expect(engine._closedStreak).toBe(0)
    expect(engine._deadZoneFrames).toBe(0)
  })

  it('does NOT fire when signal is just below exitThreshold (still in DEAD zone)', () => {
    for (let i = 0; i < 9; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.25, {}, false)  // 0.20 < 0.25 < 0.30 → DEAD zone
    expect(commands).toHaveLength(0)
  })

  // ── DEAD zone ─────────────────────────────────────────────────────────────
  //   Signal in (threshold, exitThreshold) = (0.20, 0.30)
  //   DEAD_ZONE_DECAY_FRAMES = 4

  it('holds closedStreak during dead-zone frames', () => {
    engine._closedStreak = 5
    engine._processBlinkFrame(0.25, {}, false)  // dead zone
    expect(engine._closedStreak).toBe(5)         // unchanged
  })

  it('increments deadZoneFrames in the dead zone', () => {
    engine._processBlinkFrame(0.25, {}, false)
    expect(engine._deadZoneFrames).toBe(1)
  })

  it('halves closedStreak after DEAD_ZONE_DECAY_FRAMES (4) consecutive dead frames', () => {
    engine._closedStreak = 10
    for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)
    // After 4 dead-zone frames: streak = floor(10/2) = 5
    expect(engine._closedStreak).toBe(5)
    expect(engine._deadZoneFrames).toBe(0)  // reset after decay event
  })

  it('decay fires again after another 4 dead-zone frames', () => {
    engine._closedStreak = 20
    for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)  // → 10
    for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)  // → 5
    expect(engine._closedStreak).toBe(5)
  })

  it('dead-zone followed by OPEN does not fire if streak fell below minClosed', () => {
    // streak starts at 6, dead-zone decays it to 3 (< minClosed=9)
    engine._closedStreak = 6
    for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)  // decay → 3
    engine._processBlinkFrame(0.35, {}, false)  // OPEN — streak=3 < 9 → no fire
    expect(commands).toHaveLength(0)
  })

  // ── exact threshold / exit-threshold boundaries ───────────────────────────

  it('signal exactly at threshold lands in DEAD zone (not CLOSED, no streak increment)', () => {
    // threshold=0.20: signal < threshold is CLOSED; signal == threshold is NOT CLOSED → DEAD
    engine._processBlinkFrame(0.20, {}, false)
    expect(engine._closedStreak).toBe(0)         // not incremented
    expect(engine._deadZoneFrames).toBe(1)        // DEAD zone counter incremented
  })

  it('signal exactly at exitThreshold lands in DEAD zone (not OPEN, no fire)', () => {
    // exitThreshold=0.30: signal > exitThreshold is OPEN; signal == exitThreshold is NOT OPEN
    engine._closedStreak = 9   // would fire if signal crossed into OPEN
    engine._processBlinkFrame(0.30, {}, false)
    expect(commands).toHaveLength(0)              // no fire
    expect(engine._closedStreak).toBe(9)          // held in DEAD zone
    expect(engine._deadZoneFrames).toBe(1)
  })

  // ── two consecutive complete blink sequences ───────────────────────────────

  it('fires twice for two complete blink sequences (cooldown=0)', () => {
    // First blink
    for (let i = 0; i < 9; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(1)
    expect(engine._closedStreak).toBe(0)   // reset after fire

    // Second blink immediately after
    for (let i = 0; i < 9; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(2)
  })

  // ── CLOSED ↔ DEAD oscillation without OPEN ────────────────────────────────

  it('oscillating between CLOSED and DEAD zones decays streak every 4 dead frames', () => {
    // 5 frames CLOSED → streak=5
    for (let i = 0; i < 5; i++) engine._processBlinkFrame(0.10, {}, false)
    expect(engine._closedStreak).toBe(5)

    // 4 frames DEAD → decay: streak = floor(5/2) = 2, deadZoneFrames reset
    for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)
    expect(engine._closedStreak).toBe(2)
    expect(engine._deadZoneFrames).toBe(0)

    // Back to CLOSED: streak increments from 2
    engine._processBlinkFrame(0.10, {}, false)
    expect(engine._closedStreak).toBe(3)
  })

  it('streak eventually reaches 0 with repeated DEAD-zone decay cycles', () => {
    engine._closedStreak = 8
    // Each 4-frame DEAD cycle halves: 8→4→2→1→0
    for (let cycle = 0; cycle < 4; cycle++) {
      for (let i = 0; i < 4; i++) engine._processBlinkFrame(0.25, {}, false)
    }
    expect(engine._closedStreak).toBe(0)
    // Reaching OPEN after full decay → no fire
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(0)
  })

  // ── minClosed with noisy calibration ──────────────────────────────────────

  it('uses minClosed=11 when noiseFloor >= 0.012 (noisier eye)', () => {
    engine._blinkCalibration = { ...personalCal, noiseFloor: 0.015 }
    for (let i = 0; i < 10; i++) engine._processBlinkFrame(0.10, {}, false) // 10 < 11
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(0)

    // Reset and try with 11 frames
    engine._closedStreak = 0; commands.length = 0
    for (let i = 0; i < 11; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.35, {}, false)
    expect(commands).toHaveLength(1)
  })

  // ── fallback calibration (no personal data) ───────────────────────────────

  it('uses fallback minClosed=13 when no personal calibration', () => {
    engine._blinkCalibration = null
    engine._blinkFallbackWarned = true

    // 12 frames — should NOT fire
    for (let i = 0; i < 12; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.20, {}, false)  // OPEN (above FALLBACK_BLINK_EXIT=0.18)
    expect(commands).toHaveLength(0)

    // 13 frames — should fire
    engine._closedStreak = 0; commands.length = 0
    for (let i = 0; i < 13; i++) engine._processBlinkFrame(0.10, {}, false)
    engine._processBlinkFrame(0.20, {}, false)
    expect(commands).toHaveLength(1)
  })

})

// ─── 5. Auto-EAR calibration EMA ─────────────────────────────────────────────

describe('GestureEngine auto-EAR calibration', () => {
  let engine
  beforeEach(() => {
    engine = makeEngine()
    engine._blinkCalibration    = null  // no personal calibration
    engine._blinkFallbackWarned = true  // suppress warn
  })

  it('seeds EMA directly from the first open-eye frame (no blend-from-zero)', () => {
    engine._processBlinkFrame(0.30, {}, false)
    expect(engine._earEmaOpen).toBeCloseTo(0.30, 5)
    expect(engine._earEmaFrames).toBe(1)
  })

  it('applies EMA on subsequent frames (alpha = 0.04)', () => {
    engine._processBlinkFrame(0.30, {}, false)  // seed
    engine._processBlinkFrame(0.40, {}, false)  // EMA: 0.04*0.40 + 0.96*0.30 = 0.304
    expect(engine._earEmaOpen).toBeCloseTo(0.04 * 0.40 + 0.96 * 0.30, 5)
  })

  it('does not update EMA during closed-eye frames', () => {
    engine._processBlinkFrame(0.30, {}, false)  // seed
    engine._closedStreak = 1
    const before = engine._earEmaOpen
    engine._processBlinkFrame(0.10, {}, false)  // closed frame — skip EMA
    expect(engine._earEmaOpen).toBe(before)
  })

  it('does not update EMA when signal is below noise floor (0.09)', () => {
    engine._processBlinkFrame(0.08, {}, false)  // below noise floor
    expect(engine._earEmaFrames).toBe(0)        // no frame counted
  })

  it('does not set dynamicEarThreshold before warmup (12 frames)', () => {
    for (let i = 0; i < 11; i++) engine._processBlinkFrame(0.30, {}, false)
    expect(engine._dynamicEarThreshold).toBeNull()
  })

  it('sets dynamicEarThreshold after DYNAMIC_EAR_WARMUP_FRAMES (12) with EMA >= 0.12', () => {
    for (let i = 0; i < 12; i++) engine._processBlinkFrame(0.30, {}, false)
    // EMA stays near 0.30 (constant input): threshold = max(0.08, 0.30*0.65) = 0.195
    expect(engine._dynamicEarThreshold).not.toBeNull()
    expect(engine._dynamicEarThreshold).toBeCloseTo(0.30 * 0.65, 2)
    expect(engine._dynamicEarExit).toBeCloseTo(0.30 * 0.82, 2)
  })

  it('does not set dynamicEarThreshold if EMA stays below 0.12 (unreliable signal)', () => {
    for (let i = 0; i < 12; i++) engine._processBlinkFrame(0.10, {}, false)
    expect(engine._dynamicEarThreshold).toBeNull()
  })

  it('clamps dynamicEarThreshold to minimum 0.08 when ema * 0.65 would fall below it', () => {
    // Signal=0.25 lands in the OPEN zone (> FALLBACK_BLINK_EXIT=0.18), so
    // _closedStreak stays 0 and the EMA block executes on every frame.
    // Starting EMA at 0.120 and one more frame of 0.25:
    //   ema = 0.04*0.25 + 0.96*0.120 = 0.1252
    //   threshold = max(0.08, 0.1252*0.65) = max(0.08, 0.0814) = 0.0814 ≥ 0.08 ✓
    engine._earEmaOpen   = 0.120
    engine._earEmaFrames = 11
    engine._processBlinkFrame(0.25, {}, false)
    expect(engine._dynamicEarThreshold).not.toBeNull()
    expect(engine._dynamicEarThreshold).toBeGreaterThanOrEqual(0.08)
  })

  it('does not update EMA when using iris signal (useIrisScale=true)', () => {
    engine._processBlinkFrame(0.07, {}, true)   // iris signal
    expect(engine._earEmaFrames).toBe(0)
  })

})

// ─── 6. setNeutralPose / baselines ───────────────────────────────────────────

describe('GestureEngine.setNeutralPose', () => {
  let engine
  beforeEach(() => { engine = makeEngine() })

  it('sets yaw, pitch and roll baselines', () => {
    engine.setNeutralPose({ yawBaseline: 5, pitchBaseline: -3, rollBaseline: 2 })
    expect(engine._yawBaseline).toBeCloseTo(5)
    expect(engine._pitchBaseline).toBeCloseTo(-3)
    expect(engine._rollBaseline).toBeCloseTo(2)
  })

  it('defaults rollBaseline to 0 when omitted', () => {
    engine.setNeutralPose({ yawBaseline: 5, pitchBaseline: -3 })
    expect(engine._rollBaseline).toBe(0)
  })

  it('ignores NaN values (leaves existing baseline intact)', () => {
    engine._yawBaseline = 10
    engine.setNeutralPose({ yawBaseline: NaN, pitchBaseline: 0 })
    expect(engine._yawBaseline).toBe(10)  // unchanged
  })

  it('ignores Infinity values', () => {
    engine._pitchBaseline = -5
    engine.setNeutralPose({ yawBaseline: 0, pitchBaseline: Infinity })
    expect(engine._pitchBaseline).toBe(-5)  // unchanged
  })

  it('subtracts baselines from raw pose in processFrame', () => {
    const commands = []
    engine = makeEngine({ onCommand: (cmd, g) => commands.push(g) })
    // Set baseline so that a raw pitch of 16 becomes 16-5=11 (< threshold 13) → no HEAD_UP
    engine.setNeutralPose({ yawBaseline: 0, pitchBaseline: 5 })

    // Pre-warm pitch dwell
    dwellFrames(engine, 0, 11, 5)  // after baseline subtraction, pitch = 11 < 13 → no dwell ✓

    const lm = makeFaceLandmarks({ pitch: 16 })  // raw 16 → adjusted 11
    engine.processFrame(lm)
    expect(commands).not.toContain(GESTURES.HEAD_UP)
  })

})

// ─── 7. processFrame integration ─────────────────────────────────────────────

describe('GestureEngine.processFrame integration', () => {
  let engine, commands, metrics

  beforeEach(() => {
    commands = []
    metrics  = []
    engine = makeEngine({
      onCommand: (cmd, gesture) => commands.push({ cmd, gesture }),
      onMetrics:  (m) => metrics.push(m),
    })
    engine._blinkCalibration    = null
    engine._blinkFallbackWarned = true
  })

  it('calls onMetrics on every frame', () => {
    engine.processFrame(makeFaceLandmarks())
    expect(metrics).toHaveLength(1)
  })

  it('emits metric fields: yaw, pitch, roll, mouth', () => {
    engine.processFrame(makeFaceLandmarks({ yaw: 10, pitch: 5 }))
    const m = metrics[0]
    expect(m).toHaveProperty('yaw')
    expect(m).toHaveProperty('pitch')
    expect(m).toHaveProperty('roll')
    expect(m).toHaveProperty('mouth')
  })

  it('emits ear:undefined when landmarks produce null EAR', () => {
    // All zeros → computeEAR returns null → ear: undefined
    engine.processFrame(makeLandmarks())
    expect(metrics[0].ear).toBeUndefined()
  })

  it('does not fire any command when blocked', () => {
    engine.updateSettings({ blocked: true })
    engine.processFrame(makeFaceLandmarks({ yaw: 30, pitch: 20 }))
    expect(commands).toHaveLength(0)
  })

  it('does not fire command in wizardCaptureOnly mode', () => {
    engine.startCalibrationWizard('full')
    for (let i = 0; i < 10; i++) {
      engine.processFrame(makeFaceLandmarks({ yaw: 30 }))
    }
    expect(commands).toHaveLength(0)
  })

  it('does nothing after destroy()', () => {
    engine.destroy()
    engine.processFrame(makeFaceLandmarks({ yaw: 30 }))
    expect(commands).toHaveLength(0)
    expect(metrics).toHaveLength(0)
  })

  it('fires HEAD_RIGHT after sustained yaw above threshold', () => {
    // Need 4 dwell frames, cooldown=0
    const lm = makeFaceLandmarks({ yaw: 25 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    const fired = commands.some(c => c.gesture === GESTURES.HEAD_RIGHT)
    expect(fired).toBe(true)
  })

  it('fires HEAD_LEFT after sustained yaw below -threshold', () => {
    const lm = makeFaceLandmarks({ yaw: -25 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    expect(commands.some(c => c.gesture === GESTURES.HEAD_LEFT)).toBe(true)
  })

  it('fires HEAD_UP after sustained pitch above threshold', () => {
    const lm = makeFaceLandmarks({ pitch: 16 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    expect(commands.some(c => c.gesture === GESTURES.HEAD_UP)).toBe(true)
  })

  it('fires HEAD_DOWN after sustained pitch below -threshold', () => {
    const lm = makeFaceLandmarks({ pitch: -16 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    expect(commands.some(c => c.gesture === GESTURES.HEAD_DOWN)).toBe(true)
  })

  it('fires the command mapped in gestureMap, not the raw gesture', () => {
    const lm = makeFaceLandmarks({ yaw: 25 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    const head_right_cmd = commands.find(c => c.gesture === GESTURES.HEAD_RIGHT)?.cmd
    expect(head_right_cmd).toBe(PLAYER_GESTURE_MAP[GESTURES.HEAD_RIGHT])
  })

  it('does not fire when gesture is mapped to COMMANDS.NONE', () => {
    engine.updateSettings({
      gestureMap: { ...PLAYER_GESTURE_MAP, [GESTURES.HEAD_RIGHT]: COMMANDS.NONE },
    })
    const lm = makeFaceLandmarks({ yaw: 25 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    expect(commands.some(c => c.gesture === GESTURES.HEAD_RIGHT)).toBe(false)
  })

  it('suppresses eye-close detection while head is in motion', () => {
    // Large yaw blocks blink detection via headPoseBlocksEyes
    const lm = makeFaceLandmarks({ yaw: 20, ear: 0.05 })
    for (let i = 0; i < 20; i++) engine.processFrame(lm)
    expect(commands.some(c => c.gesture === GESTURES.EYES_CLOSED)).toBe(false)
  })

})

// ─── 8. destroy() ─────────────────────────────────────────────────────────────

describe('GestureEngine.destroy()', () => {
  it('sets _destroyed flag', () => {
    const e = makeEngine()
    e.destroy()
    expect(e._destroyed).toBe(true)
  })

  it('is idempotent — calling destroy() twice does not throw', () => {
    const e = makeEngine()
    expect(() => { e.destroy(); e.destroy() }).not.toThrow()
  })

  it('nullifies callbacks to prevent memory leaks', () => {
    const e = makeEngine({ onCommand: vi.fn(), onMetrics: vi.fn() })
    e.destroy()
    expect(e._onCommand).toBeNull()
    expect(e._onMetrics).toBeNull()
  })

  it('resets all streak / dwell counters', () => {
    const e = makeEngine()
    e._closedStreak = 5
    e._dwellYawLeft = 3
    e.destroy()
    expect(e._closedStreak).toBe(0)
    expect(e._dwellYawLeft).toBe(0)
  })

  it('processFrame is a no-op after destroy', () => {
    const onMetrics = vi.fn()
    const e = makeEngine({ onMetrics })
    e.destroy()
    e.processFrame(makeFaceLandmarks())
    expect(onMetrics).not.toHaveBeenCalled()
  })

  it('destroy() on a fresh engine (zero processFrame calls) does not throw', () => {
    const e = makeEngine()
    expect(() => e.destroy()).not.toThrow()
    expect(e._destroyed).toBe(true)
  })

})

// ─── 9. adjustBlinkThreshold clamping ────────────────────────────────────────

describe('GestureEngine.adjustBlinkThreshold', () => {
  const calWithRange = {
    threshold:     0.20,
    exitThreshold: 0.30,
    earClosed:     0.12,
    earOpen:       0.35,
    range:         0.23,
    noiseFloor:    0.005,
    signalType:    'ear',
    calibratedAt:  Date.now(),
  }
  let engine

  beforeEach(() => {
    engine = makeEngine()
    engine._blinkCalibration = { ...calWithRange }
  })

  it('clamps threshold to minimum 0.012 when delta pushes it far below', () => {
    engine.adjustBlinkThreshold(-100)   // 0.20 - 100 = -99.8 → clamped to 0.012
    expect(engine._blinkCalibration.threshold).toBeCloseTo(0.012, 5)
  })

  it('clamps threshold to maximum 0.5 when delta pushes it far above', () => {
    engine.adjustBlinkThreshold(100)    // 0.20 + 100 = 100.2 → clamped to 0.5
    expect(engine._blinkCalibration.threshold).toBeCloseTo(0.5, 5)
  })

  it('applies a small negative delta without clamping', () => {
    engine.adjustBlinkThreshold(-0.02)  // 0.20 - 0.02 = 0.18 (within bounds)
    expect(engine._blinkCalibration.threshold).toBeCloseTo(0.18, 4)
  })

  it('does nothing when _blinkCalibration has no range property', () => {
    engine._blinkCalibration = { threshold: 0.20 }  // range is undefined / falsy
    engine.adjustBlinkThreshold(-0.05)
    expect(engine._blinkCalibration.threshold).toBeCloseTo(0.20, 5)  // unchanged
  })

  it('does nothing after destroy()', () => {
    engine.destroy()
    engine._blinkCalibration = { ...calWithRange }  // re-attach (post-destroy)
    engine.adjustBlinkThreshold(-0.05)
    // _destroyed=true → function returns early → threshold unchanged
    expect(engine._blinkCalibration.threshold).toBeCloseTo(0.20, 5)
  })
})

// ─── 10. setBlinkCalibration signalType validation ───────────────────────────

describe('GestureEngine.setBlinkCalibration', () => {
  // REFINE_LANDMARKS = false (see shared/constants/mediapipe.js)
  // → 'iris' is rejected; 'ear', null, undefined are accepted.
  let engine

  beforeEach(() => { engine = makeEngine() })

  it('rejects signalType="iris" when REFINE_LANDMARKS is false', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration({ signalType: 'iris', threshold: 0.038, exitThreshold: 0.046 })
    expect(engine._blinkCalibration).toBeNull()
  })

  it('accepts signalType="ear"', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration({ signalType: 'ear', threshold: 0.20, exitThreshold: 0.30 })
    expect(engine._blinkCalibration).not.toBeNull()
  })

  it('accepts signalType=null (treated as unset — compatible with EAR mode)', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration({ signalType: null, threshold: 0.20, exitThreshold: 0.30 })
    expect(engine._blinkCalibration).not.toBeNull()
  })

  it('accepts signalType=undefined', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration({ signalType: undefined, threshold: 0.20, exitThreshold: 0.30 })
    expect(engine._blinkCalibration).not.toBeNull()
  })

  it('rejects an unknown signalType string', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration({ signalType: 'depth_camera', threshold: 0.20, exitThreshold: 0.30 })
    expect(engine._blinkCalibration).toBeNull()
  })

  it('rejects null result', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration(null)
    expect(engine._blinkCalibration).toBeNull()
  })

  it('rejects non-object result', () => {
    engine._blinkCalibration = null
    engine.setBlinkCalibration('ear')
    expect(engine._blinkCalibration).toBeNull()
  })
})

// ─── 11. updateSettings — live gestureMap change ─────────────────────────────

describe('GestureEngine.updateSettings — live gestureMap', () => {

  it('gestureMap change takes effect on the next fire', () => {
    const commands = []
    const engine = makeEngine({
      onCommand: (cmd, g) => commands.push({ cmd, g }),
    })
    engine._blinkCalibration    = null
    engine._blinkFallbackWarned = true

    // Fire HEAD_RIGHT once with the default map (SKIP)
    const lm = makeFaceLandmarks({ yaw: 25 })
    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    const firstCmd = commands.find(c => c.g === GESTURES.HEAD_RIGHT)?.cmd
    expect(firstCmd).toBe(PLAYER_GESTURE_MAP[GESTURES.HEAD_RIGHT])  // SKIP

    // Remap HEAD_RIGHT → VOL_UP; reset engine state to allow a fresh fire
    engine.updateSettings({
      gestureMap: { ...PLAYER_GESTURE_MAP, [GESTURES.HEAD_RIGHT]: COMMANDS.VOL_UP },
    })
    engine._active          = GESTURES.NONE
    engine._dwellYawRight   = 0
    engine._cooldowns[GESTURES.HEAD_RIGHT].reset()
    commands.length = 0

    for (let i = 0; i < 5; i++) engine.processFrame(lm)
    const secondCmd = commands.find(c => c.g === GESTURES.HEAD_RIGHT)?.cmd
    expect(secondCmd).toBe(COMMANDS.VOL_UP)
  })

})

// ─── 12. _headPoseNotNeutralForEyes buffer behaviour ─────────────────────────
// EYE_HEAD_HISTORY_LEN = 6, EYE_NEUTRAL_MAX_ABS_YAW = 20, EYE_NEUTRAL_MAX_ABS_PITCH = 16

describe('GestureEngine._headPoseNotNeutralForEyes', () => {

  it('returns false on a fresh engine with an empty history buffer', () => {
    const e = makeEngine()
    expect(e._headPoseNotNeutralForEyes()).toBe(false)
  })

  it('returns true when any buffered yaw exceeds the neutral band', () => {
    const e = makeEngine()
    e._headHistYaw[0]  = 21   // > EYE_NEUTRAL_MAX_ABS_YAW (20)
    e._headHistFull    = true
    expect(e._headPoseNotNeutralForEyes()).toBe(true)
  })

  it('returns true when any buffered pitch exceeds the neutral band', () => {
    const e = makeEngine()
    e._headHistPitch[0] = 17  // > EYE_NEUTRAL_MAX_ABS_PITCH (16)
    e._headHistFull     = true
    expect(e._headPoseNotNeutralForEyes()).toBe(true)
  })

  it('returns false after overwriting all high-motion frames with neutral values', () => {
    const e = makeEngine()
    // Simulate 6 frames of large yaw filling the buffer
    for (let i = 0; i < 6; i++) e._pushHeadPoseHistory(25, 0)
    expect(e._headPoseNotNeutralForEyes()).toBe(true)

    // Overwrite all 6 slots with neutral values (|yaw|≤20, |pitch|≤16)
    for (let i = 0; i < 6; i++) e._pushHeadPoseHistory(0, 0)
    expect(e._headPoseNotNeutralForEyes()).toBe(false)
  })

  it('respects partial buffer (headHistFull=false): only checks filled slots', () => {
    const e = makeEngine()
    // Write a high-yaw value into the FIRST slot, then advance the index once.
    e._pushHeadPoseHistory(25, 0)   // slot 0 → high
    // Overwrite slot 0 with neutral; slot 1 has not been written yet.
    e._headHistYaw[0]   = 0
    e._headHistPitch[0] = 0
    e._headHistIdx      = 1        // only 1 frame "in buffer"
    e._headHistFull     = false
    expect(e._headPoseNotNeutralForEyes()).toBe(false)
  })

})
