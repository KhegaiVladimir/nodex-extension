const POLL_TIMEOUT_MS  = 10_000
const POLL_INTERVAL_MS = 100

const FACE_MESH_OPTIONS = {
  maxNumFaces: 1,
  refineLandmarks: false,
  minDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
}

export class FaceEngine {
  /**
   * @param {HTMLVideoElement} videoEl — video element to feed into Camera
   * @param {(landmarks: Array<{x:number,y:number,z:number}>) => void} onFrame
   */
  constructor(videoEl, onFrame) {
    if (!(videoEl instanceof HTMLVideoElement)) {
      throw new TypeError('videoEl must be an HTMLVideoElement')
    }
    if (typeof onFrame !== 'function') {
      throw new TypeError('onFrame must be a function')
    }

    this._videoEl  = videoEl
    this._onFrame  = onFrame
    this._faceMesh = null
    this._camera   = null
    this._destroyed = false
    this._initialized = false
    this._FaceMeshClass = null
    this._CameraClass   = null
  }

  async init() {
    if (this._destroyed) return
    if (this._initialized) return

    const faceMeshCode = await this._loadAsText(
      chrome.runtime.getURL('assets/mediapipe/face_mesh.js'),
    )
    const cameraCode = await this._loadAsText(
      chrome.runtime.getURL('assets/mediapipe/camera_utils.js'),
    )

    const script = document.createElement('script')
    script.textContent = faceMeshCode + '\n' + cameraCode
    document.head.appendChild(script)
    script.remove()

    await this._waitForGlobal('FaceMesh')
    await this._waitForGlobal('Camera')

    this._FaceMeshClass = window.FaceMesh
    this._CameraClass   = window.Camera

    this._faceMesh = new this._FaceMeshClass({
      locateFile: (file) =>
        chrome.runtime.getURL('assets/mediapipe/' + file),
    })

    this._faceMesh.setOptions(FACE_MESH_OPTIONS)

    this._faceMesh.onResults((results) => {
      if (this._destroyed) return
      const lm = results.multiFaceLandmarks?.[0]
      if (lm) this._onFrame(lm)
    })

    await this._faceMesh.initialize()
    this._initialized = true
  }

  /**
   * Creates Camera and starts sending frames to FaceMesh.
   */
  start() {
    if (this._destroyed || !this._initialized) return
    if (this._camera) return

    this._camera = new this._CameraClass(this._videoEl, {
      onFrame: async () => {
        if (this._destroyed || !this._faceMesh) return
        await this._faceMesh.send({ image: this._videoEl })
      },
      width: 640,
      height: 480,
    })
    this._camera.start()
  }

  /**
   * Stops the camera loop without tearing down FaceMesh.
   */
  async stop() {
    if (!this._camera) return
    await this._camera.stop()
    this._camera = null
  }

  /**
   * Full cleanup — stops camera, closes FaceMesh, marks as destroyed.
   */
  async destroy() {
    if (this._destroyed) return
    this._destroyed = true

    await this.stop()

    if (this._faceMesh) {
      this._faceMesh.close()
      this._faceMesh = null
    }

    this._onFrame = null
    this._videoEl = null
    this._FaceMeshClass = null
    this._CameraClass   = null
    this._initialized = false
  }

  /**
   * Fetches a script URL as plain text.
   * Used to bypass CSP restrictions on dynamic <script src> injection.
   */
  async _loadAsText(url) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`[Nodex] Не удалось загрузить: ${url}`)
    }
    return response.text()
  }

  /**
   * Polls until window[globalName] is defined.
   * MediaPipe scripts may initialize their globals asynchronously
   * after inline script execution.
   */
  _waitForGlobal(globalName) {
    if (window[globalName] !== undefined) return Promise.resolve()

    return new Promise((resolve, reject) => {
      const deadline = Date.now() + POLL_TIMEOUT_MS
      const poll = setInterval(() => {
        if (window[globalName] !== undefined) {
          clearInterval(poll)
          resolve()
        } else if (Date.now() > deadline) {
          clearInterval(poll)
          reject(new Error(
            `[Nodex] ${globalName} недоступен — проверь web_accessible_resources`,
          ))
        }
      }, POLL_INTERVAL_MS)
    })
  }
}
