import { COMMANDS } from '../shared/constants/commands.js'

/**
 * YouTube home is served with almost no grid from the server — the feed is built in the browser
 * (custom elements ytd-rich-grid-renderer → ytd-rich-grid-row → ytd-rich-item-renderer → a#thumbnail).
 * Selectors below match that model; empty grid cells are marked is-empty.
 */
const PRIMARY_SELECTORS = [
  // New YouTube layout (2025+): yt-lockup-view-model on home, search, subscriptions
  'yt-lockup-view-model a.yt-lockup-view-model__content-image',
  // Legacy layout (if YouTube rolls back / on other pages):
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
/** Row sort: treat rows within this vertical gap as one band, tie-break by min left. */
const ROW_SORT_TOL_PX = 8
/** Second vertical in same direction within this window skips entering / chains past shelf (see _moveFocusVertical). */
const VERTICAL_SKIP_MS = 1500
const MUTATION_DEBOUNCE_MS = 800
const SCROLL_TRACK_MS = 400
const PERIODIC_SCAN_MS = 5000
/** Minimum gap between browse movement commands (gestures must not double-step). */
const BROWSE_COMMAND_COOLDOWN_MS = 700

const OBSERVER_ROOT_SELECTORS = [
  'ytd-rich-grid-renderer',
  'ytd-section-list-renderer',
  'ytd-watch-next-secondary-results-renderer',
]

/** watch / embed / short URLs — for dedupe on home and in shelves */
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

function minLeftInRow(row, rects) {
  let m = Infinity
  for (const el of row) {
    const l = rects.get(el)?.left
    if (typeof l === 'number' && l < m) m = l
  }
  return m === Infinity ? 0 : m
}

function compareRowsByVisualOrder(a, b, rects) {
  const minTopA = minTopInRow(a, rects)
  const minTopB = minTopInRow(b, rects)
  if (Math.abs(minTopA - minTopB) >= ROW_SORT_TOL_PX) return minTopA - minTopB
  return minLeftInRow(a, rects) - minLeftInRow(b, rects)
}

function isShelfRow(row) {
  const el = row[0]
  if (!el?.closest) return false
  return Boolean(el.closest('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer'))
}

/**
 * Group flat-grid items into rows by vertical clustering.
 *
 * Previously we bucketed by Math.round(top / rowStep), which is unstable on
 * bucket boundaries — a 2px difference between cards in the same visual row
 * could round them into different buckets, fragmenting the row.
 *
 * Now we sort by top and walk sequentially: if the gap to the previous item
 * exceeds a threshold, start a new row. This is robust to pixel-level noise
 * from badges ("Live", "Ad") and sub-pixel rendering.
 */
function buildRows(items, rects, _rowBreakPx) {
  if (items.length === 0) return []

  // 1. Separate shelf items from flat-grid items.
  const shelfMap = new Map()
  const flat = []

  for (const el of items) {
    const shelf = el.closest?.('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer')
    if (shelf) {
      if (!shelfMap.has(shelf)) shelfMap.set(shelf, [])
      shelfMap.get(shelf).push(el)
    } else {
      flat.push(el)
    }
  }

  // 2. Compute clustering threshold from median item height.
  // Items in the same row share approximately the same top. Items in different
  // rows are separated by at least one row of title/meta text, which is
  // roughly equal to (or larger than) the thumbnail height.
  let clusterGap = 100
  if (flat.length > 0) {
    const heights = flat
      .map((el) => rects.get(el)?.height ?? 0)
      .filter((h) => h > 40)
      .sort((a, b) => a - b)
    if (heights.length > 0) {
      const median = heights[Math.floor(heights.length / 2)]
      // Gap threshold: half the median height. Items within this distance
      // vertically count as the same row. Noise from badges is typically
      // under 20px, so a threshold of 80-100px is safe.
      clusterGap = Math.max(60, median * 0.5)
    }
  }

  // 3. Sort flat items by top (tie-break by left), then cluster sequentially.
  const sortedFlat = [...flat].sort((a, b) => {
    const ar = rects.get(a) ?? { top: 0, left: 0 }
    const br = rects.get(b) ?? { top: 0, left: 0 }
    const dt = ar.top - br.top
    if (Math.abs(dt) < 1) return ar.left - br.left
    return dt
  })

  const flatRows = []
  let currentRow = []
  let currentRowTop = -Infinity

  for (const el of sortedFlat) {
    const top = rects.get(el)?.top ?? 0
    if (currentRow.length === 0 || top - currentRowTop < clusterGap) {
      currentRow.push(el)
      // Row top is the minimum top seen so far in the row (anchor).
      if (currentRow.length === 1) currentRowTop = top
      // Do NOT update currentRowTop on subsequent items — keep it as the row anchor.
    } else {
      // Gap too big → start new row.
      flatRows.push(currentRow)
      currentRow = [el]
      currentRowTop = top
    }
  }
  if (currentRow.length > 0) flatRows.push(currentRow)

  // 4. Sort items within each row by left.
  for (const row of flatRows) {
    row.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
  }

  // 5. Shelf rows: sort by left within each shelf.
  const shelfRows = []
  for (const rowItems of shelfMap.values()) {
    rowItems.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
    shelfRows.push(rowItems)
  }

  // 6. Combine and sort all rows by visual order (min top, tie-break min left).
  const allRows = [...flatRows, ...shelfRows]
  allRows.sort((a, b) => compareRowsByVisualOrder(a, b, rects))
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
    this._lastVerticalCmdAt = 0
    this._lastVerticalDirection = 0
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
      if (performance.now() - this._lastCommandAt < 1500) return
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
    this._lastVerticalCmdAt = 0
    this._lastVerticalDirection = 0
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
    if (focused?.isConnected) {
      const r = focused.getBoundingClientRect()
      const vpH = window.innerHeight
      if (r.bottom < 0 || r.top > vpH) {
        this._scanItems()
        if (this._currentItems.length > 0) this._focusFirstVisible()
      }
      return this._currentItems.length > 0
    }

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
    const tol = ROW_SORT_TOL_PX
    let bestIdx = -1
    let bestRect = null

    const isBetterVisible = (r, br) => {
      const dt = r.top - br.top
      if (Math.abs(dt) >= tol) return r.top < br.top
      return r.left < br.left
    }

    for (let i = 0; i < this._currentItems.length; i++) {
      const el = this._currentItems[i]
      if (!el.isConnected) continue
      const r = el.getBoundingClientRect()
      if (r.bottom <= 0 || r.top >= vpH || r.height <= 0) continue
      if (bestRect === null || isBetterVisible(r, bestRect)) {
        bestIdx = i
        bestRect = r
      }
    }

    if (bestIdx >= 0) {
      this._setFocus(bestIdx)
      return
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
          return r.width >= 150 && r.height >= 100
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
    this._rows = buildRows(items, rects, ROW_BREAK_PX)
    items = this._rows.flat()

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

    this._currentItems = items

    if (this._focusedHref) {
      const byHref = items.findIndex((el) => hrefMatchesFocus(this._focusedHref, el.href))
      if (byHref >= 0) {
        this._setFocus(byHref)
        this._ensureFocusInViewport()
        return
      }
    }

    const prevFocused = this._focusedElement
    if (prevFocused && prevFocused.isConnected) {
      const newIdx = items.indexOf(prevFocused)
      if (newIdx >= 0) {
        this._setFocus(newIdx)
        this._ensureFocusInViewport()
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
      this._setFocus(this._focusIndex)
      this._ensureFocusInViewport()
      return
    }

    if (items.length > 0) this._focusFirstVisible()
  }

  _ensureFocusInViewport() {
    if (this._focusIndex < 0) return
    const el = this._currentItems[this._focusIndex]
    if (!el?.isConnected) return
    const r = el.getBoundingClientRect()
    const vpH = window.innerHeight
    if (r.bottom < 0 || r.top > vpH) {
      this._focusFirstVisible()
    }
  }

  _queryVisibleItems(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
  }

  _findRowCol() {
    let synced = false

    if (this._focusedElement?.isConnected) {
      const idx = this._currentItems.indexOf(this._focusedElement)
      if (idx >= 0) {
        this._focusIndex = idx
        synced = true
      }
    }

    if (!synced && this._focusedHref) {
      const idx = this._currentItems.findIndex((e) => hrefMatchesFocus(this._focusedHref, e.href))
      if (idx >= 0) {
        this._focusIndex = idx
        this._focusedElement = this._currentItems[idx]
        synced = true
      }
    }

    if (!synced) return null

    const el = this._currentItems[this._focusIndex]
    if (!el) return null
    for (let r = 0; r < this._rows.length; r++) {
      const c = this._rows[r].indexOf(el)
      if (c >= 0) return { rowIdx: r, colIdx: c }
    }
    return null
  }

  _moveFocus(delta, shelfScrollAttempt = 0) {
    if (this._rows.length === 0 || this._currentItems.length === 0) return false

    let rc = this._findRowCol()
    if (!rc) {
      this._scanItems()
      rc = this._findRowCol()
    }
    if (!rc) return false

    const { rowIdx, colIdx } = rc
    const row = this._rows[rowIdx]
    const current = this._currentItems[this._focusIndex]
    const newCol = colIdx + delta
    if (newCol < 0 || newCol >= row.length) {
      const shelf = current?.closest?.('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer')
      if (shelf && shelfScrollAttempt < 1) {
        const container =
          shelf.querySelector('#scroll-container') ??
          shelf.querySelector('[class*="scroll-container"]')
        if (container) {
          const dir = delta > 0 ? 1 : -1
          container.scrollBy({ left: dir * 300, behavior: 'smooth' })
          setTimeout(() => {
            this._scanItems()
            this._moveFocus(delta, shelfScrollAttempt + 1)
          }, 500)
          return true
        }
      }
      return 'edge'
    }

    const target = row[newCol]
    if (!target?.isConnected) {
      this._scanItems()
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      return 'edge'
    }

    const newIdx = this._currentItems.indexOf(target)
    if (newIdx < 0) return 'edge'

    this._setFocus(newIdx)
    const r = target.getBoundingClientRect()
    const fullyVisible =
      r.top >= 0 &&
      r.bottom <= window.innerHeight &&
      r.left >= 0 &&
      r.right <= window.innerWidth
    if (!fullyVisible) {
      target.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
    this._trackScrollPosition()
    return true
  }

  _moveFocusVertical(direction, scrollDepth = 0) {
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

    const rect = current.getBoundingClientRect()
    const centerX = rect.left + rect.width / 2
    const now = performance.now()
    const inShelf = Boolean(
      current.closest('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer'),
    )

    const findNearestNonShelfIdx = (fromIdx, dir) => {
      for (let i = fromIdx + dir; i >= 0 && i < this._rows.length; i += dir) {
        if (!isShelfRow(this._rows[i])) return i
      }
      return -1
    }

    const pickClosestInRow = (rowIdx) => {
      const targetRow = this._rows[rowIdx]
      let closest = null
      let closestDist = Infinity
      for (const item of targetRow) {
        if (!item.isConnected) continue
        const ir = item.getBoundingClientRect()
        const dist = Math.abs(ir.left + ir.width / 2 - centerX)
        if (dist < closestDist) {
          closestDist = dist
          closest = item
        }
      }
      return closest
    }

    const applyVerticalFocus = (targetEl) => {
      const newIdx = this._currentItems.indexOf(targetEl)
      if (newIdx < 0) return false
      this._setFocus(newIdx)
      const r = targetEl.getBoundingClientRect()
      const vpH = window.innerHeight
      const vpW = window.innerWidth
      const fullyVisible =
        r.top >= 0 && r.bottom <= vpH && r.left >= 0 && r.right <= vpW
      if (!fullyVisible) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      this._trackScrollPosition()
      this._lastVerticalCmdAt = now
      this._lastVerticalDirection = direction
      return true
    }

    const tryPageScrollRetry = () => {
      if (scrollDepth >= 1) return false
      window.scrollBy({ top: direction * 600, behavior: 'smooth' })
      setTimeout(() => {
        this._scanItems()
        this._moveFocusVertical(direction, scrollDepth + 1)
      }, 700)
      return true
    }

    if (inShelf) {
      const targetRowIdx = findNearestNonShelfIdx(curRowIdx, direction)
      if (targetRowIdx < 0) {
        return tryPageScrollRetry() ? true : 'edge'
      }
      const closest = pickClosestInRow(targetRowIdx)
      if (!closest) return 'edge'
      return applyVerticalFocus(closest) ? true : 'edge'
    }

    let t = curRowIdx + direction
    if (t < 0 || t >= this._rows.length) {
      return tryPageScrollRetry() ? true : 'edge'
    }

    if (isShelfRow(this._rows[t])) {
      const skipEnter =
        this._lastVerticalDirection === direction &&
        now - this._lastVerticalCmdAt < VERTICAL_SKIP_MS
      if (skipEnter) {
        while (t >= 0 && t < this._rows.length && isShelfRow(this._rows[t])) {
          t += direction
        }
        if (t < 0 || t >= this._rows.length) {
          return tryPageScrollRetry() ? true : 'edge'
        }
      } else {
        const closest = pickClosestInRow(t)
        if (!closest) return 'edge'
        return applyVerticalFocus(closest) ? true : 'edge'
      }
    }

    const closest = pickClosestInRow(t)
    if (!closest) return 'edge'
    return applyVerticalFocus(closest) ? true : 'edge'
  }

  _setFocus(index) {
    this._focusIndex = index
    this._focusedElement = this._currentItems[index] ?? null
    this._focusedHref = this._focusedElement?.href ?? null
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
