# YouTube DOM Selectors

Last verified: **April 2026**

## Player

| Target | Selector | Notes |
|---|---|---|
| Player container | `#movie_player` | Keyboard event target (primary) |
| Ad check | `#movie_player.ad-showing` | Class added during pre-roll |
| Ad transition | `.ytp-ad-player-overlay` | Present during mid-roll transitions |
| Video element | `video` | Direct HTMLVideoElement |
| Prev button | `.ytp-prev-button` | May be inside Shadow DOM — use querySelectorDeep |

## Browse Mode Feed — Primary Selectors

Tried in order. First set returning non-empty results wins.

```js
[
  'yt-lockup-view-model a.yt-lockup-view-model__content-image',
  'yt-lockup-view-model a[href*="/watch?v="]',
  'yt-lockup-view-model a[href^="/shorts/"]',
  'ytd-rich-item-renderer a#thumbnail',
  'ytd-video-renderer a#thumbnail',
  'ytd-compact-video-renderer a#thumbnail',
  'ytd-grid-video-renderer a#thumbnail',
  'ytd-reel-item-renderer a#thumbnail',
  'ytd-rich-grid-media a#thumbnail',
  'ytd-rich-section-renderer a#thumbnail',
]
```

**Fallback (if all above return empty):**
```js
'a[href*="/watch?v="], a[href^="/shorts/"], a[href*="youtube.com/shorts/"]'
```

## Observer Roots (MutationObserver targets)

```js
[
  'ytd-rich-grid-renderer',
  'ytd-section-list-renderer',
  'ytd-watch-next-secondary-results-renderer',
]
```

## Card Containers (for scale transform on focus)

```js
[
  'ytd-rich-item-renderer',
  'yt-lockup-view-model',
  'ytd-video-renderer',
  'ytd-compact-video-renderer',
  'ytd-grid-video-renderer',
  'ytd-reel-item-renderer',
]
```

## Blacklisted Elements (excluded from navigation)

```js
[
  'ytd-ad-slot-renderer',
  'ytd-display-ad-renderer',
  'ytd-promoted-sparkles-web-renderer',
  'ytd-movie-renderer',
  'ytd-in-feed-ad-layout-renderer',
  'ytd-promoted-video-renderer',
  'ytd-statement-banner-renderer',
  'ytd-brand-video-shelf-renderer',
]
```

Also excludes items containing `yt-badge-shape--commerce` (paid content badge).

## Changelog

| Date | Selector | Status | Notes |
|---|---|---|---|
| April 2026 | `yt-lockup-view-model` | **active** | New card model, replaces old ytd-rich-item on home |
| April 2026 | `ytd-rich-item-renderer a#thumbnail` | **active** | Still present on some page types |

## If Selectors Break

See `docs/debugging/youtube-selectors-dead.md` for the full debug playbook.

**Quick check:**
```js
// DevTools console on youtube.com
document.querySelectorAll('yt-lockup-view-model a[href*="/watch?v="]').length
// Expected: > 0 on home feed
```
