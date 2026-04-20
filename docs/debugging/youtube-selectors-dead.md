# Debug: YouTube Selectors Dead

## Symptoms

- Browse mode doesn't highlight any cards (no focus ring appears)
- Focus ring appears but navigating does nothing
- Console: `[Nodex] BrowseController: no cards found`
- `querySelector returned null` errors in `content/BrowseController.js`

## Quick Check (30 seconds)

Open DevTools on `youtube.com` and run:

```js
// Primary selector (home feed)
document.querySelectorAll('yt-lockup-view-model a[href*="/watch?v="]').length
// Expected: > 0 on home feed

// Legacy selector
document.querySelectorAll('ytd-rich-item-renderer a#thumbnail').length
// Expected: > 0 on some pages

// Fallback
document.querySelectorAll('a[href*="/watch?v="]').length
// Expected: > 0 on any page with video links
```

If primary and legacy return 0 but fallback returns > 0 → YouTube changed its markup. The selectors in `BrowseController.js` need updating.

## Finding New Selectors

1. Right-click on a video thumbnail → Inspect
2. Look at the element hierarchy in DevTools
3. Find the outermost stable container for a video card (usually a custom element)
4. Find the `<a>` tag inside it that links to `/watch?v=` or `/shorts/`
5. Note the class name or attribute that uniquely identifies it

**What to look for:**
- Custom elements: `yt-*` or `ytd-*` tags
- Anchor elements: `href` containing `/watch?v=` or `/shorts/`
- IDs: `#thumbnail` is historically stable but YouTube may rename it

## What to Update After Fix

1. `content/BrowseController.js` — update the selector array at the top of the file
2. `docs/selectors.md` — add new selector with date, move old one to changelog table
3. `docs/changelog-internal.md` — add entry for the fix
4. Bump patch version in `manifest.json` and `package.json`

## Also Check: Blacklist

Make sure the new selector isn't being caught by the blacklist in `BrowseController.js`:

```js
const BLACKLISTED_ANCESTORS = [
  'ytd-ad-slot-renderer',
  'ytd-display-ad-renderer',
  // ...
]
```

If legitimate video cards share a class with an ad element, the blacklist may be filtering them out.

## Also Check: Observer Roots

If new cards appear on scroll but aren't discovered, the `MutationObserver` roots may need updating:

```js
const OBSERVER_ROOTS = [
  'ytd-rich-grid-renderer',
  'ytd-section-list-renderer',
  'ytd-watch-next-secondary-results-renderer',
]
```

The periodic scan (`PERIODIC_SCAN_MS: 15000`) will catch cards eventually — but if the root element is gone, the observer never fires.
