(function () {
  'use strict'

  const FACE_MESH_OPTIONS = {
    maxNumFaces: 1,
    refineLandmarks: false,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  }

  const POLL_TIMEOUT_MS  = 15000
  const POLL_INTERVAL_MS = 100

  let faceMesh = null
  let camera   = null
  let videoEl  = null
  let running  = false
  let baseUrl  = ''

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

  /**
   * face_mesh.js's patched Vb() dispatches __nodex_load_script with {url, id}.
   * We relay through the isolated world → service worker → chrome.scripting.executeScript,
   * which completely bypasses YouTube's Trusted Types CSP.
   */
  window.addEventListener('__nodex_load_script', (e) => {
    const { url, id } = e.detail || {}
    if (!url || !id) return

    let relativePath = url
    if (url.startsWith('chrome-extension://')) {
      const pathStart = url.indexOf('/', 'chrome-extension://'.length)
      if (pathStart !== -1) relativePath = url.substring(pathStart + 1)
    }

    window.postMessage({
      type: 'NODEX_INJECT_SCRIPT',
      path: relativePath,
      requestId: id,
    }, '*')
  })

  window.addEventListener('message', (e) => {
    if (e.source !== window) return
    if (e.data?.type === 'NODEX_INJECT_SCRIPT_RESULT' && e.data.requestId) {
      window.dispatchEvent(new CustomEvent('__nodex_script_loaded', {
        detail: { id: e.data.requestId },
      }))
    }
  })

  async function initMediaPipe() {
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
        if (lm) window.postMessage({ type: 'NODEX_LANDMARKS', data: lm }, '*')
      } catch (_e) {
        /* skip malformed frame */
      }
    })

    await faceMesh.initialize()
  }

  async function startCamera() {
    videoEl = document.createElement('video')
    videoEl.setAttribute('playsinline', '')
    videoEl.muted = true
    videoEl.style.cssText = 'position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;z-index:-1;'
    document.body.appendChild(videoEl)

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'user', width: 640, height: 480 },
      audio: false,
    })
    videoEl.srcObject = stream
    await videoEl.play()

    camera = new Camera(videoEl, {
      onFrame: async () => {
        if (!faceMesh || !running) return
        await faceMesh.send({ image: videoEl })
      },
      width: 640,
      height: 480,
    })
    camera.start()
    running = true
    window.postMessage({ type: 'NODEX_BRIDGE_READY' }, '*')
  }

  async function stopCamera() {
    running = false
    if (camera) { await camera.stop(); camera = null }
    if (videoEl) {
      const stream = videoEl.srcObject
      if (stream) for (const track of stream.getTracks()) track.stop()
      videoEl.srcObject = null
      videoEl.remove()
      videoEl = null
    }
    if (faceMesh) { faceMesh.close(); faceMesh = null }
  }

  window.addEventListener('message', async (e) => {
    if (e.source !== window) return

    if (e.data?.type === 'NODEX_START_CAMERA') {
      if (running) return
      baseUrl = e.data.extensionBaseUrl || ''
      try {
        await initMediaPipe()
        await startCamera()
      } catch (err) {
        await stopCamera()
        const name = err?.name || ''
        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          window.postMessage({ type: 'NODEX_CAMERA_DENIED' }, '*')
          return
        }
        console.error('[Nodex] Bridge init failed:', err)
        const raw = err?.message || String(err)
        const msg = /initialize|FaceMesh|fetch|load|wasm/i.test(raw)
          ? 'Failed to load MediaPipe. Try reloading the page.'
          : raw
        window.postMessage({ type: 'NODEX_BRIDGE_ERROR', error: msg }, '*')
      }
    }

    if (e.data?.type === 'NODEX_STOP_CAMERA') {
      await stopCamera()
    }
  })
})()
