const MSG_CONTENT_TO_SIDEPANEL = 'CONTENT_TO_SIDEPANEL'
const MSG_SIDEPANEL_TO_CONTENT = 'SIDEPANEL_TO_CONTENT'
const MSG_REQUEST_STATUS       = 'REQUEST_STATUS'
const MSG_INJECT_MEDIAPIPE     = 'INJECT_MEDIAPIPE'

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ tabId: tab.id }).catch(() => {})
})

// Programmatic injection — the ONLY reliable way to inject into existing tabs.
// content_scripts in manifest only auto-inject into NEW tabs opened after extension loads.
// For already-open tabs we must use chrome.scripting.executeScript.
async function injectIntoTab(tabId) {
  try {
    // Check if already injected by reading a flag from ISOLATED world
    const check = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => !!window.__nodexLoaded,
    })
    if (check[0]?.result === true) return

    // Inject bridge into MAIN world using world param on the injection object (not target)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/mediapipe-bridge.js'],
      world: 'MAIN',
    })

    // Inject orchestrator into ISOLATED world (default)
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['content/index.js'],
    })
  } catch (e) {
    // Tab not ready or restricted page — ignore silently
  }
}

// Inject into all open YouTube watch tabs when extension installs or updates
chrome.runtime.onInstalled.addListener(() => {
  chrome.tabs.query({ url: 'https://www.youtube.com/watch*' }, (tabs) => {
    for (const tab of tabs) injectIntoTab(tab.id)
  })
})

// Inject when a tab fully loads a YouTube watch page
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (!tab.url?.startsWith('https://www.youtube.com/watch')) return
  injectIntoTab(tabId)
})

// Re-inject on YouTube SPA navigation (clicking between videos)
chrome.webNavigation.onHistoryStateUpdated.addListener(
  (details) => {
    if (!details.url?.startsWith('https://www.youtube.com/watch')) return
    // Delay slightly to let the new page context settle
    setTimeout(() => injectIntoTab(details.tabId), 1500)
  },
  { url: [{ hostContains: 'youtube.com' }] },
)

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message?.type) return

  switch (message.type) {

    case MSG_CONTENT_TO_SIDEPANEL:
      // Relay from content script to side panel
      chrome.runtime.sendMessage(message).catch(() => {})
      sendResponse({ ok: true })
      break

    case MSG_SIDEPANEL_TO_CONTENT:
      // Relay from side panel to content script
      if (message.tabId) {
        const { type: _t, tabId: _id, ...inner } = message; chrome.tabs.sendMessage(message.tabId, inner).catch(() => {})
      }
      sendResponse({ ok: true })
      break

    case MSG_REQUEST_STATUS:
      getActiveYouTubeTabId().then((tabId) => {
        if (tabId == null) return
        chrome.tabs.sendMessage(tabId, { type: MSG_REQUEST_STATUS }).catch(() => {})
      })
      sendResponse({ ok: true })
      break

    case MSG_INJECT_MEDIAPIPE: {
      // Bridge (MAIN world) asks us to inject MediaPipe files.
      // chrome.scripting bypasses YouTube's Trusted Types — extension privileges override page CSP.
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
      // Return true to signal async sendResponse
      return true
    }

    default:
      sendResponse({ ok: true })
      break
  }
})

async function getActiveYouTubeTabId() {
  const tabs = await chrome.tabs.query({ url: 'https://www.youtube.com/watch*' })
  if (tabs.length > 0) return tabs[0].id
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab?.id ?? null
}