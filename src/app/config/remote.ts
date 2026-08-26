import type { DeploymentWindowsConfig } from './types'

/**
 * A shared config, fetched from a URL someone else maintains.
 *
 * A team deploys the same projects to the same windows, so keeping that in one
 * place beats everyone typing it in. The fetched config is a *layer*: it is
 * merged underneath whatever is configured locally, so any entry can still be
 * corrected on the machine that needs it corrected, without the change having
 * to go anywhere near whoever owns the file.
 *
 * The URL lives in sync storage, so it follows the user between machines. What
 * came back does not - it is a cache, it can be several kilobytes, and sync
 * storage has an 8KB-per-item quota that a real team's config would break.
 */

/** Where the shared config is fetched from. Synced. */
export const REMOTE_URL_KEY = 'REMOTE_URL'

/**
 * Keys hidden from the shared layer.
 *
 * Deleting a shared entry cannot delete it at the source, so it is remembered
 * as a deletion instead. Without this the entry would simply come back the next
 * time the page was opened, which reads as the delete having failed.
 */
export const REMOTE_HIDDEN_KEY = 'REMOTE_HIDDEN'

/** The last fetch: what it returned, when, and whether it worked. Local. */
export const REMOTE_CACHE_KEY = 'REMOTE_CACHE'

export interface RemoteCache {
  /** The URL this was fetched from, so a changed URL invalidates it. */
  url: string
  /** Epoch milliseconds of the last attempt, successful or not. */
  fetchedAt: number
  /** The last config that parsed, kept through a failed refresh. */
  config: DeploymentWindowsConfig | null
  /** Why the last attempt failed, or null when it did not. */
  error: string | null
  /**
   * What the server said last time, so the next fetch can ask whether anything
   * has changed rather than asking for the whole file again.
   */
  etag?: string
  lastModified?: string
  /** True when the last refresh was answered "nothing has changed". */
  unchanged?: boolean
}

export interface HiddenKeys {
  domains: string[]
  sites: string[]
  deployments: string[]
}

const SECTIONS = ['domains', 'sites', 'deployments'] as const

export function emptyConfig(): DeploymentWindowsConfig {
  return { domains: {}, sites: {}, deployments: {} }
}

export function emptyHidden(): HiddenKeys {
  return { domains: [], sites: [], deployments: [] }
}

export function isConfigEmpty(config: DeploymentWindowsConfig): boolean {
  return SECTIONS.every((section) => Object.keys(config[section]).length === 0)
}

function without<T>(
  record: Record<string, T>,
  hidden: string[],
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(record).filter(([key]) => !hidden.includes(key)),
  )
}

/**
 * The shared layer with deletions applied, ready to be merged under the local
 * one.
 */
export function visibleRemote(
  remote: DeploymentWindowsConfig,
  hidden: HiddenKeys,
): DeploymentWindowsConfig {
  return {
    domains: without(remote.domains, hidden.domains),
    sites: without(remote.sites, hidden.sites),
    deployments: without(remote.deployments, hidden.deployments),
    // Not hideable: the freeze list is one value rather than a set of keyed
    // entries, so there is nothing to hide individually. Replacing it locally
    // is how you get rid of one.
    ...(remote.freezes ? { freezes: remote.freezes } : {}),
  }
}

/**
 * Local entries win, key by key.
 *
 * The global freezes are the exception, because they are a list rather than a
 * record and there is no key to win on. They are treated as one value: a local
 * list replaces the shared one outright. Concatenating instead would read
 * better right up until someone tried to remove a freeze the file had put
 * there, and found they could not.
 */
export function mergeConfigs(
  remote: DeploymentWindowsConfig,
  local: DeploymentWindowsConfig,
): DeploymentWindowsConfig {
  const freezes = local.freezes ?? remote.freezes

  return {
    domains: { ...remote.domains, ...local.domains },
    sites: { ...remote.sites, ...local.sites },
    deployments: { ...remote.deployments, ...local.deployments },
    ...(freezes && freezes.length > 0 ? { freezes } : {}),
  }
}

/** Key order is not meaning, so it must not decide whether two entries match. */
function stable(value: unknown): string {
  return JSON.stringify(value, (_key, inner: unknown) => {
    if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
      const record = inner as Record<string, unknown>
      return Object.fromEntries(
        Object.keys(record)
          .sort()
          .map((key) => [key, record[key]]),
      )
    }
    return inner
  })
}

/**
 * Work out what the local layer has to hold for `merged` to be what loads.
 *
 * Anything identical to the shared copy is left out rather than written down:
 * copying it locally would freeze it, and the whole point of the shared file is
 * that a change to it reaches everyone. Anything the shared layer has and
 * `merged` does not was deleted, and is remembered as such.
 */
function diffSection<T>(
  current: Record<string, T>,
  shared: Record<string, unknown>,
): { own: Record<string, T>; missing: string[] } {
  const own: Record<string, T> = {}
  for (const [key, value] of Object.entries(current)) {
    if (key in shared && stable(shared[key]) === stable(value)) {
      continue
    }
    own[key] = value
  }
  const missing = Object.keys(shared).filter((key) => !(key in current))
  return { own, missing }
}

export function splitLocal(
  merged: DeploymentWindowsConfig,
  remote: DeploymentWindowsConfig,
): { local: DeploymentWindowsConfig; hidden: HiddenKeys } {
  const domains = diffSection(merged.domains, remote.domains)
  const sites = diffSection(merged.sites, remote.sites)
  const deployments = diffSection(merged.deployments, remote.deployments)

  // One value, compared whole: identical to the shared list means it is still
  // the shared list, and nothing needs storing.
  const freezes = merged.freezes ?? []
  const ownFreezes =
    stable(freezes) === stable(remote.freezes ?? []) ? [] : freezes

  return {
    local: {
      domains: domains.own,
      sites: sites.own,
      deployments: deployments.own,
      ...(ownFreezes.length > 0 ? { freezes: ownFreezes } : {}),
    },
    hidden: {
      domains: domains.missing,
      sites: sites.missing,
      deployments: deployments.missing,
    },
  }
}

export function isHiddenEmpty(hidden: HiddenKeys): boolean {
  return SECTIONS.every((section) => hidden[section].length === 0)
}

/** Only https, so a shared config cannot be fetched over a readable connection. */
export function isUsableRemoteUrl(url: string): boolean {
  try {
    return new URL(url).protocol === 'https:'
  } catch {
    return false
  }
}

export async function readRemoteUrl(): Promise<string> {
  const stored = await chrome.storage.sync.get(REMOTE_URL_KEY)
  const url = stored[REMOTE_URL_KEY]
  return typeof url === 'string' ? url : ''
}

export async function readHidden(): Promise<HiddenKeys> {
  const stored = await chrome.storage.sync.get(REMOTE_HIDDEN_KEY)
  const value = stored[REMOTE_HIDDEN_KEY] as Partial<HiddenKeys> | undefined
  const hidden = emptyHidden()
  for (const section of SECTIONS) {
    const list = value?.[section]
    if (Array.isArray(list)) {
      hidden[section] = list.filter((key): key is string => typeof key === 'string')
    }
  }
  return hidden
}

export async function readCache(): Promise<RemoteCache | null> {
  const stored = await chrome.storage.local.get(REMOTE_CACHE_KEY)
  const cache = stored[REMOTE_CACHE_KEY] as RemoteCache | undefined
  return cache ?? null
}

/**
 * The shared layer as it stands: the cached config, or nothing at all when no
 * URL is set or the URL has moved on since the cache was written.
 */
export async function loadRemoteLayer(): Promise<DeploymentWindowsConfig> {
  const url = await readRemoteUrl()
  if (!url) {
    return emptyConfig()
  }

  const cache = await readCache()
  if (!cache || cache.url !== url || !cache.config) {
    return emptyConfig()
  }

  return cache.config
}
