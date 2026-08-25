/**
 * MV3 service worker.
 *
 * Unlike the V2 persistent background page this replaced, the worker is torn
 * down when idle, so nothing can be cached in module scope between messages.
 * The "only change the icon when it actually changed" de-duplication that used
 * to live here now lives in the content script's Notice, which is long-lived.
 */

import {
  REFRESH_INTERVAL_MINUTES,
  refreshRemote,
} from './config/remoteFetch'
import { type IconState, iconPaths, isIconState } from './icons'

/** The recurring re-fetch of the shared config, if one is configured. */
const REFRESH_ALARM = 'refresh-remote-config'

/**
 * Keep the shared config current.
 *
 * The alarm is what does the work: this worker does not stay running, so a
 * setInterval would last only as long as the browser happened to keep it alive.
 * Creating an alarm that already exists just updates it, so re-running this on
 * every startup is safe and is what repairs a schedule lost to an update.
 */
async function scheduleRefresh(): Promise<void> {
  await chrome.alarms.create(REFRESH_ALARM, {
    periodInMinutes: REFRESH_INTERVAL_MINUTES,
  })
  await refreshRemote()
}

chrome.runtime.onInstalled.addListener(() => {
  void scheduleRefresh()
})

chrome.runtime.onStartup.addListener(() => {
  void scheduleRefresh()
})

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === REFRESH_ALARM) {
    void refreshRemote()
  }
})

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
