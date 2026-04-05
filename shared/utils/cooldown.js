export class Cooldown {
  constructor(intervalMs) {
    if (typeof intervalMs !== 'number' || intervalMs < 0) {
      throw new TypeError('intervalMs must be a non-negative number')
    }
    this._interval = intervalMs
    this._lastFired = 0
  }

  canFire() {
    return Date.now() - this._lastFired >= this._interval
  }

  fire() {
    if (!this.canFire()) return false
    this._lastFired = Date.now()
    return true
  }

  reset() {
    this._lastFired = 0
  }

  setInterval(ms) {
    if (typeof ms !== 'number' || ms < 0) {
      throw new TypeError('ms must be a non-negative number')
    }
    this._interval = ms
  }
}
