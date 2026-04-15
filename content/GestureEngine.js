import { GESTURES } from '../shared/constants/gestures.js'
import { COMMANDS } from '../shared/constants/commands.js'
import { MSG } from '../shared/constants/messages.js'
import {
  DEFAULT_GESTURE_MAP,
  DEFAULT_COOLDOWNS,
  DEFAULT_THRESHOLDS,
} from '../shared/constants/defaults.js'
import { Cooldown } from '../shared/utils/cooldown.js'
import { REFINE_LANDMARKS } from '../shared/constants/mediapipe.js'
import {
  computeYaw,
  computePitch,
  computeRoll,
  computeEAR,
  computeIrisOpenness,
  computeMouthRatio,
} from '../shared/utils/gestureLogic.js'

/** Yaw left/right: need a few stable frames to avoid accidental seeks. */
const HEAD_POSE_DWELL_FRAMES_YAW = 4
/** Pitch up: 3 stable frames — looking up at a webcam is natural and easy to hold. */
const HEAD_POSE_DWELL_FRAMES_PITCH = 3
/**
 * Pitch down: only 2 stable frames needed.
 * Looking down is mechanically harder at typical webcam angles — the face
 * foreshortens and landmark noise increases, so a shorter dwell window
 * makes the gesture feel as responsive as HEAD_UP without false fires.
 */
const HEAD_POSE_DWELL_FRAMES_PITCH_DOWN = 2

/**
 * Circular history of last N frames: any frame exceeding these absolute values
 * suppresses eye-close detection for the entire window.
 * Reduced to 6 frames (was 8) — shorter residual blocking after a gesture,
 * so a blink immediately after a head turn can still fire.
 */
const EYE_HEAD_HISTORY_LEN = 6
const EYE_NEUTRAL_MAX_ABS_YAW   = 20   // was 22 — tighter residual gate
const EYE_NEUTRAL_MAX_ABS_PITCH = 16   // was 18 — tighter residual gate

/**
 * Instant per-frame thresholds for suppressing eye-close.
 * Intentionally decoupled from gesture thresholds so lowering sensitivity
 * for glasses wearers doesn't break blink detection.
 * Kept wider than gesture thresholds to allow some overlap zone.
 */
const EYE_PITCH_BLOCK_DEG = 14   // was 15
const EYE_YAW_BLOCK_DEG   = 12
const EYE_ROLL_BLOCK_DEG  = 12

/**
 * Maximum consecutive closed-eye frames counted as a blink gesture.
 * Raised to 35 (~1.2 s at 30fps) to allow longer intentional squints.
 */
const BLINK_MAX_CLOSED_FRAMES = 35

/**
 * Auto-calibration EMA for open-eye EAR baseline.
 * α = 0.04 → converges in ~25 frames (~0.8 s); slow enough to ignore single blinks.
 * Warm-up: 12 frames (~0.4 s). The EMA is seeded with the real signal on frame 1,
 * so it's already representative well before the old 30-frame window. Reducing this
 * means uncalibrated users get a personalized threshold in under half a second
 * instead of waiting a full second on the blind fallback.
 */
const DYNAMIC_EAR_ALPHA        = 0.04
const DYNAMIC_EAR_WARMUP_FRAMES = 12

/** Static fallback thresholds when no personal calibration and EMA hasn't warmed up. */
const FALLBACK_BLINK_THRESHOLD = 0.14
const FALLBACK_BLINK_EXIT      = 0.18
const FALLBACK_NOISE_FLOOR     = 0.03

/** Iris fallback (refined landmarks only, ~0.05–0.15 open, <0.03 closed). */
const FALLBACK_IRIS_THRESHOLD = 0.038
const FALLBACK_IRIS_EXIT      = 0.046
const FALLBACK_IRIS_NOISE     = 0.008

/**
 * When the EAR signal is in the "dead zone" (between threshold and exitThreshold)
 * for more than this many frames, we decay the closed streak.
 * Prevents phantom fires from noisy signal near the threshold boundary.
 */
const DEAD_ZONE_DECAY_FRAMES = 4

const EAR_CALIB_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class GestureEngine {
  constructor({
    thresholds   = DEFAULT_THRESHOLDS,
    cooldowns    = DEFAULT_COOLDOWNS,
    gestureMap   = DEFAULT_GESTURE_MAP,
    baseline     = null,
    onCommand    = null,
    onMetrics    = null,
    onPanelNotify = null,
  } = {}) {
    this._thresholds   = { ...thresholds }
    this._gestureMap   = { ...gestureMap }
    this._baseline     = baseline
    this._onCommand    = onCommand
    /** May be temporarily reassigned during calibration capture; callers must restore in finally. */
    this._onMetrics    = onMetrics
    this._onPanelNotify = onPanelNotify

    /** Median pose from calibration (deg); relative angles = raw − baseline. */
    this._yawBaseline   = 0
    this._pitchBaseline = 0
    this._rollBaseline  = 0
    this._applyPoseBaselinesFrom(baseline)

    /** Personalized blink params from storage / wizard. */
    this._blinkCalibration    = null
    this._blinkFallbackWarned = false

    /** @type {null | 'sidepanel'} */
    this._metricsStreamingTo = null
    /** Wizard: skip all gesture firing while collecting pose/EAR samples. */
    this._wizardCaptureOnly = false
    /** Wizard test step: notify side panel on each blink. */
    this._emitBlinkEvents = false

    this._closedStreak    = 0
    // Dead-zone frame counter: consecutive frames where signal sits between threshold and exit.
    // When this reaches DEAD_ZONE_DECAY_FRAMES, streak is halved to flush noisy accumulation.
    this._deadZoneFrames  = 0

    // Pre-allocated circular buffers — avoid push/shift (O(n)) in the 30fps hot path.
    this._headHistYaw   = new Float32Array(EYE_HEAD_HISTORY_LEN)
    this._headHistPitch = new Float32Array(EYE_HEAD_HISTORY_LEN)
    this._headHistIdx   = 0
    this._headHistFull  = false

    /**
     * Auto-calibration: EMA of open-eye EAR (closedStreak === 0 only).
     * Zero-allocation: mutates two numbers per frame, no GC pressure.
     * After DYNAMIC_EAR_WARMUP_FRAMES: threshold = ema × 0.65, exit = ema × 0.82.
     */
    this._earEmaOpen           = 0
    this._earEmaFrames         = 0
    this._dynamicEarThreshold  = null
    this._dynamicEarExit       = null

    this._dwellYawLeft   = 0
    this._dwellYawRight  = 0
    this._dwellPitchUp   = 0
    this._dwellPitchDown = 0

    this._active    = GESTURES.NONE
    this._blocked   = false
    this._destroyed = false

    this._cooldowns = {}
    for (const g of Object.values(GESTURES)) {
      if (g === GESTURES.NONE) continue
      this._cooldowns[g] = new Cooldown(cooldowns[g] ?? 600)
    }

    if (typeof window !== 'undefined') window.__nodexGestureEngine = this
  }

  /** Load `earCalibration` from storage if younger than 7 days. */
  async loadEarCalibrationFromStorage() {
    if (this._destroyed) return
    try {
      const { earCalibration } = await chrome.storage.local.get('earCalibration')
      const ttlOk =
        earCalibration &&
        typeof earCalibration.calibratedAt === 'number' &&
        Date.now() - earCalibration.calibratedAt < EAR_CALIB_TTL_MS
      const st = earCalibration?.signalType
      const calMatchesMode =
        ttlOk &&
        ((REFINE_LANDMARKS && st === 'iris') ||
          (!REFINE_LANDMARKS && (st === 'ear' || st == null)))
      if (calMatchesMode) {
        this._blinkCalibration = earCalibration
      } else {
        this._blinkCalibration = null
        this._onPanelNotify?.({ type: MSG.BLINK_CALIB_NEEDED })
      }
    } catch (_e) {
      this._blinkCalibration = null
      this._onPanelNotify?.({ type: MSG.BLINK_CALIB_NEEDED })
    }
  }

  /** @param {'full' | 'neutral_only' | 'blink_only'} _mode reserved for future branching */
  startCalibrationWizard(_mode) {
    if (this._destroyed) return
    this._metricsStreamingTo = 'sidepanel'
    this._wizardCaptureOnly  = true
    this._emitBlinkEvents    = false
  }

  enterWizardTestPhase() {
    if (this._destroyed) return
    this._wizardCaptureOnly = false
    this._emitBlinkEvents   = true
  }

  stopCalibrationWizard() {
    if (this._destroyed) return
    this._metricsStreamingTo = null
    this._wizardCaptureOnly  = false
    this._emitBlinkEvents    = false
  }

  /** @param {{ yawBaseline: number, pitchBaseline: number, rollBaseline?: number }} p */
  setNeutralPose(p) {
    const y = p.yawBaseline
    const pi = p.pitchBaseline
    const r = p.rollBaseline ?? 0
    if (typeof y === 'number' && Number.isFinite(y))   this._yawBaseline   = y
    if (typeof pi === 'number' && Number.isFinite(pi)) this._pitchBaseline = pi
    if (typeof r === 'number' && Number.isFinite(r))   this._rollBaseline  = r
    this._baseline = {
      ...(this._baseline ?? {}),
      yaw:   this._yawBaseline,
      pitch: this._pitchBaseline,
      roll:  this._rollBaseline,
    }
  }

  /** @param {object} result full earCalibration object */
  setBlinkCalibration(result) {
    if (!result || typeof result !== 'object') return
    if (REFINE_LANDMARKS) {
      if (result.signalType !== 'iris') return
    } else if (result.signalType !== 'ear' && result.signalType != null) {
      return
    }
    this._blinkCalibration = result
  }

  /** @param {number} delta e.g. ±0.01 */
  adjustBlinkThreshold(delta) {
    if (this._destroyed || !this._blinkCalibration?.range) return
    const r = this._blinkCalibration
    let th = r.threshold + delta
    th = Math.max(0.012, Math.min(0.5, th))
    const exitThreshold = Math.min(r.earClosed + r.range * 0.72, r.earOpen * 0.92)
    this._blinkCalibration = { ...r, threshold: th, exitThreshold }
    void chrome.storage.local.set({ earCalibration: this._blinkCalibration })
  }

  /**
   * Apply threshold/exit from side panel after storage save (live update, no storage read).
   * @param {{ threshold: number, exitThreshold: number }} p
   */
  applyBlinkThresholdUpdate(p) {
    if (this._destroyed || !this._blinkCalibration) return
    const th = p.threshold
    const ex = p.exitThreshold
    if (typeof th !== 'number' || !Number.isFinite(th)) return
    if (typeof ex !== 'number' || !Number.isFinite(ex)) return
    this._blinkCalibration = { ...this._blinkCalibration, threshold: th, exitThreshold: ex }
  }

  processFrame(landmarks) {
    if (this._destroyed || !landmarks?.length) return

    const T = this._thresholds

    const yawRaw   = computeYaw(landmarks)
    const pitchRaw = computePitch(landmarks)
    const rollRaw  = computeRoll(landmarks)
    const irisSignal  = computeIrisOpenness(landmarks)
    const blinkSignal = irisSignal !== null ? irisSignal : computeEAR(landmarks)
    const mouth       = computeMouthRatio(landmarks)

    const yaw   = yawRaw   - this._yawBaseline
    const pitch = pitchRaw - this._pitchBaseline
    const roll  = rollRaw  - this._rollBaseline

    const metrics = {
      yaw,
      pitch,
      roll,
      ear: blinkSignal == null ? undefined : blinkSignal,
      mouth,
    }
    this._onMetrics?.(metrics)

    if (this._metricsStreamingTo === 'sidepanel' && blinkSignal != null && Number.isFinite(blinkSignal)) {
      this._onPanelNotify?.({
        type:  MSG.METRICS_FRAME,
        yaw:   yawRaw,
        pitch: pitchRaw,
        ear:   blinkSignal,
      })
    }

    this._pushHeadPoseHistory(Math.abs(yaw), Math.abs(pitch))

    if (this._blocked) {
      this._closedStreak   = 0
      this._deadZoneFrames = 0
      this._resetHeadPoseDwell()
      this._active = GESTURES.NONE
      return
    }

    if (this._wizardCaptureOnly) return

    this._updateHeadPoseDwellStreaks(yaw, pitch, T)

    // Block eye-close when head is actively outside the neutral band.
    // Two gates: instant (current frame) and residual (recent history window).
    const headPoseBlocksEyes =
      Math.abs(yaw)   > EYE_YAW_BLOCK_DEG   ||
      Math.abs(pitch) > EYE_PITCH_BLOCK_DEG ||
      Math.abs(roll)  > EYE_ROLL_BLOCK_DEG

    const headNotNeutralRecent = this._headPoseNotNeutralForEyes()

    if (blinkSignal != null && Number.isFinite(blinkSignal)) {
      if (headPoseBlocksEyes || headNotNeutralRecent) {
        // Head in motion — flush streak to prevent residual phantom fires.
        this._closedStreak   = 0
        this._deadZoneFrames = 0
      } else {
        this._processBlinkFrame(blinkSignal, metrics, irisSignal !== null)
      }
    } else {
      this._closedStreak   = 0
      this._deadZoneFrames = 0
    }

    if (this._active !== GESTURES.NONE && this._active !== GESTURES.EYES_CLOSED) {
      const deactivate = this._shouldDeactivate(this._active, yaw, pitch, roll, mouth, T)
      if (deactivate) this._active = GESTURES.NONE
    }

    if (this._active === GESTURES.NONE) {
      const detected = this._detect(
        yaw, pitch, roll, mouth, T,
        HEAD_POSE_DWELL_FRAMES_YAW,
        HEAD_POSE_DWELL_FRAMES_PITCH,
      )
      if (detected !== GESTURES.NONE) {
        this._active = detected
        this._fire(detected, metrics)
      }
    }

    // Repeat-fire for held gestures: gated by per-gesture Cooldown so rate is controlled.
    if (
      this._active === GESTURES.HEAD_UP    ||
      this._active === GESTURES.HEAD_DOWN  ||
      this._active === GESTURES.HEAD_LEFT  ||
      this._active === GESTURES.HEAD_RIGHT
    ) {
      this._fire(this._active, metrics)
    }
  }

  /**
   * Eye-close processing with dead-zone decay and clean state machine.
   * Three zones:
   *   CLOSED  (< threshold)      → increment streak
   *   DEAD    (threshold..exit)  → hold streak, but decay if stuck too long
   *   OPEN    (> exitThreshold)  → evaluate + reset
   *
   * @param {number} blinkSignal EAR or iris openness
   * @param {object} metrics
   * @param {boolean} useIrisScale `true` when iris signal was used
   */
  _processBlinkFrame(blinkSignal, metrics, useIrisScale) {
    const bc = this._blinkCalibration
    const hasPersonal =
      bc != null &&
      typeof bc.threshold    === 'number' && Number.isFinite(bc.threshold) &&
      typeof bc.exitThreshold === 'number' && Number.isFinite(bc.exitThreshold)

    if (!hasPersonal && !this._blinkFallbackWarned) {
      this._blinkFallbackWarned = true
      console.warn(
        '[Nodex] No blink calibration — using auto-calibration fallback. ' +
        'Calibrate via side panel for best results.',
      )
    }

    // ── Auto-calibration EMA (open-eye baseline, EAR only) ───────────────────
    // Only update during confirmed open-eye frames (streak === 0, signal > noise floor).
    // After warmup: threshold = ema × 0.65 (was 0.68), exit = ema × 0.82.
    // Tighter coefficient (0.65) moves threshold slightly higher for better
    // coverage of users with naturally lower open-eye EAR.
    if (!hasPersonal && !useIrisScale && this._closedStreak === 0 && blinkSignal > 0.09) {
      if (this._earEmaFrames === 0) {
        this._earEmaOpen = blinkSignal
      } else {
        // EMA: α·x + (1-α)·prev  — no allocation
        this._earEmaOpen = DYNAMIC_EAR_ALPHA * blinkSignal + (1 - DYNAMIC_EAR_ALPHA) * this._earEmaOpen
      }
      this._earEmaFrames++
      if (this._earEmaFrames >= DYNAMIC_EAR_WARMUP_FRAMES && this._earEmaOpen >= 0.12) {
        this._dynamicEarThreshold = Math.max(0.08, this._earEmaOpen * 0.65)
        this._dynamicEarExit      = Math.max(0.11, this._earEmaOpen * 0.82)
      }
    }

    const threshold = hasPersonal
      ? bc.threshold
      : useIrisScale
        ? FALLBACK_IRIS_THRESHOLD
        : (this._dynamicEarThreshold ?? FALLBACK_BLINK_THRESHOLD)
    const exitThreshold = hasPersonal
      ? bc.exitThreshold
      : useIrisScale
        ? FALLBACK_IRIS_EXIT
        : (this._dynamicEarExit ?? FALLBACK_BLINK_EXIT)
    const noise = hasPersonal && typeof bc.noiseFloor === 'number' && Number.isFinite(bc.noiseFloor)
      ? bc.noiseFloor
      : useIrisScale ? FALLBACK_IRIS_NOISE : FALLBACK_NOISE_FLOOR

    // Minimum closed frames to count as intentional gesture vs natural blink.
    //
    // Natural blink:          ~100–400 ms  =  3–12 frames @ 30fps
    // Intentional gesture:    ~450 ms+     =  13+ frames @ 30fps
    //
    // Without personal calibration we don't know the user's eye anatomy, so
    // we need a wider safety margin: 13 frames (~433 ms) clearly separates
    // intentional holds from the upper tail of natural blinks.
    //
    // With personal calibration the noise floor is measured from real samples,
    // so a tighter window (9–11 frames) is safe and feels more responsive.
    const minClosed = hasPersonal
      ? (noise > 0.012 ? 11 : 9)
      : useIrisScale ? (noise > 0.012 ? 11 : 9) : 13

    const maxClosed = BLINK_MAX_CLOSED_FRAMES

    if (blinkSignal < threshold) {
      // ── CLOSED zone ────────────────────────────────────────────────────────
      this._closedStreak++
      this._deadZoneFrames = 0
    } else if (blinkSignal > exitThreshold) {
      // ── OPEN zone ──────────────────────────────────────────────────────────
      if (this._closedStreak >= minClosed && this._closedStreak <= maxClosed) {
        this._fire(GESTURES.EYES_CLOSED, metrics)
      }
      this._closedStreak   = 0
      this._deadZoneFrames = 0
    } else {
      // ── DEAD ZONE (threshold..exitThreshold) ───────────────────────────────
      // Signal is noisy near the boundary. We hold the streak but count dead-zone
      // frames; if stuck here for DEAD_ZONE_DECAY_FRAMES consecutive frames,
      // halve the streak to prevent phantom fire from accumulated noisy frames.
      this._deadZoneFrames++
      if (this._deadZoneFrames >= DEAD_ZONE_DECAY_FRAMES) {
        this._closedStreak   = Math.floor(this._closedStreak / 2)
        this._deadZoneFrames = 0
      }
    }
  }

  updateSettings({ thresholds, gestureMap, baseline, cooldowns, blocked } = {}) {
    if (thresholds)         this._thresholds = { ...thresholds }
    if (gestureMap)         this._gestureMap = { ...gestureMap }
    if (baseline !== undefined) {
      this._baseline = baseline
      this._applyPoseBaselinesFrom(baseline)
    }
    if (blocked !== undefined) this._blocked = blocked
    if (cooldowns) {
      for (const [g, ms] of Object.entries(cooldowns)) {
        if (this._cooldowns[g]) this._cooldowns[g].setInterval(ms)
      }
    }
  }

  destroy() {
    if (typeof window !== 'undefined' && window.__nodexGestureEngine === this) {
      window.__nodexGestureEngine = null
    }
    this._destroyed = true
    this._active    = GESTURES.NONE
    this._closedStreak   = 0
    this._deadZoneFrames = 0
    this.stopCalibrationWizard()
    this._yawBaseline   = 0
    this._pitchBaseline = 0
    this._rollBaseline  = 0
    this._headHistIdx   = 0
    this._headHistFull  = false
    this._earEmaOpen    = 0
    this._earEmaFrames  = 0
    this._dynamicEarThreshold = null
    this._dynamicEarExit      = null
    this._resetHeadPoseDwell()
    this._onCommand    = null
    this._onMetrics    = null
    this._onPanelNotify = null
    for (const cd of Object.values(this._cooldowns)) cd.reset()
  }

  _pushHeadPoseHistory(absYaw, absPitch) {
    // Zero-allocation circular buffer write — no push/shift, no GC pressure at 30fps.
    this._headHistYaw[this._headHistIdx]   = absYaw
    this._headHistPitch[this._headHistIdx] = absPitch
    this._headHistIdx = (this._headHistIdx + 1) % EYE_HEAD_HISTORY_LEN
    if (!this._headHistFull && this._headHistIdx === 0) this._headHistFull = true
  }

  _headPoseNotNeutralForEyes() {
    // Plain for-loop — avoids inline closure allocation per call at 30fps.
    const len = this._headHistFull ? EYE_HEAD_HISTORY_LEN : this._headHistIdx
    for (let i = 0; i < len; i++) {
      if (this._headHistYaw[i]   > EYE_NEUTRAL_MAX_ABS_YAW)   return true
      if (this._headHistPitch[i] > EYE_NEUTRAL_MAX_ABS_PITCH) return true
    }
    return false
  }

  _resetHeadPoseDwell() {
    this._dwellYawLeft   = 0
    this._dwellYawRight  = 0
    this._dwellPitchUp   = 0
    this._dwellPitchDown = 0
  }

  _updateHeadPoseDwellStreaks(yaw, pitch, T) {
    const yTh = T.yaw   ?? 22
    const pTh = T.pitch ?? 18
    // Pre-warm HEAD_DOWN 2° before the fire threshold: at typical webcam angles
    // the face foreshortens when looking down, so the raw pitch signal spends
    // several frames "approaching" the threshold before consistently crossing it.
    // Starting the dwell counter early means a genuine nod already has streak
    // credit when it finally crosses the fire line in _detect.
    // No floor: always exactly 2° before pTh so the pre-warm zone tracks
    // whatever sensitivity the user has configured.
    const pThDown = pTh - 2

    if (yaw > yTh)   this._dwellYawRight++  ; else this._dwellYawRight  = 0
    if (yaw < -yTh)  this._dwellYawLeft++   ; else this._dwellYawLeft   = 0
    if (pitch > pTh) this._dwellPitchUp++   ; else this._dwellPitchUp   = 0
    // Decay by 1 (was 2): a single noisy frame no longer wipes the streak.
    // Combined with pre-warm above, this makes HEAD_DOWN as reliable as HEAD_UP
    // without increasing false-positive risk (fire still requires full pTh + dwell ≥ 2).
    if (pitch < -pThDown) {
      this._dwellPitchDown++
    } else {
      this._dwellPitchDown = Math.max(0, this._dwellPitchDown - 1)
    }
  }

  _applyPoseBaselinesFrom(baseline) {
    const y = baseline?.yaw
    const p = baseline?.pitch
    const r = baseline?.roll
    this._yawBaseline   = typeof y === 'number' && Number.isFinite(y) ? y : 0
    this._pitchBaseline = typeof p === 'number' && Number.isFinite(p) ? p : 0
    this._rollBaseline  = typeof r === 'number' && Number.isFinite(r) ? r : 0
  }

  _fire(gesture, metrics) {
    if (this._destroyed) return
    // In wizard test phase: emit BLINK_DETECTED before the cooldown gate so every blink
    // that passes the min/maxClosed window is counted, even if 1200ms hasn't elapsed.
    if (gesture === GESTURES.EYES_CLOSED && this._emitBlinkEvents) {
      this._onPanelNotify?.({ type: MSG.BLINK_DETECTED })
    }
    // During the wizard test phase, never execute YouTube commands — the user is only
    // testing blink detection accuracy. Without this guard, blinks mapped to PLAY_PAUSE
    // (or any other action) would fire on the YouTube tab while calibrating.
    if (this._emitBlinkEvents) return
    const cd = this._cooldowns[gesture]
    if (!cd || !cd.fire()) return
    const cmd = this._gestureMap[gesture] ?? COMMANDS.NONE
    if (cmd === COMMANDS.NONE) return
    this._onCommand?.(cmd, gesture, metrics)
  }

  _detect(yaw, pitch, roll, mouth, T, dwellYaw, dwellPitch) {
    const yTh    = T.yaw      ?? 22
    const pTh    = T.pitch    ?? 18
    const absYaw   = Math.abs(yaw)
    const absPitch = Math.abs(pitch)

    // HEAD_UP: 4° margin keeps it strict — looking up at a webcam is clean.
    if (absPitch + 4 >= absYaw && pitch > pTh && this._dwellPitchUp >= dwellPitch) return GESTURES.HEAD_UP
    // HEAD_DOWN: 6° margin — wider because looking down causes more yaw sway
    // (head naturally rotates slightly when dropping chin). Also uses a shorter
    // dedicated dwell so the gesture registers as reliably as HEAD_UP.
    if (absPitch + 6 >= absYaw && pitch < -pTh && this._dwellPitchDown >= HEAD_POSE_DWELL_FRAMES_PITCH_DOWN) return GESTURES.HEAD_DOWN
    if (yaw < -yTh && this._dwellYawLeft  >= dwellYaw) return GESTURES.HEAD_LEFT
    if (yaw >  yTh && this._dwellYawRight >= dwellYaw) return GESTURES.HEAD_RIGHT
    if (roll < -T.roll)    return GESTURES.TILT_LEFT
    if (roll >  T.roll)    return GESTURES.TILT_RIGHT
    if (mouth > T.mouthOpen) return GESTURES.MOUTH_OPEN
    return GESTURES.NONE
  }

  _shouldDeactivate(active, yaw, pitch, roll, mouth, T) {
    const yTh    = T.yaw           ?? 22
    const pTh    = T.pitch         ?? 18
    const rTh    = T.roll          ?? 15
    const hYaw   = T.hysteresisYaw   ?? 7
    const hPitch = T.hysteresisPitch  ?? 7
    const hRoll  = T.hysteresis       ?? 4
    switch (active) {
      case GESTURES.HEAD_LEFT:  return yaw  >= -(yTh - hYaw)
      case GESTURES.HEAD_RIGHT: return yaw  <=   yTh - hYaw
      case GESTURES.HEAD_UP:    return pitch <=   pTh - hPitch
      case GESTURES.HEAD_DOWN:  return pitch >= -(pTh - hPitch)
      case GESTURES.TILT_LEFT:  return roll >= -(rTh - hRoll)
      case GESTURES.TILT_RIGHT: return roll <=   rTh - hRoll
      case GESTURES.MOUTH_OPEN: return mouth <= T.mouthOpen * 0.8
      default: return true
    }
  }
}
