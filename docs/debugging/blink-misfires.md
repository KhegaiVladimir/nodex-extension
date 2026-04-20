# Debug: Blink Misfires

## Symptoms

- EYES_CLOSED gesture fires during head movements (unwanted)
- Blink triggers multiple times for one intentional blink
- Blink never triggers even when closing eyes deliberately
- EYES_HOLD fires when just blinking normally

## Diagnosis Checklist

### Step 1 — Check HUD metrics

Open any YouTube video with Nodex running. Check the metrics panel (bottom-right):
- Is EAR displayed? If it shows `--`, GestureEngine isn't receiving landmarks.
- What is the resting EAR value? Typical open eye: 0.25–0.35. Below 0.20 suggests lighting issue or glasses.
- Close eyes deliberately — does EAR drop noticeably (more than 0.05)?

### Step 2 — Check calibration data

DevTools → Application → Storage → `chrome-extension://...`:
- Is `earCalibration` present?
- `calibratedAt` — is it within the last 7 days? (TTL: 7 × 24 × 3600 × 1000 ms)
- Is `threshold` between 0.10 and 0.25? Outside this range is suspicious.
- Is `range` (earOpen − earClosed) at least 0.05? Less than 0.02 would fail calibration.

### Step 3 — Reproduce conditions

Run: open a YouTube video, watch the HUD:
- Do misfires correlate with head movement? → head-movement suppression may not be working
- Do misfires happen on blink start or blink end? → check threshold vs exitThreshold gap
- Do multiple fires happen per blink? → `minClosed` frames may be too low

## Common Root Causes & Fixes

### Misfires during head movement

**Why:** EAR drop can look like a blink when head tilts (perspective effect changes apparent eye opening).

**Expected fix:** GestureEngine has per-frame gate and 6-frame rolling history:
- Per-frame: `|yaw| > 12°` or `|pitch| > 14°` or `|roll| > 12°` → suppress
- History: any of last 6 frames had `|yaw| > 20°` or `|pitch| > 16°` → suppress

If misfires still happen during moderate head movement, the suppression thresholds may need tightening. Relevant constants in `GestureEngine.js`:
```
EYE_PITCH_BLOCK_DEG: 14
EYE_YAW_BLOCK_DEG: 12
EYE_ROLL_BLOCK_DEG: 12
EYE_NEUTRAL_MAX_ABS_YAW: 20
EYE_NEUTRAL_MAX_ABS_PITCH: 16
EYE_HEAD_HISTORY_LEN: 6
```

### Rapid blinks trigger multiple events

**Why:** `minClosed` frames threshold (`15` frames, ~0.5s) filters out rapid blinks. If it fires multiple times, the state machine isn't resetting correctly.

**Check:** Is `_closedStreak` resetting to 0 after each blink event? After EYES_CLOSED fires, the streak must reset and a new blink must reach `minClosed` again before the next event fires.

### Blink never triggers

**Why:** Threshold too high — user's EAR never drops below it.

**Check:**
1. Watch HUD EAR value during deliberate eye close
2. If EAR doesn't drop below `threshold` in calibration data → recalibrate
3. If no calibration data → dynamic auto-calibration: `threshold = ema × 0.60`. Is the resting EAR unusually high (>0.40)?

**Quick fix:** side panel → Calibration → run wizard again.

### EYES_HOLD fires on normal blinks

**Why:** `LONG_HOLD_FRAMES: 42` (~1.4s). If user has slow blinks by nature, 42 frames may be reached.

**Increase `BLINK_MAX_CLOSED_FRAMES`** (currently 35) to allow longer blinks before EYES_HOLD fires. But be careful — this narrows the gap between normal blink max and EYES_HOLD threshold.

### EAR calibration expired

**Why:** `EAR_CALIB_TTL_MS: 7 days`. Stale calibration switches to dynamic mode which needs warm-up frames.

**Fix:** Recalibrate from side panel. Or wait 15–30 seconds for dynamic auto-calibration to converge.

## Logging EAR in Real Time

If HUD isn't enough, add temporary logging in `GestureEngine.processLandmarks()`:

```js
if (frame % 10 === 0) {  // log every 10 frames to avoid flooding
  console.log('[Nodex] EAR:', ear.toFixed(3), 'streak:', this._closedStreak, 'zone:', zone)
}
```

Remove before committing.
