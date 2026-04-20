# Face Tracking

## Landmark Map (Used by Nodex)

Full MediaPipe Face Mesh has 468 landmarks (478 with refined iris). Nodex uses a small subset:

### Head Pose Landmarks

| Index | Location |
|---|---|
| 1 | Nose tip |
| 234 | Left cheek (face side) |
| 454 | Right cheek (face side) |
| 10 | Forehead |
| 152 | Chin |

### Eye Landmarks

| Side | Upper lid | Lower lid | Inner corner | Outer corner | Upper 2 | Lower 2 |
|---|---|---|---|---|---|---|
| Right | 159 | 145 | 133 | 33 | 158 | 153 |
| Left | 386 | 374 | 362 | 263 | 385 | 380 |

### Iris (only when `REFINE_LANDMARKS: true`)

| Side | Top | Bottom | Left | Right |
|---|---|---|---|---|
| Right | 470 | 472 | 471 | 469 |
| Left | 475 | 477 | 476 | 474 |

Iris indices start at 468 (added on top of the base 468).

### Mouth Landmarks

| Index | Location |
|---|---|
| 13 | Upper lip center |
| 14 | Lower lip center |
| 78 | Left mouth corner |
| 308 | Right mouth corner |

## Head Pose Computation

All functions are in `shared/utils/gestureLogic.js`.

### Yaw (left/right rotation)

Uses the horizontal offset of the nose tip between the two cheek anchors:
- Maps offset to ±45°
- **Sign is inverted** to account for webcam mirroring: nose appearing left in frame means the user turned right → positive yaw

### Pitch (up/down tilt)

Uses the vertical position of the nose tip between forehead and chin:
- Maps to ±40°
- Positive = looking up (nose above midpoint)

### Roll (head tilt)

Uses `atan2` on the vector between left and right cheek landmarks:
- Positive = tilted right, negative = tilted left
- Degrees

## Smoothing

Raw landmark coordinates are noisy. GestureEngine applies EMA before computing angles:

```
EMA_t = α × x_t + (1 - α) × EMA_{t-1}
```

The smoothing factor `α` controls responsiveness vs noise. Lower α = smoother but more lag. The specific α values per axis are set in GestureEngine constructor.

**Rule:** never trigger events from raw (unsmoothed) landmark values.

## Gesture Thresholds (Defaults)

Angles in degrees. All overridable via sensitivity presets or side panel.

| Gesture | Threshold | Hysteresis gap |
|---|---|---|
| HEAD_LEFT (yaw) | 22° | 7° (`hysteresisYaw`) |
| HEAD_RIGHT (yaw) | 22° | 7° |
| HEAD_UP (pitch) | 9° | 7° (`hysteresisPitch`) |
| HEAD_DOWN (pitch) | 9° | 7° |
| TILT_LEFT (roll) | 15° | 4° (`hysteresis`) |
| TILT_RIGHT (roll) | 15° | 4° |

**Hysteresis:** gesture activates at `threshold`, deactivates at `threshold − gap`. Prevents rapid on/off chatter at the boundary.

## Dwell Frames (per gesture type)

| Gesture axis | Dwell |
|---|---|
| Yaw (left/right) | 4 frames |
| Pitch up | 3 frames |
| Pitch down | 2 frames |

User must hold the angle past threshold for this many consecutive frames before the gesture fires. Filters accidental head movements.

## Mouth Ratio

```
mouthRatio = |upperLip − lowerLip| / |leftCorner − rightCorner|
```

- ~0.0 = closed
- ~0.3+ = wide open
- Default MOUTH_OPEN threshold: 0.55

`MIN_SPAN: 0.001` guard prevents division by zero if face is side-on or landmarks degenerate.

## Sensitivity Presets

Three presets in `shared/constants/defaults.js`:

| Preset | Yaw | Pitch | Roll | Effect |
|---|---|---|---|---|
| LOW | 26° | 13° | 18° | Requires larger head movements |
| MEDIUM | 22° | 9° | 15° | Default |
| HIGH | 18° | 7° | 12° | More sensitive, fires more easily |
