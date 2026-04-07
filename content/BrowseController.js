import { COMMANDS } from '../shared/constants/commands.js'

/**
 * Главная YouTube отдаётся с сервера почти без сетки — фид строится в браузере (custom elements
 * ytd-rich-grid-renderer → ytd-rich-grid-row → ytd-rich-item-renderer → a#thumbnail).
 * Селекторы ниже соответствуют этой модели; «пустые» ячейки сетки помечаются is-empty.
 */
const PRIMARY_SELECTORS = [
  'ytd-rich-item-renderer a#thumbnail',
  'ytd-video-renderer a#thumbnail',
  'ytd-compact-video-renderer a#thumbnail',
  'ytd-grid-video-renderer a#thumbnail',
  'ytd-reel-item-renderer a#thumbnail',
  'ytd-rich-grid-media a#thumbnail',
]

/** Primary path fails on some layouts / before paint — include Shorts (`/shorts/id`). */
const FALLBACK_SELECTOR = 'a[href*="/watch?v="], a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'
/** Geometric row break for thumbnails not under a known DOM row container. */
const ROW_BREAK_PX = 48
const MUTATION_DEBOUNCE_MS = 800
const SCROLL_TRACK_MS = 400
const PERIODIC_SCAN_MS = 2500
/** Минимум между browse-командами движения (жесты не должны давать двойной шаг). */
const BROWSE_COMMAND_COOLDOWN_MS = 700

const OBSERVER_ROOT_SELECTORS = [
  'ytd-rich-grid-renderer',
  'ytd-section-list-renderer',
  'ytd-watch-next-secondary-results-renderer',
]

/** watch / embed / short URLs — для dedupe на главной и в полках */
function videoIdFromHref(href) {
  if (!href || typeof href !== 'string') return null
  let m = href.match(/[?&]v=([^&]+)/)
  if (m) return m[1]
  m = href.match(/\/shorts\/([^/?&#]+)/)
  if (m) return m[1]
  return null
}

function hrefMatchesFocus(stored, elHref) {
  if (!stored || !elHref) return false
  if (stored === elHref) return true
  const a = videoIdFromHref(stored)
  const b = videoIdFromHref(elHref)
  return Boolean(a && b && a === b)
}

function findBrowseObserverRoot() {
  for (const sel of OBSERVER_ROOT_SELECTORS) {
    const el = document.querySelector(sel)
    if (el) return el
  }
  return document.querySelector('ytd-app') ?? document.body
}

function isGhostOrAdThumbnail(el) {
  const rich = el.closest?.('ytd-rich-item-renderer')
  if (rich?.hasAttribute?.('is-empty')) return true
  if (el.closest?.('ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer')) {
    return true
  }
  return false
}

/** One thumbnail per video — duplicate anchors (e.g. hover preview + main) confuse order. */
function dedupeThumbnails(items, rects) {
  const area = (el) => {
    const r = rects.get(el)
    if (!r) return 0
    return r.width * r.height
  }
  const bestById = new Map()
  for (const el of items) {
    const id = videoIdFromHref(el.href)
    if (!id) continue
    const prev = bestById.get(id)
    if (!prev || area(el) > area(prev)) bestById.set(id, el)
  }
  const out = []
  const seen = new Set()
  for (const el of items) {
    const id = videoIdFromHref(el.href)
    if (id) {
      if (bestById.get(id) !== el) continue
    }
    if (seen.has(el)) continue
    seen.add(el)
    out.push(el)
  }
  return out
}

function getDomRowRoot(el) {
  if (!el?.closest) return null
  const gridRow = el.closest('ytd-rich-grid-row')
  if (gridRow) return gridRow
  return el.closest(
    'ytd-rich-shelf-renderer, ytd-reel-shelf-renderer, ytd-channel-featured-content-renderer',
  )
}

function minTopInRow(row, rects) {
  let m = Infinity
  for (const el of row) {
    const t = rects.get(el)?.top
    if (typeof t === 'number' && t < m) m = t
  }
  return m === Infinity ? 0 : m
}

/** Rows for items without a DOM row root (sorted by top, then left). */
function buildGeometricRows(items, rects, rowBreakPx) {
  if (items.length === 0) return []

  const rows = []
  let currentRow = [items[0]]
  let anchorTop = rects.get(items[0])?.top ?? 0
  let rowMaxTop = anchorTop

  for (let i = 1; i < items.length; i++) {
    const item = items[i]
    const top = rects.get(item)?.top ?? anchorTop
    rowMaxTop = Math.max(rowMaxTop, top)
    const breakLine = Math.max(anchorTop + rowBreakPx, rowMaxTop + 16)
    if (top > breakLine) {
      currentRow.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
      rows.push(currentRow)
      currentRow = [item]
      anchorTop = top
      rowMaxTop = top
    } else {
      currentRow.push(item)
    }
  }
  currentRow.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
  rows.push(currentRow)
  return rows
}

/**
 * DOM-backed rows (grid row / shelf) plus geometric clusters for the rest.
 * Rows are ordered by minimum top.
 */
function buildRows(items, rects, rowBreakPx) {
  const domMap = new Map()
  const noDom = []

  for (const el of items) {
    const root = getDomRowRoot(el)
    if (root) {
      if (!domMap.has(root)) domMap.set(root, [])
      domMap.get(root).push(el)
    } else {
      noDom.push(el)
    }
  }

  const domRows = []
  for (const rowItems of domMap.values()) {
    rowItems.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
    domRows.push(rowItems)
  }

  noDom.sort((a, b) => {
    const ar = rects.get(a) ?? { top: 0, left: 0 }
    const br = rects.get(b) ?? { top: 0, left: 0 }
    const dt = ar.top - br.top
    if (Math.abs(dt) < 0.5) return ar.left - br.left
    return dt
  })

  const geoRows = buildGeometricRows(noDom, rects, rowBreakPx)
  const allRows = [...domRows, ...geoRows]
  allRows.sort((a, b) => minTopInRow(a, rects) - minTopInRow(b, rects))
  return allRows
}

export class BrowseController {
  constructor() {
    this._focusIndex = -1
    this._focusedElement = null
    this._focusRing = null
    this._currentItems = []
    this._rows = []
    this._retryTimer = null
    this._observer = null
    this._scrollRaf = null
    this._scrollTrackTimer = null
    this._periodicTimer = null
    this._lastScanTime = 0
    this._lastCommandAt = 0
    this._focusedHref = null
    this._itemListSignature = null
    this._mutationDebounce = null
    this._onScroll = this._handleScroll.bind(this)
  }

  activate() {
    this.deactivate()
    this._createFocusRing()
    this._scanItems()
    this._focusFirstVisible()

    this._observer = new MutationObserver(() => {
      clearTimeout(this._mutationDebounce)
      this._mutationDebounce = setTimeout(() => {
        this._mutationDebounce = null
        this._scanItems()
      }, MUTATION_DEBOUNCE_MS)
    })

    const container = findBrowseObserverRoot()
    this._observer.observe(container, { subtree: true, childList: true })
    window.addEventListener('scroll', this._onScroll, { passive: true })

    this._periodicTimer = setInterval(() => {
      this._scanItems()
      if (this._focusIndex < 0 && this._currentItems.length > 0) {
        this._focusFirstVisible()
      }
    }, PERIODIC_SCAN_MS)

    if (this._currentItems.length === 0) {
      this._scheduleRetry()
    }

    return this._currentItems.length
  }

  deactivate() {
    clearTimeout(this._mutationDebounce)
    this._mutationDebounce = null
    clearTimeout(this._retryTimer)
    clearTimeout(this._scrollTrackTimer)
    clearInterval(this._periodicTimer)
    cancelAnimationFrame(this._scrollRaf)
    this._observer?.disconnect()
    this._observer = null
    window.removeEventListener('scroll', this._onScroll)

    if (this._focusRing) {
      this._focusRing.remove()
      this._focusRing = null
    }

    this._focusIndex = -1
    this._focusedElement = null
    this._currentItems = []
    this._rows = []
    this._lastCommandAt = 0
    this._focusedHref = null
    this._itemListSignature = null
  }

  /**
   * @returns {boolean|'edge'} true if applied, 'edge' if at boundary, false if no items
   */
  execute(command) {
    if (document.querySelector('.ad-showing')) return false

    const isMovement =
      command === COMMANDS.SKIP || command === COMMANDS.REWIND ||
      command === COMMANDS.VOL_UP || command === COMMANDS.VOL_DOWN

    if (isMovement) {
      const now = performance.now()
      if (now - this._lastCommandAt < BROWSE_COMMAND_COOLDOWN_MS) return false
      this._lastCommandAt = now
    }

    if (!this._ensureItems()) return false

    switch (command) {
      case COMMANDS.SKIP:       return this._moveFocus(1)
      case COMMANDS.REWIND:     return this._moveFocus(-1)
      case COMMANDS.VOL_UP:     return this._moveFocusVertical(-1)
      case COMMANDS.VOL_DOWN:   return this._moveFocusVertical(1)
      case COMMANDS.PLAY_PAUSE: return this._selectCurrent()
      default:                  return false
    }
  }

  _ensureItems() {
    const focused = this._currentItems[this._focusIndex]
    if (focused?.isConnected) return true

    this._scanItems()
    if (this._currentItems.length === 0) return false

    if (this._focusIndex < 0 || this._focusIndex >= this._currentItems.length) {
      this._focusFirstVisible()
    }
    return this._currentItems.length > 0
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
      transition: 'top 0.15s ease, left 0.15s ease, width 0.15s ease, height 0.15s ease',
      display: 'none',
    })
    document.body.appendChild(ring)
    this._focusRing = ring
  }

  _focusFirstVisible() {
    if (this._currentItems.length === 0) return
    const vpH = window.innerHeight

    for (let i = 0; i < this._currentItems.length; i++) {
      const el = this._currentItems[i]
      if (!el.isConnected) continue
      const r = el.getBoundingClientRect()
      if (r.bottom > 0 && r.top < vpH && r.height > 0) {
        this._setFocus(i)
        return
      }
    }

    this._setFocus(0)
  }

  _scheduleRetry() {
    clearTimeout(this._retryTimer)
    let attempts = 0
    const retry = () => {
      attempts++
      this._scanItems()
      if (this._currentItems.length > 0) {
        this._focusFirstVisible()
        return
      }
      if (attempts < 10) this._retryTimer = setTimeout(retry, 600)
    }
    this._retryTimer = setTimeout(retry, 500)
  }

  _scanItems() {
    this._lastScanTime = Date.now()

    let items = this._queryVisibleItems(PRIMARY_SELECTORS.join(','))
      .filter((el) => !isGhostOrAdThumbnail(el))

    if (items.length === 0) {
      items = this._queryVisibleItems(FALLBACK_SELECTOR)
        .filter((el) => {
          if (isGhostOrAdThumbnail(el)) return false
          if (el.closest('ytd-playlist-renderer, #masthead')) return false
          if (el.href?.includes('&list=')) return false
          const r = el.getBoundingClientRect()
          return r.width >= 100 && r.height >= 60
        })
    }

    if (items.length === 0) {
      this._rows = []
      this._currentItems = []
      this._focusIndex = -1
      this._focusedElement = null
      this._focusedHref = null
      this._itemListSignature = null
      if (this._focusRing) this._focusRing.style.display = 'none'
      return
    }

    const rects = new Map()
    for (const el of items) {
      rects.set(el, el.getBoundingClientRect())
    }

    items = dedupeThumbnails(items, rects)

    items.sort((a, b) => {
      const ar = rects.get(a) ?? { top: 0, left: 0 }
      const br = rects.get(b) ?? { top: 0, left: 0 }
      const dt = ar.top - br.top
      if (Math.abs(dt) < 0.5) return ar.left - br.left
      return dt
    })

    const nextSig = {
      count: items.length,
      firstHref: items[0]?.href ?? '',
      lastHref: items[items.length - 1]?.href ?? '',
    }
    if (
      this._itemListSignature &&
      nextSig.count === this._itemListSignature.count &&
      nextSig.firstHref === this._itemListSignature.firstHref &&
      nextSig.lastHref === this._itemListSignature.lastHref
    ) {
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      return
    }
    this._itemListSignature = nextSig

    this._rows = buildRows(items, rects, ROW_BREAK_PX)
    items = this._rows.flat()
    this._currentItems = items

    if (this._focusedHref) {
      const byHref = items.findIndex((el) => hrefMatchesFocus(this._focusedHref, el.href))
      if (byHref >= 0) {
        this._focusIndex = byHref
        this._focusedElement = items[byHref]
        this._highlightItem(byHref)
        return
      }
    }

    const prevFocused = this._focusedElement
    if (prevFocused && prevFocused.isConnected) {
      const newIdx = items.indexOf(prevFocused)
      if (newIdx >= 0) {
        this._focusIndex = newIdx
        this._focusedElement = prevFocused
        this._highlightItem(this._focusIndex)
        return
      }
    }

    if (
      prevFocused &&
      (!prevFocused.isConnected || items.indexOf(prevFocused) < 0)
    ) {
      if (items.length > 0) this._focusFirstVisible()
      return
    }

    if (
      this._focusIndex >= 0 &&
      this._focusIndex < items.length &&
      items[this._focusIndex]?.isConnected
    ) {
      this._focusedElement = items[this._focusIndex]
      this._highlightItem(this._focusIndex)
      return
    }

    if (items.length > 0) this._focusFirstVisible()
  }

  _queryVisibleItems(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
  }

  _findRowCol() {
    if (this._focusIndex < 0) return null
    const el = this._currentItems[this._focusIndex]
    if (!el) return null
    for (let r = 0; r < this._rows.length; r++) {
      const c = this._rows[r].indexOf(el)
      if (c >= 0) return { rowIdx: r, colIdx: c }
    }
    return null
  }

  _moveFocus(delta) {
    if (this._rows.length === 0 || this._currentItems.length === 0) return false

    let rc = this._findRowCol()
    if (!rc) {
      this._scanItems()
      rc = this._findRowCol()
    }
    if (!rc) return false

    const { rowIdx, colIdx } = rc
    const row = this._rows[rowIdx]
    const newCol = colIdx + delta
    if (newCol < 0 || newCol >= row.length) return 'edge'

    const target = row[newCol]
    if (!target?.isConnected) {
      this._scanItems()
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      return 'edge'
    }

    const newIdx = this._currentItems.indexOf(target)
    if (newIdx < 0) return 'edge'

    this._setFocus(newIdx)
    target.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    this._trackScrollPosition()
    return true
  }

  _moveFocusVertical(direction) {
    if (this._rows.length === 0 || this._focusIndex < 0) return false

    const current = this._currentItems[this._focusIndex]
    if (!current?.isConnected) {
      this._scanItems()
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      return 'edge'
    }

    let curRowIdx = this._rows.findIndex((row) => row.includes(current))
    if (curRowIdx < 0) {
      this._scanItems()
      curRowIdx = this._rows.findIndex((row) => row.includes(current))
    }
    if (curRowIdx < 0) return false

    const targetRowIdx = curRowIdx + direction
    if (targetRowIdx < 0 || targetRowIdx >= this._rows.length) return 'edge'

    const rect = current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const targetRow = this._rows[targetRowIdx]

    let closest = null, closestDist = Infinity
    for (const item of targetRow) {
      if (!item.isConnected) continue
      const ir = item.getBoundingClientRect()
      const dist = Math.abs(ir.left + ir.width / 2 - centerX)
      if (dist < closestDist) { closestDist = dist; closest = item }
    }

    if (!closest) return 'edge'

    const newIdx = this._currentItems.indexOf(closest)
    if (newIdx < 0) return 'edge'

    this._setFocus(newIdx)
    closest.scrollIntoView({ behavior: 'smooth', block: 'center' })
    this._trackScrollPosition()
    return true
  }

  _setFocus(index) {
    this._focusIndex = index
    this._focusedElement = this._currentItems[index] ?? null
    this._highlightItem(index)
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
    if (el.href) this._focusedHref = el.href
  }

  _trackScrollPosition() {
    clearTimeout(this._scrollTrackTimer)
    const start = Date.now()
    const tick = () => {
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      if (Date.now() - start < SCROLL_TRACK_MS) {
        this._scrollTrackTimer = setTimeout(tick, 16)
      }
    }
    tick()
  }

  _selectCurrent() {
    if (this._focusIndex < 0 || !this._currentItems[this._focusIndex]) return false
    const el = this._currentItems[this._focusIndex]

    if (el.href) {
      window.location.href = el.href
    } else {
      el.click()
    }
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
