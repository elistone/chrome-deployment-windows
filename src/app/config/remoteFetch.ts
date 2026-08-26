import { validateConfig } from './schema'
import { toFreezes } from '../components/freezes'
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

/** What a server says when the conditional request was answered "no". */
const NOT_MODIFIED = 304

/**
 * Ask the server whether anything has changed, rather than for the file.
 *
 * An hourly refresh that re-downloads an unchanged file all day is most of the
 * cost of having one at all. Both validators are sent when both are known:
 * servers vary in which they honour, and sending one the server ignores simply
 * means the answer arrives as a 200 with the body, which is what would have
 * happened anyway.
 */
function conditionalHeaders(cache: RemoteCache): Record<string, string> {
  const headers: Record<string, string> = {}
  if (cache.etag) {
    headers['If-None-Match'] = cache.etag
  }
  if (cache.lastModified) {
    headers['If-Modified-Since'] = cache.lastModified
  }
  return headers
}

/** Keep whatever the server offered for next time, and drop what it did not. */
function rememberValidators(cache: RemoteCache, response: Response): void {
  const etag = response.headers.get('etag')
  const lastModified = response.headers.get('last-modified')

  if (etag) {
    cache.etag = etag
  } else {
    delete cache.etag
  }
  if (lastModified) {
    cache.lastModified = lastModified
  } else {
    delete cache.lastModified
  }
}

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
  const sameUrl = previous?.url === url
  const kept = sameUrl ? previous.config : null

  const cache: RemoteCache = {
    url,
    fetchedAt: Date.now(),
    config: kept,
    error: null,
    ...(sameUrl && previous.etag ? { etag: previous.etag } : {}),
    ...(sameUrl && previous.lastModified
      ? { lastModified: previous.lastModified }
      : {}),
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
    // Only ask conditionally when there is something to fall back on. A 304
    // with nothing cached would leave the extension holding neither the old
    // config nor a new one.
    const response = await fetch(url, {
      // Our own validators do the revalidating, so the HTTP cache is left out
      // of it entirely - otherwise a 304 arrives as an opaque 200 from cache
      // and there is no way to tell a cheap refresh from an expensive one.
      cache: 'no-store',
      headers: kept ? conditionalHeaders(cache) : {},
    })

    if (response.status === NOT_MODIFIED && kept) {
      // The file has not changed. Keep everything, including the validators,
      // and record that this cost a round trip rather than a download.
      cache.unchanged = true
      await chrome.storage.local.set({ [REMOTE_CACHE_KEY]: cache })
      return cache
    }

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
    // Rebuilt section by section rather than kept whole, so a file with extra
    // keys cannot smuggle them into storage. Anything added to the config
    // shape has to be added here too - global freezes were dropped on the way
    // in until a test asked for them back.
    cache.config = {
      domains: config.domains ?? {},
      sites: config.sites ?? {},
      deployments: config.deployments ?? {},
      ...(config.freezes ? { freezes: toFreezes(config.freezes) } : {}),
    }
    cache.unchanged = false
    rememberValidators(cache, response)
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
