/**
 * MV3 service worker.
 *
 * Unlike the V2 persistent background page this replaced, the worker is torn
 * down when idle, so nothing can be cached in module scope between messages.
 * The "only change the icon when it actually changed" de-duplication that used
 * to live here now lives in the content script's Notice, which is long-lived.
 */

import { type IconState, iconPaths, isIconState } from './icons'

/**
 * The content script names a state, not a file. Chrome wants one image per
 * size, and which sizes exist is a packaging detail the page has no business
 * knowing - so the paths are expanded here, where they are already known.
 */
export interface SetIconMessage {
  icon: IconState
}

function isSetIconMessage(message: unknown): message is SetIconMessage {
  return (
    typeof message === 'object' &&
    message !== null &&
    isIconState((message as SetIconMessage).icon)
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
    .setIcon({ path: iconPaths(message.icon), tabId })
    .then(() => sendResponse({ error: false }))
    .catch((error: unknown) =>
      sendResponse({ error: true, reason: String(error) }),
    )

  // Keep the message channel open for the async setIcon above.
  return true
})
