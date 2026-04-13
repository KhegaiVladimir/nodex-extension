/**
 * Must match `FACE_MESH_OPTIONS.refineLandmarks` in `content/mediapipe-bridge.js`.
 * When false: 468 landmarks, blink uses EAR; iris helpers return null.
 * When true: 478 landmarks, optional iris-based blink; requires full MediaPipe asset set + longer first init.
 */
export const REFINE_LANDMARKS = false
