// Thresholds are calibrated for the Euclidean-distance gesture formulas in gestureLogic.js.
//
// EAR (Eye Aspect Ratio):  ~0.25–0.35 eyes open,  <0.18 eyes closed
// Mouth ratio:             ~0.0 closed,  0.25–0.4 wide open
// Yaw / pitch / roll:      approximate degrees via atan2 / ratio math

export const DEFAULT_THRESHOLDS = {
  yaw:        12,
  pitch:      8,
  roll:       10,
  earClose:   0.15,
  mouthOpen:  0.30,
  hysteresis: 2,
}

export const SENSITIVITY_PRESETS = {
  low: {
    yaw: 18, pitch: 15, roll: 12,
    earClose: 0.15, mouthOpen: 0.30,
    hysteresis: 3,
  },
  medium: DEFAULT_THRESHOLDS,
  high: {
    yaw: 8, pitch: 7, roll: 5,
    earClose: 0.20, mouthOpen: 0.18,
    hysteresis: 1.5,
  },
}
