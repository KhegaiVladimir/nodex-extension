const MSG_CONTENT_TO_SIDEPANEL = 'CONTENT_TO_SIDEPANEL'
const MSG_SIDEPANEL_TO_CONTENT = 'SIDEPANEL_TO_CONTENT'
const MSG_REQUEST_STATUS       = 'REQUEST_STATUS'
const MSG_INJECT_MEDIAPIPE     = 'INJECT_MEDIAPIPE'

// Open side panel automatically when the toolbar icon is clicked.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

// ── Script injection ───────────────────────────────────────────────────────

/**
 * Inject both content worlds into a tab.
 * Checks both worlds before injecting to avoid duplicate bridge / orphaned MAIN.
 * Silently ignores tabs that are not injectable (restricted pages, not ready).
 */
async function injectIntoTab(tabId) {
  try {
    const [checkIsolated] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__nodexLoaded,
    })
    const [checkMain] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => !!window.__nodexBridgeLoaded,
    })
    // Both worlds already loaded — skip to avoid duplicate listeners.
    if (checkIsolated?.result === true && checkMain?.result === true) return

    // MAIN world: MediaPipe bridge
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/mediapipe-bridge.js'],
      world: 'MAIN',
    })

    // ISOLATED world: gesture orchestrator
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    })
  } catch (_e) {
    // Tab not injectable (restricted URL, prerender, etc.) — ignore silently.
  }
}

// ── Lifecycle hooks ────────────────────────────────────────────────────────

// Inject into all already-open YouTube tabs on install / update.
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: 'https://www.youtube.com/*' }, (tabs) => {
    for (const tab of tabs) {
      if (tab.id != null) injectIntoTab(tab.id)
    }
  })
})

// Inject when a tab fully loads a YouTube page (real navigation / new tab).
// SPA transitions are handled in-page via `yt-navigate-finish`.
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (!tab.url?.startsWith('https://www.youtube.com/')) return
  injectIntoTab(tabId)
})

// ── Message relay ──────────────────────────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return

  switch (message.type) {

    // Content script → side panel (ENGINE_STATUS, METRICS_UPDATE, etc.)
    case MSG_CONTENT_TO_SIDEPANEL:
      if (message.payload) {
        chrome.runtime.sendMessage({
          ...message.payload,
          __sourceTabId: sender.tab?.id,
        }).catch(() => {})
      }
      sendResponse({ ok: true })
      break

    // Side panel → content script (START_ENGINE, UPDATE_SETTINGS, etc.)
    case MSG_SIDEPANEL_TO_CONTENT:
      if (message.tabId != null && message.inner) {
        chrome.tabs.sendMessage(message.tabId, message.inner).catch(() => {})
      }
      sendResponse({ ok: true })
      break

    // Side panel → specific tab: request ENGINE_STATUS
    case MSG_REQUEST_STATUS: {
      const tabId = message.tabId
      if (tabId != null) {
        chrome.tabs.sendMessage(tabId, { type: MSG_REQUEST_STATUS }).catch(() => {})
      }
      sendResponse({ ok: true })
      break
    }

    // MAIN world → service worker: inject MediaPipe scripts into MAIN world
    case MSG_INJECT_MEDIAPIPE: {
      const tabId = sender.tab?.id
      if (tabId == null) {
        sendResponse({ ok: false, error: 'no sender tab id' })
        break
      }
      chrome.scripting.executeScript({
        target: { tabId },
        files: [
          'assets/mediapipe/face_mesh.js',
          'assets/mediapipe/camera_utils.js',
        ],
        world: 'MAIN',
      })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }))
      return true   // async response
    }

    // MAIN world → service worker: inject a single MediaPipe sub-script (patched loader)
    case 'INJECT_SCRIPT': {
      const tabId = sender.tab?.id
      if (tabId == null) {
        sendResponse({ ok: false, error: 'no sender tab id' })
        break
      }
      const filePath = message.path
      if (!filePath || typeof filePath !== 'string') {
        sendResponse({ ok: false, error: 'invalid file path' })
        break
      }
      chrome.scripting.executeScript({
        target: { tabId },
        files: [filePath],
        world: 'MAIN',
      })
        .then(() => sendResponse({ ok: true }))
        .catch((err) => sendResponse({ ok: false, error: err.message }))
      return true   // async response
    }

    default:
      sendResponse({ ok: true })
      break
  }
})
