import { validateConfig } from './schema'
import {
  REMOTE_CACHE_KEY,
  REMOTE_URL_KEY,
  isUsableRemoteUrl,
  readCache,
  readRemoteUrl,
  type RemoteCache,
} from './remote'
import type { DeploymentWindowsConfig } from './types'

/**
 * Fetching the shared config, kept apart from reading it.
 *
 * Only the service worker and the options page ever fetch. The content script
 * only ever reads what was already cached, and it runs on every page you
 * visit - so the JSON schema validator, which is the expensive part of this
 * file, has no business being in its bundle. Splitting the two is what keeps
 * it out.
 */

/** Refuse anything larger; a config this big is a wrong URL, not a config. */
const MAX_BYTES = 512 * 1024

/** How long a cached copy is used before the next fetch is worth making. */
export const REFRESH_INTERVAL_MINUTES = 60

/**
 * Fetch the shared config and cache whatever came back.
 *
 * Never throws and never rejects: it is called from a service worker alarm as
 * well as from a button, and a shared file that is briefly missing must not
 * take the extension down with it. A failure is written into the cache so the
 * options page can say what happened, and the last config that did parse is
 * kept so the notice carries on working meanwhile.
 */
export async function refreshRemote(): Promise<RemoteCache> {
  const url = await readRemoteUrl()
  const previous = await readCache()
  const kept = previous?.url === url ? previous.config : null

  const cache: RemoteCache = {
    url,
    fetchedAt: Date.now(),
    config: kept,
    error: null,
  }

  if (!url) {
    await chrome.storage.local.remove(REMOTE_CACHE_KEY)
    return { ...cache, config: null }
  }

  if (!isUsableRemoteUrl(url)) {
    cache.error = 'The shared config URL must be an https:// address.'
    await chrome.storage.local.set({ [REMOTE_CACHE_KEY]: cache })
    return cache
  }

  try {
    const response = await fetch(url, { cache: 'no-cache' })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`.trim())
    }

    const text = await response.text()
    if (text.length > MAX_BYTES) {
      throw new Error('the file is too large to be a config')
    }

    const parsed: unknown = JSON.parse(text)
    const validation = validateConfig(parsed)
    if (!validation.valid) {
      throw new Error(validation.errors[0] ?? 'it is not a valid config')
    }

    const config = parsed as DeploymentWindowsConfig
    cache.config = {
      domains: config.domains ?? {},
      sites: config.sites ?? {},
      deployments: config.deployments ?? {},
    }
  } catch (error: unknown) {
    cache.error = error instanceof Error ? error.message : String(error)
  }

  await chrome.storage.local.set({ [REMOTE_CACHE_KEY]: cache })
  return cache
}

/** Point at a different shared config, and pull it straight away. */
export async function setRemoteUrl(url: string): Promise<RemoteCache> {
  const trimmed = url.trim()
  if (trimmed) {
    await chrome.storage.sync.set({ [REMOTE_URL_KEY]: trimmed })
  } else {
    await chrome.storage.sync.remove(REMOTE_URL_KEY)
  }
  return refreshRemote()
}
