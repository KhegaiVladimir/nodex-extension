(function () {
  'use strict'

  if (window.__nodexBridgeLoaded) {
    console.warn('[Nodex Bridge] already loaded, skipping re-init')
    return
  }
  try {
    Object.defineProperty(window, '__nodexBridgeLoaded', {
      value: true,
      writable: true,
      configurable: true,
    })
  } catch (_e) {
    window.__nodexBridgeLoaded = true
  }

  // Must stay in sync with `shared/constants/mediapipe.js` (REFINE_LANDMARKS).
  // Iris/refine needs extra assets + longer init; keep false for stability.
  const FACE_MESH_OPTIONS = {
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  }

  const POLL_TIMEOUT_MS  = 15000
  const POLL_INTERVAL_MS = 100

  // Recovery backoff: start at 1 s, double each attempt, cap at 6 s.
  const RECOVERY_BASE_DELAY_MS = 1000
  const RECOVERY_MAX_DELAY_MS  = 6000
  let recoveryAttempt = 0

  let faceMesh   = null
  let camera     = null
  let videoEl    = null
  let running    = false
  let baseUrl    = ''
  /** AbortController for session-scoped listeners (track.ended, visibilitychange). */
  let cameraSessionAbort = null
  /** Set true only when user sends NODEX_STOP_CAMERA — blocks all auto-recovery. */
  let userRequestedCameraStop = false
  /** Mutex: one recovery at a time. */
  let recovering = false

  // ── MediaPipe injection handshake ──────────────────────────────────────────

  function requestMediaPipeInjection() {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        window.removeEventListener('message', handler)
        reject(new Error('[Nodex Bridge] Timeout waiting for MediaPipe injection'))
      }, 10000)

      function handler(e) {
        if (e.source !== window) return
        if (e.data?.type !== 'NODEX_INJECT_MEDIAPIPE_RESULT') return
        clearTimeout(timeoutId)
        window.removeEventListener('message', handler)
        if (e.data.ok) resolve()
        else reject(new Error('[Nodex Bridge] Injection failed: ' + (e.data.error ?? 'unknown')))
      }

      window.addEventListener('message', handler)
      window.postMessage({ type: 'NODEX_INJECT_MEDIAPIPE' }, '*')
    })
  }

  function waitForGlobal(name) {
    if (window[name] !== undefined) return Promise.resolve()
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS
      const poll = setInterval(() => {
        if (window[name] !== undefined) {
          clearInterval(poll)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(poll)
          reject(new Error('[Nodex Bridge] ' + name + ' did not appear after injection'))
        }
      }, POLL_INTERVAL_MS)
    })
  }

  // ── Script-injection relay for face_mesh.js's patched Vb() ────────────────
  // face_mesh.js dispatches __nodex_load_script with {url, id}.
  // We relay through the ISOLATED world → service worker → chrome.scripting,
  // completely bypassing YouTube's Trusted Types CSP.

  window.addEventListener('__nodex_load_script', (e) => {
    const { url, id } = e.detail || {}
    if (!url || !id) return

    let relativePath = url
    if (url.startsWith('chrome-extension://')) {
      const pathStart = url.indexOf('/', 'chrome-extension://'.length)
      if (pathStart !== -1) relativePath = url.substring(pathStart + 1)
    }

    window.postMessage({ type: 'NODEX_INJECT_SCRIPT', path: relativePath, requestId: id }, '*')
  })

  window.addEventListener('message', (e) => {
    if (e.source !== window) return
    if (e.data?.type === 'NODEX_INJECT_SCRIPT_RESULT' && e.data.requestId) {
      window.dispatchEvent(new CustomEvent('__nodex_script_loaded', {
        detail: { id: e.data.requestId },
      }))
    }
  })

  // ── MediaPipe init ─────────────────────────────────────────────────────────

  async function initMediaPipe() {
    if (recovering) {
      console.warn('[Nodex Bridge] initMediaPipe called while recovering, ignoring')
      return
    }
    if (faceMesh) {
      console.warn('[Nodex Bridge] FaceMesh already initialized, reusing')
      return
    }

    await requestMediaPipeInjection()
    await waitForGlobal('FaceMesh')
    await waitForGlobal('Camera')

    faceMesh = new FaceMesh({
      locateFile: (file) => baseUrl + 'assets/mediapipe/' + file,
    })
    faceMesh.setOptions(FACE_MESH_OPTIONS)
    faceMesh.onResults((results) => {
      try {
        if (!running) return
        const lm = results.multiFaceLandmarks?.[0]
        if (lm) {
          window.postMessage({ type: 'NODEX_LANDMARKS', data: lm }, '*')
        } else {
          // Face left the frame (or was never found this frame).
          // ISOLATED world uses this to drive auto-pause-on-no-face.
          window.postMessage({ type: 'NODEX_NO_FACE' }, '*')
        }
      } catch (_e) {
        /* skip malformed frame */
      }
    })

    await faceMesh.initialize()
  }

  // ── Camera lifecycle ───────────────────────────────────────────────────────

  async function startCamera() {
    if (recovering) {
      console.warn('[Nodex Bridge] startCamera called while recovering, ignoring')
      return
    }

    videoEl = document.createElement('video')
    videoEl.setAttribute('playsinline', '')
    videoEl.muted = true
    // Visually hidden but still in layout so getUserMedia permissions persist.
    // opacity:0.001 keeps it "visible" to the browser (opacity:0 may suspend it).
    videoEl.style.cssText =
      'position:fixed;width:1px;height:1px;opacity:0.001;' +
      'transform:translate(-9999px,-9999px);pointer-events:none;z-index:-1;'
    document.body.appendChild(videoEl)

    cameraSessionAbort = new AbortController()
    const sessionSignal = cameraSessionAbort.signal

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    })
    videoEl.srcObject = stream
    await videoEl.play()

    // Monitor track health — device can yank the track without error (e.g. USB camera unplugged).
    const track = stream.getVideoTracks()[0]
    if (track) {
      track.addEventListener('ended', () => {
        if (recovering || !running || userRequestedCameraStop) return
        void _recoverCamera('track ended')
      }, { signal: sessionSignal })
    }

    // Resume on tab focus: stream may have silently died while hidden.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState !== 'visible') return
      if (recovering || !running || userRequestedCameraStop) return

      const activeTrack = videoEl?.srcObject?.getVideoTracks()[0]
      if (!activeTrack || activeTrack.readyState !== 'live') {
        void _recoverCamera('stream died during hidden state')
      }
    }, { signal: sessionSignal })

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (!faceMesh || !running || document.hidden) return
        await faceMesh.send({ image: videoEl })
      },
      width: 640,
      height: 480,
    })
    camera.start()
    running = true
    recoveryAttempt = 0   // successful start resets backoff counter

    window.postMessage({ type: 'NODEX_BRIDGE_READY' }, '*')
  }

  async function stopCamera() {
    running = false

    if (cameraSessionAbort) {
      cameraSessionAbort.abort()
      cameraSessionAbort = null
    }
    if (camera) {
      try { await camera.stop() } catch (_e) { /* ignore */ }
      camera = null
    }
    if (videoEl) {
      const stream = videoEl.srcObject
      if (stream) {
        for (const track of stream.getTracks()) {
          try { track.stop() } catch (_e) { /* ignore */ }
        }
      }
      videoEl.srcObject = null
      try { videoEl.remove() } catch (_e) { /* ignore */ }
      videoEl = null
    }
    // FaceMesh / WASM module intentionally kept alive: Emscripten does not support
    // re-initialization after .close(). Camera is stopped above; faceMesh.send()
    // is gated by `running` so no frames are processed until startCamera() is called again.
  }

  /**
   * Exponential-backoff camera recovery.
   * Signal the ISOLATED watchdog via postMessage so it doesn't race getUserMedia.
   * @param {string} reason
   */
  async function _recoverCamera(reason) {
    if (recovering || userRequestedCameraStop) return
    recovering = true
    window.postMessage({ type: 'NODEX_BRIDGE_RECOVERING' }, '*')
    console.warn('[Nodex Bridge] Recovering camera:', reason)

    const delay = Math.min(
      RECOVERY_BASE_DELAY_MS * Math.pow(2, recoveryAttempt),
      RECOVERY_MAX_DELAY_MS,
    )
    recoveryAttempt++

    try {
      await stopCamera()
      if (userRequestedCameraStop) return

      await new Promise((r) => setTimeout(r, delay))
      if (userRequestedCameraStop) return

      // FaceMesh already initialized — only restart the camera stream.
      await startCamera()
      console.warn('[Nodex Bridge] Recovery succeeded')
    } catch (err) {
      console.error('[Nodex Bridge] Recovery failed:', err)
      window.postMessage({
        type: 'NODEX_BRIDGE_ERROR',
        error: 'Camera lost. Click Stop then Start to reconnect.',
      }, '*')
    } finally {
      recovering = false
      window.postMessage({ type: 'NODEX_BRIDGE_RECOVERED' }, '*')
    }
  }

  // ── Message handler ────────────────────────────────────────────────────────

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return

    switch (e.data?.type) {

      case 'NODEX_HEALTH_CHECK': {
        const hasStream  = !!(videoEl?.srcObject)
        const paused     = !!(videoEl?.paused)
        let trackState   = null
        if (videoEl?.srcObject) {
          const t = videoEl.srcObject.getVideoTracks()[0]
          trackState = t ? t.readyState : null
        }
        window.postMessage({
          type: 'NODEX_HEALTH_CHECK_RESULT',
          requestId:  e.data.requestId,
          hasStream,
          trackState,
          paused,
          recovering,
        }, '*')
        break
      }

      case 'NODEX_START_CAMERA': {
        if (running) break
        userRequestedCameraStop = false
        baseUrl = e.data.extensionBaseUrl || ''
        try {
          await initMediaPipe()
          await startCamera()
        } catch (err) {
          await stopCamera()
          const name = err?.name ?? ''
          if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
            window.postMessage({ type: 'NODEX_CAMERA_DENIED' }, '*')
            break
          }
          console.error('[Nodex Bridge] init failed:', err)
          const raw = err?.message ?? String(err)
          const msg = /initialize|FaceMesh|fetch|load|wasm/i.test(raw)
            ? 'Failed to load MediaPipe. Try reloading the page.'
            : raw
          window.postMessage({ type: 'NODEX_BRIDGE_ERROR', error: msg }, '*')
        }
        break
      }

      case 'NODEX_STOP_CAMERA': {
        userRequestedCameraStop = true
        recovering = false   // cancel any in-flight recovery
        await stopCamera()
        break
      }

      default:
        break
    }
  })
})()
