/**
 * Global test setup.
 *
 * GestureEngine imports chrome.storage.local in two places:
 *   - loadEarCalibrationFromStorage()   (async, reads)
 *   - adjustBlinkThreshold()            (fire-and-forget write)
 *
 * All other tested code (gestureLogic.js, Cooldown, _processBlinkFrame, etc.)
 * is pure logic with no platform dependencies.
 *
 * We stub the minimum chrome surface so imports don't throw.  Each test that
 * exercises storage directly should configure the mock via vi.mocked().
 */

global.chrome = {
  storage: {
    local: {
      get:  vi.fn().mockResolvedValue({}),
      set:  vi.fn().mockResolvedValue(undefined),
    },
  },
}
