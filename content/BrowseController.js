import { COMMANDS } from '../shared/constants/commands.js'

/**
 * YouTube home is served with almost no grid from the server — the feed is built in the browser
 * (custom elements ytd-rich-grid-renderer → ytd-rich-grid-row → ytd-rich-item-renderer → a#thumbnail).
 * Selectors below match that model; empty grid cells are marked is-empty.
 */
const PRIMARY_SELECTORS = [
  // Modern Home feed (most regular videos in many regions).
  'yt-lockup-view-model a.yt-lockup-view-model__content-image',
  // Fallback for yt-lockup-view-model variants where class name may differ.
  'yt-lockup-view-model a[href*="/watch?v="]',
  'yt-lockup-view-model a[href^="/shorts/"]',
  'ytd-rich-item-renderer a#thumbnail',
  'ytd-video-renderer a#thumbnail',
  'ytd-compact-video-renderer a#thumbnail',
  'ytd-grid-video-renderer a#thumbnail',
  'ytd-reel-item-renderer a#thumbnail',
  'ytd-rich-grid-media a#thumbnail',
  // Featured / hero sections on home feed.
  'ytd-rich-section-renderer a#thumbnail',
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
const PERIODIC_SCAN_MS = 15000
/** Minimum gap between browse movement commands (gestures must not double-step).
 *  Reduced to 700ms (was 880) for snappier navigation. GestureEngine HEAD_LEFT/RIGHT
 *  cooldown is 350ms, so effective minimum is max(350, 700) = 700ms. */
const BROWSE_COMMAND_COOLDOWN_MS = 700
/** Sticky column expires after this idle gap — user paused, intention reset. */
const STICKY_COLUMN_IDLE_MS = 2500

const OBSERVER_ROOT_SELECTORS = [
  'ytd-rich-grid-renderer',
  'ytd-section-list-renderer',
  'ytd-watch-next-secondary-results-renderer',
]

/** Thumbnails inside these hosts are excluded from browse focus and geometric picks. */
const BLACKLIST_SELECTORS = [
  'ytd-ad-slot-renderer',
  'ytd-display-ad-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-movie-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-promoted-video-renderer',
  'ytd-statement-banner-renderer',
  'ytd-brand-video-shelf-renderer',
].join(',')

const PRIMARY_SELECTOR_STRING = PRIMARY_SELECTORS.join(',')

/** Minimum horizontal separation (px, center-to-center) for geometric left/right picks. */
const GEOM_H_MIN = 20
/** Minimum vertical separation (px, center-to-center) for geometric up/down picks. */
const GEOM_V_MIN = 20

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

/**
 * Valid thumbnail for focus: not blacklisted, not empty grid cell, visible rect,
 * not absurdly far off-screen vertically (beyond 2× viewport height from the visible band).
 * @param {Element} el
 */
function isValidCard(el) {
  if (!el?.closest) return false
  if (el.closest(BLACKLIST_SELECTORS)) return false
  const rich = el.closest?.('ytd-rich-item-renderer')
  if (rich?.hasAttribute?.('is-empty')) return false

  // Movies / paid content leak through as ytd-rich-item-renderer.
  // YouTube tags them with yt-badge-shape--commerce (internal marker for
  // licensed/commercial content). Reliable, locale-independent.
  if (rich && !el.closest?.('yt-lockup-view-model')) {
    if (rich.querySelector('.yt-badge-shape--commerce')) return false
  }

  const r = el.getBoundingClientRect()
  if (r.width <= 0 || r.height <= 0) return false
  const vpH = window.innerHeight
  if (r.bottom < -2 * vpH || r.top > vpH + 2 * vpH) return false
  return true
}

function queryAllValidPrimaryCards() {
  return [...document.querySelectorAll(PRIMARY_SELECTOR_STRING)].filter(isValidCard)
}

/**
 * Weighted distance: primary axis ×1, orthogonal ×3 (horizontal move → vertical penalized 3×).
 * @param {number} dx
 * @param {number} dy
 * @param {boolean} horizontalPrimary
 */
function weightedStepScore(dx, dy, horizontalPrimary) {
  if (horizontalPrimary) {
    return Math.hypot(dx, 3 * dy)
  }
  return Math.hypot(3 * dx, dy)
}

/**
 * Closest valid primary card to anchor center (self-heal when focus node is stale/blacklisted).
 * @param {DOMRect | { left: number, top: number, width: number, height: number } | null} anchorRect
 * @returns {Element | null}
 */
function geometricNearestAnchor(anchorRect) {
  if (!anchorRect) return null
  const w = anchorRect.width ?? 0
  const h = anchorRect.height ?? 0
  const cx = anchorRect.left + (w > 0 ? w / 2 : 0)
  const cy = anchorRect.top + (h > 0 ? h / 2 : 0)
  const candidates = queryAllValidPrimaryCards()
  let best = null
  let bestD = Infinity
  for (const el of candidates) {
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    const ox = r.left + r.width / 2
    const oy = r.top + r.height / 2
    const d = Math.hypot(ox - cx, oy - cy)
    if (d < bestD) {
      bestD = d
      best = el
    }
  }
  return best
}

/**
 * Next card in a direction when row/shelf structure fails (weighted 3:1 orthogonal penalty).
 * @param {DOMRect | { left: number, top: number, width: number, height: number } | null} anchorRect
 * @param {'right' | 'left' | 'up' | 'down'} direction
 * @param {Element | null} excludeEl
 * @returns {Element | null}
 */
function geometricNeighborFromRect(anchorRect, direction, excludeEl = null) {
  if (!anchorRect) return null
  const w = anchorRect.width ?? 0
  const h = anchorRect.height ?? 0
  const cx = anchorRect.left + (w > 0 ? w / 2 : 0)
  const cy = anchorRect.top + (h > 0 ? h / 2 : 0)
  const candidates = queryAllValidPrimaryCards()
  let best = null
  let bestScore = Infinity
  for (const el of candidates) {
    if (excludeEl && el === excludeEl) continue
    const r = el.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) continue
    const ox = r.left + r.width / 2
    const oy = r.top + r.height / 2
    const dx = ox - cx
    const dy = oy - cy
    let score = Infinity
    if (direction === 'right') {
      if (dx <= GEOM_H_MIN) continue
      score = weightedStepScore(dx, dy, true)
    } else if (direction === 'left') {
      if (dx >= -GEOM_H_MIN) continue
      score = weightedStepScore(dx, dy, true)
    } else if (direction === 'up') {
      if (dy >= -GEOM_V_MIN) continue
      score = weightedStepScore(dx, dy, false)
    } else if (direction === 'down') {
      if (dy <= GEOM_V_MIN) continue
      score = weightedStepScore(dx, dy, false)
    } else {
      continue
    }
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
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

  // 2. Compute clustering threshold from median item height (real tiles only).
  // h=0 skeletons must not pollute the median — filter those out.
  // Threshold was > 100 but that excluded compact sidebar thumbnails (~68px),
  // causing their clusterGap to fall back to 200px and grouping every two
  // sidebar videos into one "row", making vertical navigation skip one item.
  const CLUSTER_GAP_FALLBACK_PX = 80
  let clusterGap = 100
  if (flat.length > 0) {
    const heights = flat
      .map((el) => rects.get(el)?.height ?? 0)
      .filter((h) => h > 20)   // exclude zero-height skeletons only
      .sort((a, b) => a - b)
    if (heights.length >= 3) {
      const median = heights[Math.floor(heights.length / 2)]
      // Gap threshold: half the median height. Items within this distance
      // vertically count as the same row. Noise from badges is typically
      // under 20px, so a threshold of 60px minimum is safe.
      clusterGap = Math.max(60, median * 0.5)
    } else {
      clusterGap = CLUSTER_GAP_FALLBACK_PX
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
    /** @type {AbortController} */
    this._ac = new AbortController()
    this._destroyed = false
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
    /** @type {(() => void) | null} */
    this._onBrowseResize = null
    /** @type {((e: Event) => void) | null} */
    this._onBrowsePageShow = null
    /** @type {(() => void) | null} */
    this._onYtNavigateFinish = null
    /** Last drawn focus rect (for self-heal when DOM swaps to blacklisted nodes). */
    this._lastFocusRect = null
    /** Sticky column X (viewport coords) held across consecutive vertical moves. */
    this._stickyColumnX = null
    /** Timestamp when sticky column was last set or used, for idle expiration. */
    this._stickyColumnAt = 0
    /** Card container element that currently has scale(1.05) applied. */
    this._scaledEl = null
    /** Source <a> thumbnail for which _scaledEl was last computed — skip closest() on repeat calls. */
    this._scaledElSource = null

    if (typeof window !== 'undefined') window.__nodexBrowseController = this
  }

  activate() {
    if (this._destroyed) return 0
    this.deactivate()
    this._ensureFocusRing()
    this._scanItems()
    this._focusFirstVisible()

    this._observer = new MutationObserver(() => {
      if (this._destroyed) return
      clearTimeout(this._mutationDebounce)
      this._mutationDebounce = setTimeout(() => {
        this._mutationDebounce = null
        if (this._destroyed) return
        this._scanItems()
      }, MUTATION_DEBOUNCE_MS)
    })

    const container = findBrowseObserverRoot()
    this._observer.observe(container, { subtree: true, childList: true })
    window.addEventListener('scroll', this._onScroll, { passive: true, signal: this._ac.signal })

    this._onBrowseResize = () => {
      this._ensureFocusRing()
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
    }
    window.addEventListener('resize', this._onBrowseResize, { passive: true, signal: this._ac.signal })

    this._onBrowsePageShow = (e) => {
      if (this._destroyed) return
      // bfcache: ring was detached from the frozen document; force recreate.
      if (e.persisted) this._focusRing = null
      this._ensureFocusRing()
      this._scanItems()
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      else if (this._currentItems.length > 0) this._focusFirstVisible()
    }
    window.addEventListener('pageshow', this._onBrowsePageShow, { signal: this._ac.signal })

    this._onYtNavigateFinish = () => {
      if (this._destroyed) return
      // Remove the old ring from the DOM before nulling the ref —
      // otherwise it stays orphaned on screen after SPA navigation.
      if (this._focusRing) {
        this._focusRing.remove()
        this._focusRing = null
      }
      this._ensureFocusRing()
      this._scanItems()
      if (this._currentItems.length > 0 && this._focusIndex < 0) this._focusFirstVisible()
      else if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
    }
    document.addEventListener('yt-navigate-finish', this._onYtNavigateFinish, { signal: this._ac.signal })

    this._periodicTimer = setInterval(() => {
      if (this._destroyed) return
      if (performance.now() - this._lastCommandAt < 1500) return
      this._ensureFocusRing()
      this._scanItems()
      if (this._focusIndex < 0 && this._currentItems.length > 0) {
        this._focusFirstVisible()
      } else if (this._focusIndex >= 0) {
        this._highlightItem(this._focusIndex)
      }
    }, PERIODIC_SCAN_MS)

    if (this._currentItems.length === 0) {
      this._scheduleRetry()
    }

    return this._currentItems.length
  }

  /**
   * Re-scan the grid and redraw the focus ring. Call after calibration or whenever
   * the feed may have swapped DOM nodes while browse mode stayed active.
   */
  refreshIfActive() {
    if (this._destroyed) return
    this._ensureFocusRing()
    this._scanItems()
    if (this._focusIndex < 0 && this._currentItems.length > 0) {
      this._focusFirstVisible()
    } else if (this._focusIndex >= 0) {
      this._highlightItem(this._focusIndex)
    }
  }

  deactivate() {
    if (this._destroyed) return
    this._teardownBrowseSession({ permanent: false })
  }

  /**
   * Permanently tears down this controller: aborts window listeners, disconnects observers,
   * removes the focus ring, and blocks further DOM work.
   */
  destroy() {
    if (this._destroyed) return
    if (typeof window !== 'undefined' && window.__nodexBrowseController === this) {
      window.__nodexBrowseController = null
    }
    this._destroyed = true
    this._teardownBrowseSession({ permanent: true })
  }

  /**
   * @param {{ permanent: boolean }} opts permanent: true when destroying (do not allocate a new AbortController).
   */
  _teardownBrowseSession({ permanent }) {
    clearTimeout(this._mutationDebounce)
    this._mutationDebounce = null
    clearTimeout(this._retryTimer)
    this._retryTimer = null
    clearTimeout(this._scrollTrackTimer)
    this._scrollTrackTimer = null
    clearInterval(this._periodicTimer)
    this._periodicTimer = null
    cancelAnimationFrame(this._scrollRaf)
    this._scrollRaf = null
    this._observer?.disconnect()
    this._observer = null

    this._ac.abort()
    if (!permanent) {
      this._ac = new AbortController()
    }

    this._onBrowseResize = null
    this._onBrowsePageShow = null
    this._onYtNavigateFinish = null

    if (this._focusRing) {
      this._focusRing.remove()
      this._focusRing = null
    }
    this._scaledElSource = null
    this._applyCardScale(null)

    this._focusIndex = -1
    this._focusedElement = null
    this._currentItems = []
    this._rows = []
    this._lastCommandAt = 0
    this._focusedHref = null
    this._itemListSignature = null
    this._lastVerticalCmdAt = 0
    this._lastVerticalDirection = 0
    this._lastFocusRect = null
    this._resetStickyColumn()
  }

  /** Selector for the card container to which scale is applied (not the <a> itself). */
  static CARD_CONTAINER_SEL = [
    'ytd-rich-item-renderer',
    'yt-lockup-view-model',
    'ytd-video-renderer',
    'ytd-compact-video-renderer',
    'ytd-grid-video-renderer',
    'ytd-reel-item-renderer',
  ].join(',')

  /**
   * Applies scale(1.05) to the card container wrapping `el`, removes it from the
   * previous container. Pass null to only remove.
   * @param {Element|null} el
   */
  _applyCardScale(el) {
    // Fast path: same source element → container unchanged, skip DOM traversal.
    if (el === this._scaledElSource) return
    this._scaledElSource = el
    const container = el ? (el.closest(BrowseController.CARD_CONTAINER_SEL) ?? el) : null
    if (container === this._scaledEl) return
    if (this._scaledEl) {
      this._scaledEl.style.transform = ''
      this._scaledEl.style.transition = ''
      this._scaledEl.style.zIndex = ''
      this._scaledEl.style.position = ''
      this._scaledEl = null
    }
    if (container) {
      container.style.position = 'relative'
      container.style.zIndex = '1'
      container.style.transition = 'transform 0.2s ease-out'
      container.style.transform = 'scale(1.05)'
      this._scaledEl = container
    }
  }

  /**
   * Brief red pulse on the focus ring to signal "edge reached" — no animation library needed.
   */
  _pulseEdge() {
    const ring = this._focusRing
    if (!ring || ring.style.display === 'none') return
    ring.style.transition = 'border-color 0.08s ease-out, box-shadow 0.08s ease-out'
    ring.style.borderColor = '#ff4444'
    ring.style.boxShadow = '0 0 0 4px rgba(255, 68, 68, 0.35)'
    setTimeout(() => {
      if (!this._focusRing || this._destroyed) return
      ring.style.borderColor = '#64FFDA'
      ring.style.boxShadow = '0 0 0 4px rgba(100, 255, 218, 0.2)'
      setTimeout(() => {
        if (!this._focusRing || this._destroyed) return
        ring.style.transition = 'top 0.2s ease-out, left 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out'
      }, 180)
    }, 120)
  }

  /** Clears vertical sticky-column anchor (horizontal move or focus bootstrap). */
  _resetStickyColumn() {
    this._stickyColumnX = null
    this._stickyColumnAt = 0
  }

  /**
   * @returns {boolean|'edge'} true if applied, 'edge' if at boundary, false if no items
   */
  execute(command) {
    if (this._destroyed) return false
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

  /**
   * Recreate the ring if YouTube (or another script) removed it from the DOM while
   * keeping our JS reference — otherwise _createFocusRing would no-op forever.
   */
  _ensureFocusRing() {
    if (this._focusRing) {
      const ring = this._focusRing
      const detached =
        !ring.isConnected ||
        ring.ownerDocument !== document ||
        (document.body != null && !document.body.contains(ring))
      if (detached) {
        this._focusRing = null
      }
    }
    this._createFocusRing()
  }

  _createFocusRing() {
    if (this._focusRing) {
      const ring = this._focusRing
      if (
        ring.isConnected &&
        ring.ownerDocument === document &&
        (document.body == null || document.body.contains(ring))
      ) {
        return
      }
      this._focusRing = null
    }
    const ring = document.createElement('div')
    ring.id = 'nodex-focus-ring'
    ring.setAttribute('data-nodex', 'focus-ring')
    Object.assign(ring.style, {
      position: 'fixed',
      pointerEvents: 'none',
      zIndex: '2147483647',
      border: '3px solid #64FFDA',
      borderRadius: '12px',
      boxShadow: '0 0 0 4px rgba(100, 255, 218, 0.2)',
      transition: 'top 0.2s ease-out, left 0.2s ease-out, width 0.2s ease-out, height 0.2s ease-out',
      display: 'none',
    })
    const root = document.body || document.documentElement
    root.appendChild(ring)
    this._focusRing = ring
  }

  _focusFirstVisible() {
    if (this._currentItems.length === 0) return
    this._resetStickyColumn()
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
      if (this._destroyed) return
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
    if (this._destroyed) return
    this._lastScanTime = Date.now()

    let items = this._queryVisibleItems(PRIMARY_SELECTOR_STRING)
      .filter((el) => isValidCard(el))

    if (items.length === 0) {
      items = this._queryVisibleItems(FALLBACK_SELECTOR)
        .filter((el) => {
          if (!isValidCard(el)) return false
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
      this._resetStickyColumn()
      if (this._focusRing) this._focusRing.style.display = 'none'
      return
    }

    // Temporarily remove scale so the focused element's rect is unscaled for row/column math.
    // scale(1.05) shifts top/left by ~2–5 px which can misplace the item into the wrong row.
    const scaledTransform = this._scaledEl?.style.transform ?? ''
    if (this._scaledEl) this._scaledEl.style.transform = ''

    const rects = new Map()
    for (const el of items) {
      rects.set(el, el.getBoundingClientRect())
    }

    if (this._scaledEl) this._scaledEl.style.transform = scaledTransform

    items = dedupeThumbnails(items, rects)
    this._rows = buildRows(items, rects, ROW_BREAK_PX)
    items = this._rows.flat()

    const nextSig = {
      count: items.length,
      firstHref: items[0]?.href ?? '',
      lastHref: items[items.length - 1]?.href ?? '',
    }
    // Never skip updating _currentItems when the "signature" matches. YouTube's SPA
    // often replaces thumbnail nodes while keeping the same first/last URLs and count;
    // stale element refs then fail isConnected in _highlightItem → focus ring stays hidden
    // until a full page reload.
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

  /**
   * If the focused thumbnail is missing or blacklisted after DOM churn, snap to the nearest valid card.
   * @returns {boolean} true if focus was reassigned
   */
  _selfHealInvalidFocusIfNeeded() {
    if (this._destroyed) return false
    const cur = this._currentItems[this._focusIndex]
    if (cur?.isConnected && isValidCard(cur)) return false

    let anchor = null
    if (this._lastFocusRect) {
      anchor = { ...this._lastFocusRect }
    } else if (cur?.isConnected) {
      anchor = cur.getBoundingClientRect()
    }

    const healed = geometricNearestAnchor(anchor)
    if (!healed) return false

    this._scanItems()
    const idx = this._currentItems.indexOf(healed)
    if (idx < 0) return false
    this._setFocus(idx)
    return true
  }

  /**
   * @param {'right' | 'left' | 'up' | 'down'} directionLabel
   * @param {Element | null | undefined} fromEl
   * @returns {boolean}
   */
  _applyGeometricFocus(nextEl, directionLabel, fromEl) {
    this._scanItems()
    let idx = this._currentItems.indexOf(nextEl)
    if (idx < 0) {
      this._scanItems()
      idx = this._currentItems.indexOf(nextEl)
    }
    if (idx < 0) return false

    this._setFocus(idx)
    const r = nextEl.getBoundingClientRect()
    const vpH = window.innerHeight
    const vpW = window.innerWidth
    const fullyVisible =
      r.top >= 0 && r.bottom <= vpH && r.left >= 0 && r.right <= vpW
    if (!fullyVisible) {
      nextEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' })
    }
    this._trackScrollPosition()
    console.warn('[Nodex] browse fallback:', directionLabel, 'from', fromEl, 'to', nextEl)
    return true
  }

  /**
   * @param {number} direction -1 up, +1 down
   */
  _tryGeometricVerticalMove(direction, current) {
    const dirLabel = direction < 0 ? 'up' : 'down'
    const anchor = current?.isConnected
      ? current.getBoundingClientRect()
      : this._lastFocusRect
        ? { ...this._lastFocusRect }
        : null
    const nextEl = geometricNeighborFromRect(anchor, dirLabel, current ?? null)
    if (!nextEl) return false
    return this._applyGeometricFocus(nextEl, dirLabel, current)
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
    if (this._destroyed) return false
    // Horizontal move → user chose new column → drop sticky anchor.
    this._resetStickyColumn()
    this._scanItems()
    if (this._rows.length === 0 || this._currentItems.length === 0) return false

    this._selfHealInvalidFocusIfNeeded()

    const dirLabel = delta > 0 ? 'right' : 'left'
    let rc = this._findRowCol()
    if (!rc) {
      this._scanItems()
      rc = this._findRowCol()
    }

    const current = this._currentItems[this._focusIndex]
    const anchorForGeom = current?.isConnected
      ? current.getBoundingClientRect()
      : this._lastFocusRect
        ? { ...this._lastFocusRect }
        : null

    if (!rc) {
      const nextEl = geometricNeighborFromRect(anchorForGeom, dirLabel, current ?? null)
      if (nextEl && this._applyGeometricFocus(nextEl, dirLabel, current)) return true
      return false
    }

    const { rowIdx, colIdx } = rc
    const row = this._rows[rowIdx]
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
            if (this._destroyed) return
            this._scanItems()
            this._moveFocus(delta, shelfScrollAttempt + 1)
          }, 500)
          return true
        }
        // Shelf without a scrollable container — fall through to geometric fallback (same as no shelf).
      }
      const nextEl = geometricNeighborFromRect(anchorForGeom, dirLabel, current ?? null)
      if (nextEl && this._applyGeometricFocus(nextEl, dirLabel, current)) return true
      this._pulseEdge()
      return 'edge'
    }

    const target = row[newCol]
    if (!target?.isConnected || !isValidCard(target)) {
      this._scanItems()
      const nextEl = geometricNeighborFromRect(anchorForGeom, dirLabel, current ?? null)
      if (nextEl && this._applyGeometricFocus(nextEl, dirLabel, current)) return true
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      this._pulseEdge()
      return 'edge'
    }

    const newIdx = this._currentItems.indexOf(target)
    if (newIdx < 0) {
      const nextEl = geometricNeighborFromRect(anchorForGeom, dirLabel, current ?? null)
      if (nextEl && this._applyGeometricFocus(nextEl, dirLabel, current)) return true
      this._pulseEdge()
      return 'edge'
    }

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
    if (this._destroyed) return false
    this._scanItems()
    this._selfHealInvalidFocusIfNeeded()
    this._scanItems()

    if (this._rows.length === 0 || this._focusIndex < 0) {
      if (this._tryGeometricVerticalMove(direction, null)) return true
      return false
    }

    const current = this._currentItems[this._focusIndex]
    if (!current?.isConnected) {
      this._scanItems()
      if (this._tryGeometricVerticalMove(direction, current)) return true
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      return 'edge'
    }

    let curRowIdx = this._rows.findIndex((row) => row.includes(current))
    if (curRowIdx < 0) {
      this._scanItems()
      curRowIdx = this._rows.findIndex((row) => row.includes(current))
    }
    if (curRowIdx < 0) {
      if (this._tryGeometricVerticalMove(direction, current)) return true
      return false
    }

    const rect = current.getBoundingClientRect()
    const now = performance.now()

    // Sticky column: first vertical in a series captures the intention X.
    // Subsequent verticals within idle window reuse it, so down-down-down
    // stays in the same visual column even if target cards aren't perfectly aligned.
    const stickyExpired = now - this._stickyColumnAt > STICKY_COLUMN_IDLE_MS
    if (this._stickyColumnX === null || stickyExpired) {
      this._stickyColumnX = rect.left + rect.width / 2
    }
    this._stickyColumnAt = now
    const centerX = this._stickyColumnX

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
        if (this._destroyed) return
        this._scanItems()
        this._moveFocusVertical(direction, scrollDepth + 1)
      }, 700)
      return true
    }

    if (inShelf) {
      const targetRowIdx = findNearestNonShelfIdx(curRowIdx, direction)
      if (targetRowIdx < 0) {
        if (tryPageScrollRetry()) return true
        if (this._tryGeometricVerticalMove(direction, current)) return true
        return 'edge'
      }
      const closest = pickClosestInRow(targetRowIdx)
      if (!closest) {
        if (this._tryGeometricVerticalMove(direction, current)) return true
        return 'edge'
      }
      return applyVerticalFocus(closest) ? true : 'edge'
    }

    let t = curRowIdx + direction
    if (t < 0 || t >= this._rows.length) {
      if (tryPageScrollRetry()) return true
      if (this._tryGeometricVerticalMove(direction, current)) return true
      return 'edge'
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
          if (tryPageScrollRetry()) return true
          if (this._tryGeometricVerticalMove(direction, current)) return true
          return 'edge'
        }
      } else {
        const closest = pickClosestInRow(t)
        if (!closest) {
          if (this._tryGeometricVerticalMove(direction, current)) return true
          return 'edge'
        }
        return applyVerticalFocus(closest) ? true : 'edge'
      }
    }

    const closest = pickClosestInRow(t)
    if (!closest) {
      if (this._tryGeometricVerticalMove(direction, current)) return true
      return 'edge'
    }
    return applyVerticalFocus(closest) ? true : 'edge'
  }

  _setFocus(index) {
    this._focusIndex = index
    this._focusedElement = this._currentItems[index] ?? null
    this._focusedHref = this._focusedElement?.href ?? null
    this._highlightItem(index)
  }

  _highlightItem(index) {
    if (this._destroyed) return
    this._ensureFocusRing()
    this._focusIndex = index
    const el = this._currentItems[index]
    if (!el || !el.isConnected) {
      if (this._focusRing) this._focusRing.style.display = 'none'
      this._applyCardScale(null)
      return
    }
    const applyRect = (r) => {
      if (!this._focusRing?.isConnected) return
      Object.assign(this._focusRing.style, {
        display: 'block',
        top: `${r.top - 4}px`,
        left: `${r.left - 4}px`,
        width: `${r.width + 8}px`,
        height: `${r.height + 8}px`,
      })
    }

    this._applyCardScale(el)
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) {
      requestAnimationFrame(() => {
        if (this._destroyed || !el.isConnected) return
        const r2 = el.getBoundingClientRect()
        if (r2.width > 0 && r2.height > 0) {
          applyRect(r2)
          if (isValidCard(el)) {
            this._lastFocusRect = {
              left: r2.left,
              top: r2.top,
              right: r2.right,
              bottom: r2.bottom,
              width: r2.width,
              height: r2.height,
            }
          }
        } else if (this._focusRing) {
          this._focusRing.style.display = 'none'
        }
      })
      return
    }
    applyRect(rect)
    if (el.isConnected && isValidCard(el)) {
      this._lastFocusRect = {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      }
    }
  }

  _trackScrollPosition() {
    clearTimeout(this._scrollTrackTimer)
    const start = Date.now()
    const tick = () => {
      if (this._destroyed) return
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
      if (Date.now() - start < SCROLL_TRACK_MS) {
        this._scrollTrackTimer = setTimeout(tick, 16)
      }
    }
    tick()
  }

  _selectCurrent() {
    if (this._focusIndex < 0) return false
    const el = this._currentItems[this._focusIndex]
    if (!el) return false
    if (!el.isConnected || !isValidCard(el)) {
      this._selfHealInvalidFocusIfNeeded()
      return false
    }
    const r = el.getBoundingClientRect()
    const vpH = window.innerHeight
    const vpW = window.innerWidth
    if (r.bottom < 0 || r.top > vpH || r.right < 0 || r.left > vpW) {
      this._focusFirstVisible()
      return false
    }

    if (el.href) {
      window.location.href = el.href
    } else {
      el.click()
    }
    return true
  }

  _handleScroll() {
    if (this._destroyed) return
    if (this._scrollRaf) return
    this._scrollRaf = requestAnimationFrame(() => {
      this._scrollRaf = null
      if (this._destroyed) return
      if (this._focusIndex >= 0) this._highlightItem(this._focusIndex)
    })
  }
}
