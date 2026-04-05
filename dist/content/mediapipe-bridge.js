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

  /**
   * YouTube's TrustedTypes policy blocks everything that sets script content:
   *   - script.src / setAttribute('src')  → TrustedScriptURL
   *   - script.textContent                → TrustedScript
   *   - Function(code) / eval(code)       → TrustedScript
   *
   * The ONLY bypass: chrome.scripting.executeScript() from the extension's
   * service worker. Extension-level script injection bypasses ALL page CSP
   * and TrustedTypes policies — it runs at browser privilege level.
   *
   * Strategy:
   * 1. Patch document.createElement('script') before face_mesh.js loads
   * 2. When face_mesh.js calls script.setAttribute('src', url):
   *    - Intercept it
   *    - postMessage to ISOLATED world (index.js)
   *    - index.js forwards to SW via chrome.runtime.sendMessage
   *    - SW uses chrome.scripting.executeScript with world:'MAIN' to inject the file
   *    - SW responds with ok:true
   *    - We fire 'load' event on the script element
   *
   * This is the same mechanism already used for face_mesh.js itself — we just
   * extend it to cover the additional scripts MediaPipe loads during initialize().
   */
  const _origCreateElement = document.createElement.bind(document)
  let _patchActive = false

  document.createElement = function(tagName, ...args) {
    const el = _origCreateElement(tagName, ...args)

    if (_patchActive && typeof tagName === 'string' && tagName.toLowerCase() === 'script') {
      const _origSetAttr = el.setAttribute.bind(el)

      el.setAttribute = function(name, value) {
        if (name === 'src' && value) {
          // Ask SW to inject this file via executeScript (bypasses TrustedTypes)
          // Use postMessage → ISOLATED world → SW pipeline
          const msgType = 'NODEX_INJECT_SCRIPT_URL'
          const resultType = 'NODEX_INJECT_SCRIPT_URL_RESULT'
          const requestId = Math.random().toString(36).slice(2)

          const timeoutId = setTimeout(() => {
            window.removeEventListener('message', handler)
            console.error('[Nodex Bridge] Timeout injecting script:', value)
            el.dispatchEvent(new Event('error'))
          }, 10000)

          function handler(e) {
            if (e.source !== window) return
            if (e.data?.type !== resultType) return
            if (e.data?.requestId !== requestId) return
            clearTimeout(timeoutId)
            window.removeEventListener('message', handler)
            if (e.data.ok) {
              el.dispatchEvent(new Event('load'))
            } else {
              console.error('[Nodex Bridge] SW inject failed:', e.data.error)
              el.dispatchEvent(new Event('error'))
            }
          }

          window.addEventListener('message', handler)
          window.postMessage({ type: msgType, url: value, requestId }, '*')
          return
        }
        return _origSetAttr(name, value)
      }
    }

    return el
  }

  _patchActive = true

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

  async function initMediaPipe() {
    await requestMediaPipeInjection()
    await waitForGlobal('FaceMesh')
    await waitForGlobal('Camera')

    faceMesh = new FaceMesh({
      locateFile: (file) => baseUrl + 'assets/mediapipe/' + file,
    })
    faceMesh.setOptions(FACE_MESH_OPTIONS)
    faceMesh.onResults((results) => {
      if (!running) return
      const lm = results.multiFaceLandmarks?.[0]
      if (lm) window.postMessage({ type: 'NODEX_LANDMARKS', data: lm }, '*')
    })

    await faceMesh.initialize()
    _patchActive = false
  }

  async function startCamera() {
    videoEl = _origCreateElement('video')
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
    _patchActive = false
    document.createElement = _origCreateElement
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
        _patchActive = false
        console.error('[Nodex Bridge] init failed:', err)
        window.postMessage({ type: 'NODEX_BRIDGE_ERROR', error: err.message }, '*')
      }
    }

    if (e.data?.type === 'NODEX_STOP_CAMERA') {
      await stopCamera()
    }
  })
})()
