/**
 * MV3 service worker.
 *
 * Unlike the V2 persistent background page this replaced, the worker is torn
 * down when idle, so nothing can be cached in module scope between messages.
 * The "only change the icon when it actually changed" de-duplication that used
 * to live here now lives in the content script's Notice, which is long-lived.
 */

export interface SetIconMessage {
  newIconPath: string
}

function isSetIconMessage(message: unknown): message is SetIconMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    typeof (message as SetIconMessage).newIconPath === 'string'
  )
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!isSetIconMessage(message)) {
    sendResponse({ error: true, reason: 'unknown message' })
    return false
  }

  const tabId = sender.tab?.id
  if (tabId === undefined) {
    sendResponse({ error: true, reason: 'no sender tab' })
    return false
  }

  chrome.action
    .setIcon({ path: message.newIconPath, tabId })
    .then(() => sendResponse({ error: false }))
    .catch((error: unknown) =>
      sendResponse({ error: true, reason: String(error) }),
    )

  // Keep the message channel open for the async setIcon above.
  return true
})
