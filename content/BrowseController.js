import { COMMANDS } from '../shared/constants/commands.js'

const PRIMARY_SELECTORS = [
  'ytd-rich-item-renderer a#thumbnail',
  'ytd-video-renderer a#thumbnail',
  'ytd-compact-video-renderer a#thumbnail',
  'ytd-grid-video-renderer a#thumbnail',
  'ytd-reel-item-renderer a#thumbnail',
]

const FALLBACK_SELECTOR = 'a[href*="/watch?v="]'
const ROW_TOLERANCE = 40

export class BrowseController {
  constructor() {
    this._focusIndex = -1
    this._focusRing = null
    this._currentItems = []
    this._rows = []
    this._scanDebounce = null
    this._retryTimer = null
    this._observer = null
    this._scrollRaf = null
    this._onScroll = this._handleScroll.bind(this)
  }

  activate() {
    this.deactivate()
    this._createFocusRing()
    this._scanItems()
    this._focusFirstVisible()

    this._observer = new MutationObserver(() => {
      clearTimeout(this._scanDebounce)
      this._scanDebounce = setTimeout(() => this._scanItems(), 500)
    })
    this._observer.observe(document.body, { subtree: true, childList: true })
    window.addEventListener('scroll', this._onScroll, { passive: true })

    if (this._currentItems.length === 0) {
      this._scheduleRetry()
    }

    return this._currentItems.length
  }

  deactivate() {
    clearTimeout(this._scanDebounce)
    clearTimeout(this._retryTimer)
    cancelAnimationFrame(this._scrollRaf)
    this._observer?.disconnect()
    this._observer = null
    window.removeEventListener('scroll', this._onScroll)

    if (this._focusRing) {
      this._focusRing.remove()
      this._focusRing = null
    }

    this._focusIndex = -1
    this._currentItems = []
    this._rows = []
  }

  execute(command) {
    if (document.querySelector('.ad-showing')) return false

    switch (command) {
      case COMMANDS.SKIP:       return this._moveFocus(1)
      case COMMANDS.REWIND:     return this._moveFocus(-1)
      case COMMANDS.VOL_UP:     return this._moveFocusVertical(-1)
      case COMMANDS.VOL_DOWN:   return this._moveFocusVertical(1)
      case COMMANDS.PLAY_PAUSE: return this._selectCurrent()
      case COMMANDS.BACK:       window.history.back(); return true
      default:                  return false
    }
  }

  _createFocusRing() {
    if (this._focusRing) return
    const ring = document.createElement('div')
    ring.id = 'nodex-focus-ring'
    Object.assign(ring.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483646',
      border: '3px solid #00e5ff',
      borderRadius: '12px',
      boxShadow: '0 0 0 4px rgba(0, 229, 255, 0.2)',
      transition: 'top 0.2s ease, left 0.2s ease, width 0.2s ease, height 0.2s ease',
      display: 'none',
    })
    document.body.appendChild(ring)
    this._focusRing = ring
  }

  _focusFirstVisible() {
    if (this._currentItems.length === 0) return
    const vpBottom = window.innerHeight
    const firstVisible = this._currentItems.findIndex(el => {
      const r = el.getBoundingClientRect()
      return r.top >= 0 && r.bottom <= vpBottom
    })
    this._focusIndex = firstVisible >= 0 ? firstVisible : 0
    this._highlightItem(this._focusIndex)
  }

  _scheduleRetry() {
    clearTimeout(this._retryTimer)
    let attempts = 0
    const retry = () => {
      attempts++
      this._scanItems()
      if (this._currentItems.length > 0) return
      if (attempts < 10) this._retryTimer = setTimeout(retry, 600)
    }
    this._retryTimer = setTimeout(retry, 500)
  }

  _scanItems() {
    const hadItems = this._currentItems.length > 0

    let items = this._queryVisibleItems(PRIMARY_SELECTORS.join(','))

    if (items.length === 0) {
      items = this._queryVisibleItems(FALLBACK_SELECTOR)
        .filter(el => {
          if (el.closest('ytd-playlist-renderer, #masthead')) return false
          if (el.href?.includes('&list=')) return false
          const r = el.getBoundingClientRect()
          return r.width >= 100 && r.height >= 60
        })
    }

    if (items.length === 0) {
      const rawP = document.querySelectorAll(PRIMARY_SELECTORS.join(',')).length
      const rawF = document.querySelectorAll(FALLBACK_SELECTOR).length
      if (rawP > 0 || rawF > 0) {
        console.warn(`[Nodex Browse] Items exist but none visible. raw primary=${rawP}, raw fallback=${rawF}`)
      }
    }

    items.sort((a, b) => {
      const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect()
      return Math.abs(ar.top - br.top) < ROW_TOLERANCE
        ? ar.left - br.left
        : ar.top - br.top
    })

    this._currentItems = items

    this._rows = []
    for (const item of items) {
      const top = item.getBoundingClientRect().top
      const row = this._rows.find(
        r => Math.abs(r[0].getBoundingClientRect().top - top) < ROW_TOLERANCE,
      )
      if (row) row.push(item)
      else this._rows.push([item])
    }

    if (items.length === 0) {
      this._focusIndex = -1
    } else if (this._focusIndex >= items.length) {
      this._focusIndex = items.length - 1
    }

    if (!hadItems && items.length > 0 && this._focusIndex < 0) {
      this._focusFirstVisible()
    } else if (this._focusIndex >= 0) {
      this._highlightItem(this._focusIndex)
    }
  }

  _queryVisibleItems(selector) {
    return [...document.querySelectorAll(selector)].filter(el => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
  }

  _moveFocus(delta) {
    if (this._currentItems.length === 0) return false
    const idx = Math.max(0, Math.min(this._currentItems.length - 1, this._focusIndex + delta))
    this._highlightItem(idx)
    this._currentItems[idx].scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return true
  }

  _moveFocusVertical(direction) {
    if (this._rows.length === 0 || this._focusIndex < 0) return false
    const current = this._currentItems[this._focusIndex]
    const curRowIdx = this._rows.findIndex(row => row.includes(current))
    if (curRowIdx < 0) return false

    const targetRowIdx = curRowIdx + direction
    if (targetRowIdx < 0 || targetRowIdx >= this._rows.length) return false

    const rect = current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const targetRow = this._rows[targetRowIdx]

    let closest = targetRow[0], closestDist = Infinity
    for (const item of targetRow) {
      const ir = item.getBoundingClientRect()
      const dist = Math.abs(ir.left + ir.width / 2 - centerX)
      if (dist < closestDist) { closestDist = dist; closest = item }
    }

    const newIdx = this._currentItems.indexOf(closest)
    if (newIdx < 0) return false
    this._highlightItem(newIdx)
    closest.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    return true
  }

  _highlightItem(index) {
    this._focusIndex = index
    const el = this._currentItems[index]
    if (!el || !el.isConnected) {
      if (this._focusRing) this._focusRing.style.display = 'none'
      return
    }
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      if (this._focusRing) this._focusRing.style.display = 'none'
      return
    }
    if (!this._focusRing) return
    Object.assign(this._focusRing.style, {
      display: 'block',
      top: `${rect.top - 4}px`,
      left: `${rect.left - 4}px`,
      width: `${rect.width + 8}px`,
      height: `${rect.height + 8}px`,
    })
  }

  _selectCurrent() {
    if (this._focusIndex < 0 || !this._currentItems[this._focusIndex]) return false
    const el = this._currentItems[this._focusIndex]
    const prevUrl = location.href
    el.click()
    setTimeout(() => {
      if (location.href === prevUrl && el.href) window.location.href = el.href
    }, 500)
    return true
  }

  _handleScroll() {
    if (this._scrollRaf) return
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = null
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
    })
  }
}
