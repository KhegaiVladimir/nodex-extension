/** window.postMessage between ISOLATED content script and MAIN world (mediapipe-bridge.js) */
export const BRIDGE_WINDOW = Object.freeze({
  HEALTH_CHECK:        'NODEX_HEALTH_CHECK',
  HEALTH_CHECK_RESULT: 'NODEX_HEALTH_CHECK_RESULT',
  RECOVERING:          'NODEX_BRIDGE_RECOVERING',
  RECOVERED:           'NODEX_BRIDGE_RECOVERED',
  /** Bridge → ISOLATED: no face landmarks in this frame (face left the frame). */
  NO_FACE:             'NODEX_NO_FACE',
})

export const MSG = Object.freeze({
  METRICS_UPDATE: 'METRICS_UPDATE',
  GESTURE_FIRED: 'GESTURE_FIRED',
  COMMAND_EXECUTED: 'COMMAND_EXECUTED',
  ENGINE_STATUS: 'ENGINE_STATUS',
  CALIBRATION_PROGRESS: 'CALIBRATION_PROGRESS',
  START_ENGINE: 'START_ENGINE',
  STOP_ENGINE: 'STOP_ENGINE',
  CALIBRATION_START: 'CALIBRATION_START',
  /** Release GestureEngine blocked state when capture aborts without SAVE_CALIBRATION */
  CALIBRATION_CANCEL: 'CALIBRATION_CANCEL',
  SAVE_CALIBRATION: 'SAVE_CALIBRATION',
  UPDATE_SETTINGS: 'UPDATE_SETTINGS',
  REQUEST_STATUS: 'REQUEST_STATUS',
  CONTENT_TO_SIDEPANEL: 'CONTENT_TO_SIDEPANEL',
  SIDEPANEL_TO_CONTENT: 'SIDEPANEL_TO_CONTENT',
  TOGGLE_BROWSE_MODE: 'TOGGLE_BROWSE_MODE',
  BROWSE_MODE_CHANGED: 'BROWSE_MODE_CHANGED',
  TUTORIAL_START: 'TUTORIAL_START',
  TUTORIAL_END: 'TUTORIAL_END',

  /** Content → side panel: raw metrics during calibration wizard */
  METRICS_FRAME: 'METRICS_FRAME',
  /** Side panel → content: apply saved calibration + end wizard session */
  CALIBRATION_COMPLETE: 'CALIBRATION_COMPLETE',
  /** Content → side panel: blink registered (wizard test step) */
  BLINK_DETECTED: 'BLINK_DETECTED',
  /** Side panel → content: nudge threshold by delta (±0.01) */
  BLINK_THRESHOLD_ADJUST: 'BLINK_THRESHOLD_ADJUST',
  /** Side panel → content: start metrics stream + capture-only mode */
  WIZARD_START: 'WIZARD_START',
  /** Side panel → content: leave capture-only, enable blink test events */
  WIZARD_ENTER_TEST: 'WIZARD_ENTER_TEST',
  /** Side panel → content: stop streaming / wizard without saving */
  WIZARD_CANCEL: 'WIZARD_CANCEL',
  /** Side panel → content: manual threshold after storage update (engine applies without re-read) */
  BLINK_THRESHOLD_UPDATED: 'BLINK_THRESHOLD_UPDATED',

  /** Side panel → content: update auto-pause-on-no-face setting live */
  SET_AUTO_PAUSE: 'SET_AUTO_PAUSE',

  /** @deprecated legacy blink flow */
  START_BLINK_CALIBRATION: 'START_BLINK_CALIBRATION',
  BLINK_CALIB_PHASE_A_STARTED: 'BLINK_CALIB_PHASE_A_STARTED',
  BLINK_CALIB_PHASE_B_STARTED: 'BLINK_CALIB_PHASE_B_STARTED',
  BLINK_CALIB_SUCCESS: 'BLINK_CALIB_SUCCESS',
  BLINK_CALIB_FAILED: 'BLINK_CALIB_FAILED',
  BLINK_CALIB_NEEDED: 'BLINK_CALIB_NEEDED',
})
