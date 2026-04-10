/**
 * Paste this entire file into the YouTube page console (DevTools → Console).
 * Mirrors content/BrowseController.js item query + dedupe + buildRows for diagnosis.
 *
 * If you previously got Total items: 0, you used only yt-lockup-view-model;
 * many regions still use ytd-rich-item-renderer a#thumbnail — this script includes both.
 */
;(() => {
  const ROW_SORT_TOL_PX = 8

  const PRIMARY_SELECTORS = [
    'yt-lockup-view-model a.yt-lockup-view-model__content-image',
    'ytd-rich-item-renderer a#thumbnail',
    'ytd-video-renderer a#thumbnail',
    'ytd-compact-video-renderer a#thumbnail',
    'ytd-grid-video-renderer a#thumbnail',
    'ytd-reel-item-renderer a#thumbnail',
    'ytd-rich-grid-media a#thumbnail',
  ].join(',')

  const FALLBACK_SELECTOR =
    'a[href*="/watch?v="], a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'

  function videoIdFromHref(href) {
    if (!href || typeof href !== 'string') return null
    let m = href.match(/[?&]v=([^&]+)/)
    if (m) return m[1]
    m = href.match(/\/shorts\/([^/?&#]+)/)
    if (m) return m[1]
    return null
  }

  function isGhostOrAdThumbnail(el) {
    const rich = el.closest?.('ytd-rich-item-renderer')
    if (rich?.hasAttribute?.('is-empty')) return true
    if (
      el.closest?.(
        'ytd-ad-slot-renderer, ytd-display-ad-renderer, ytd-promoted-sparkles-web-renderer',
      )
    ) {
      return true
    }
    return false
  }

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

  function buildRows(items, rects) {
    if (items.length === 0) return []

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

    let clusterGap = 100
    if (flat.length > 0) {
      const heights = flat
        .map((el) => rects.get(el)?.height ?? 0)
        .filter((h) => h > 40)
        .sort((a, b) => a - b)
      if (heights.length > 0) {
        const median = heights[Math.floor(heights.length / 2)]
        clusterGap = Math.max(60, median * 0.5)
      }
    }

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
        if (currentRow.length === 1) currentRowTop = top
      } else {
        flatRows.push(currentRow)
        currentRow = [el]
        currentRowTop = top
      }
    }
    if (currentRow.length > 0) flatRows.push(currentRow)

    for (const row of flatRows) {
      row.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
    }

    const shelfRows = []
    for (const rowItems of shelfMap.values()) {
      rowItems.sort((a, b) => (rects.get(a)?.left ?? 0) - (rects.get(b)?.left ?? 0))
      shelfRows.push(rowItems)
    }

    const allRows = [...flatRows, ...shelfRows]
    allRows.sort((a, b) => compareRowsByVisualOrder(a, b, rects))
    return allRows
  }

  function queryVisible(selector) {
    return [...document.querySelectorAll(selector)].filter((el) => {
      const r = el.getBoundingClientRect()
      return r.width > 0 && r.height > 0
    })
  }

  let items = queryVisible(PRIMARY_SELECTORS).filter((el) => !isGhostOrAdThumbnail(el))

  if (items.length === 0) {
    items = queryVisible(FALLBACK_SELECTOR).filter((el) => {
      if (isGhostOrAdThumbnail(el)) return false
      if (el.closest?.('ytd-playlist-renderer, #masthead')) return false
      if (el.href?.includes('&list=')) return false
      const r = el.getBoundingClientRect()
      return r.width >= 150 && r.height >= 100
    })
  }

  const rects = new Map()
  for (const el of items) rects.set(el, el.getBoundingClientRect())

  items = dedupeThumbnails(items, rects)
  for (const el of items) rects.set(el, el.getBoundingClientRect())

  const rows = buildRows(items, rects)

  const flatOnly = items.filter(
    (el) => !el.closest?.('ytd-reel-shelf-renderer, ytd-rich-shelf-renderer'),
  )
  const fh = flatOnly
    .map((el) => rects.get(el)?.height ?? 0)
    .filter((h) => h > 40)
    .sort((a, b) => a - b)
  const medianFlat = fh.length ? fh[Math.floor(fh.length / 2)] : null
  const clusterGapLogged = medianFlat != null ? Math.max(60, medianFlat * 0.5) : null

  console.log('═══ Nodex Browse Debug (matches BrowseController) ═══')
  console.log('Per-selector counts (sanity):', {
    lockup: document.querySelectorAll('yt-lockup-view-model a.yt-lockup-view-model__content-image')
      .length,
    richThumb: document.querySelectorAll('ytd-rich-item-renderer a#thumbnail').length,
  })
  console.log('Total items after query+dedupe:', items.length)
  console.log('Median thumbnail height (flat grid):', medianFlat, 'clusterGap (flat):', clusterGapLogged)
  console.log('Rows found:', rows.length)
  console.log('')

  console.table(
    rows.map((row, i) => {
      const tops = row.map((e) => Math.round(rects.get(e).top))
      const lefts = row.map((e) => Math.round(rects.get(e).left))
      const widths = row.map((e) => Math.round(rects.get(e).width))
      return {
        row: i,
        count: row.length,
        tops: tops.join(', '),
        lefts: lefts.join(', '),
        widths: widths.join(', '),
        titles: row
          .map((e) => {
            const card =
              e.closest?.('yt-lockup-view-model') ??
              e.closest?.('ytd-rich-item-renderer') ??
              e.closest?.('ytd-video-renderer')
            return (
              card?.querySelector?.('h3, #video-title, a#video-title')?.textContent?.trim().slice(0, 28) ||
              '?'
            )
          })
          .join(' | '),
      }
    }),
  )

  console.log('')
  console.log('═══ Suspicious items ═══')
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (row.length < 2) {
      console.warn(`Row ${i}: only ${row.length} item(s) — suspicious`, row[0])
      continue
    }
    const lefts = row.map((e) => rects.get(e).left).sort((a, b) => a - b)
    const gaps = []
    for (let j = 1; j < lefts.length; j++) gaps.push(lefts[j] - lefts[j - 1])
    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length
    for (const g of gaps) {
      if (g > avgGap * 1.5) {
        console.warn(
          `Row ${i}: uneven horizontal gap — possible missing card. Gaps:`,
          gaps,
          'avg:',
          avgGap,
        )
        break
      }
    }
  }
})()
