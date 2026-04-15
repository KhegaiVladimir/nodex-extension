import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Cooldown } from '../shared/utils/cooldown.js'

describe('Cooldown', () => {

  describe('constructor', () => {
    it('accepts zero interval (always ready)', () => {
      expect(() => new Cooldown(0)).not.toThrow()
    })

    it('accepts positive interval', () => {
      expect(() => new Cooldown(500)).not.toThrow()
    })

    it('throws on negative interval', () => {
      expect(() => new Cooldown(-1)).toThrow(TypeError)
    })

    it('throws on non-numeric interval', () => {
      expect(() => new Cooldown('500')).toThrow(TypeError)
      expect(() => new Cooldown(null)).toThrow(TypeError)
      expect(() => new Cooldown(undefined)).toThrow(TypeError)
    })
  })

  it('throws on NaN interval', () => {
    expect(() => new Cooldown(NaN)).toThrow(TypeError)
  })

  it('throws on Infinity interval', () => {
    expect(() => new Cooldown(Infinity)).toThrow(TypeError)
  })

  it('throws on -Infinity interval', () => {
    expect(() => new Cooldown(-Infinity)).toThrow(TypeError)
  })

  describe('canFire / fire — zero interval', () => {
    it('canFire is true immediately after construction', () => {
      const cd = new Cooldown(0)
      expect(cd.canFire()).toBe(true)
    })

    it('fire() returns true when ready', () => {
      expect(new Cooldown(0).fire()).toBe(true)
    })

    it('fire() returns true again immediately after previous fire (interval=0)', () => {
      const cd = new Cooldown(0)
      cd.fire()
      expect(cd.fire()).toBe(true)
    })

    it('all consecutive fire() calls return true at interval=0', () => {
      const cd = new Cooldown(0)
      for (let i = 0; i < 10; i++) {
        expect(cd.fire()).toBe(true)
      }
    })
  })

  describe('canFire / fire — positive interval', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('canFire is true on a brand-new cooldown before any fire (lastFired starts at epoch 0)', () => {
      // Date.now() >> 500 so Date.now() - 0 >= 500 is immediately true.
      const cd = new Cooldown(500)
      expect(cd.canFire()).toBe(true)
    })

    it('blocks second fire within interval', () => {
      const cd = new Cooldown(500)
      cd.fire()
      expect(cd.fire()).toBe(false)
    })

    it('fire() returns exactly false (not just a falsy value) when blocked', () => {
      const cd = new Cooldown(500)
      cd.fire()
      const result = cd.fire()
      expect(result).toBe(false)  // strict boolean false, not null / undefined / 0
    })

    it('canFire is false immediately after fire', () => {
      const cd = new Cooldown(500)
      cd.fire()
      expect(cd.canFire()).toBe(false)
    })

    it('allows fire after interval has elapsed', () => {
      const cd = new Cooldown(500)
      cd.fire()
      vi.advanceTimersByTime(500)
      expect(cd.fire()).toBe(true)
    })

    it('is still blocked 1 ms before interval expires', () => {
      const cd = new Cooldown(500)
      cd.fire()
      vi.advanceTimersByTime(499)
      expect(cd.canFire()).toBe(false)
    })
  })

  describe('reset()', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    it('restores canFire immediately even within interval', () => {
      const cd = new Cooldown(10_000)
      cd.fire()
      expect(cd.canFire()).toBe(false)
      cd.reset()
      expect(cd.canFire()).toBe(true)
    })

    it('fire() after reset returns true', () => {
      const cd = new Cooldown(10_000)
      cd.fire()
      cd.reset()
      expect(cd.fire()).toBe(true)
    })
  })

  describe('setInterval()', () => {
    it('throws on invalid value', () => {
      const cd = new Cooldown(100)
      expect(() => cd.setInterval(-1)).toThrow(TypeError)
      expect(() => cd.setInterval('x')).toThrow(TypeError)
    })

    it('throws on NaN', () => {
      const cd = new Cooldown(100)
      expect(() => cd.setInterval(NaN)).toThrow(TypeError)
    })

    it('throws on Infinity', () => {
      const cd = new Cooldown(100)
      expect(() => cd.setInterval(Infinity)).toThrow(TypeError)
    })

    it('setInterval(0) makes a previously-blocked cooldown fire-ready immediately', () => {
      vi.useFakeTimers()
      const cd = new Cooldown(10_000)
      cd.fire()
      expect(cd.canFire()).toBe(false)
      cd.setInterval(0)                  // collapse to zero-wait
      expect(cd.canFire()).toBe(true)
      expect(cd.fire()).toBe(true)
    })

    it('lengthening the interval blocks a previously-allowed fire', () => {
      vi.useFakeTimers()
      const cd = new Cooldown(100)
      cd.fire()
      vi.advanceTimersByTime(100)     // interval has passed
      cd.setInterval(10_000)          // extend to 10 s
      expect(cd.canFire()).toBe(false) // now blocked again
    })

    it('shortening the interval immediately allows fire', () => {
      vi.useFakeTimers()
      const cd = new Cooldown(10_000)
      cd.fire()
      vi.advanceTimersByTime(200)      // only 200 ms elapsed
      cd.setInterval(100)              // shorten to 100 ms
      expect(cd.canFire()).toBe(true)  // 200 ms > new 100 ms interval
    })
  })

})
