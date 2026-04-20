# Blink Detection

## Signal Types

Nodex supports two blink signals, controlled by `REFINE_LANDMARKS` in `shared/constants/mediapipe.js`:

| Signal | When | Landmarks |
|---|---|---|
| EAR (Eye Aspect Ratio) | `REFINE_LANDMARKS: false` (default) | 468 standard |
| Iris ratio | `REFINE_LANDMARKS: true` | 478 (iris ring) |

## EAR Formula (6-point Sukoi)

Uses two vertical spans per eye (primary + secondary eyelid pair), averaged across both eyes:

```
EAR = (|p2-p6| + |p3-p5|) / (2 × |p1-p4|)
```

Where p1–p6 are the 6 eye landmark positions. Both eyes are averaged.

**Typical values:**
- Open eye: 0.25–0.35
- Blink threshold: calibrated per user, typically 0.15–0.22
- Closed eye: below threshold

Eye landmarks (right eye): indices 159, 145, 133, 33, 158, 153
Eye landmarks (left eye): indices 386, 374, 362, 263, 385, 380

## Dynamic EAR Auto-Calibration

GestureEngine runs an EMA (Exponential Moving Average) of the open-eye EAR, starting from frame 12 (warmup):

```
EMA_t = 0.04 × EAR_t + 0.96 × EMA_{t-1}
```

After warmup (`DYNAMIC_EAR_WARMUP_FRAMES: 12`):
- `threshold = ema × 0.60`
- `exitThreshold = ema × 0.80`

This adapts to each user's natural open-eye EAR without any explicit calibration step.

## Personal Calibration (CalibrationWizard)

For users who want precise tuning, the `CalibrationWizard` in the side panel runs a two-phase guided calibration:

**Phase 1 — Open eyes** (3100 ms): collects EAR samples while user looks at camera normally.

**Phase 2 — Closed eyes** (3200 ms): collects EAR samples while user holds eyes closed.

`computeBlinkThreshold(openSamples, closedSamples)` in `shared/utils/blinkCalibration.js` processes the raw samples:

1. Sorts samples ascending
2. Drops bottom 15% + top 35% of open samples (removes blink frames and wide-eyed staring)
3. Drops bottom 10% + top 20% of closed samples (removes outliers)
4. Takes median of filtered sets → `earOpen`, `earClosed`
5. `range = earOpen − earClosed`
6. If `range < 0.02` → returns `{ ok: false, reason: 'insufficient_range' }`
7. Threshold coefficient: 0.35 normally; 0.5 if range > 0.25 (unusually large) or earOpen < 0.35
8. `threshold = earClosed + range × coeff`, capped at `earOpen × 0.85`
9. `exitThreshold = min(threshold + 0.03, earOpen × 0.80)` — narrow dead zone (~0.03) so eyes exit in 1–2 frames on open

Calibration is stored in `chrome.storage.local` with key `earCalibration` (TTL: 7 days).

## State Machine (GestureEngine)

Three zones based on current EAR vs thresholds:

```
OPEN (EAR > exitThreshold)
  │  eye closes
  ▼
CLOSED (EAR < threshold)         tracks _closedStreak (frames)
  │  eye opens
  ▼
DEAD ZONE (threshold ≤ EAR ≤ exitThreshold)   _deadZoneFrames
  │  EAR rises above exitThreshold
  ▼
OPEN
```

**Frame counters:**

| Constant | Value | Meaning |
|---|---|---|
| `minClosed` | 15 frames | Minimum frames closed to count as intentional blink (~0.5s) |
| `BLINK_MAX_CLOSED_FRAMES` | 35 frames | Max normal blink (~1.2s); allows squinting |
| `LONG_HOLD_FRAMES` | 42 frames | Fires EYES_HOLD while still closed (~1.4s) |
| `DEAD_ZONE_DECAY_FRAMES` | 4 | Frames in dead zone before streak resets |

**Events emitted:**
- `EYES_CLOSED` — on eye open, after `minClosed ≤ streak ≤ BLINK_MAX_CLOSED_FRAMES`
- `EYES_HOLD` — on frame 42 while still closed (fires once per hold)

## Head-Movement Suppression

When the user's head moves, eye-close events are suppressed to prevent accidental blink triggers during gestures.

**Per-frame gate (immediate):**
- If `|yaw| > 12°` or `|pitch| > 14°` or `|roll| > 12°` → suppress eye close

**Rolling history gate (last 6 frames):**
- `EYE_HEAD_HISTORY_LEN: 6`
- If any of the last 6 frames had `|yaw| > 20°` or `|pitch| > 16°` → suppress

## Fallback Thresholds

Used if no calibration data available:

| Signal | threshold | exitThreshold | noiseFloor |
|---|---|---|---|
| EAR | 0.15 | 0.19 | 0.03 |
| Iris | 0.038 | 0.046 | 0.008 |

## Calibration TTL

`EAR_CALIB_TTL_MS: 7 × 24 × 60 × 60 × 1000` (7 days)

After 7 days, calibration is treated as stale and dynamic auto-calibration takes over.
