import {
  REMOTE_HIDDEN_KEY,
  emptyConfig,
  isConfigEmpty,
  isHiddenEmpty,
  loadRemoteLayer,
  mergeConfigs,
  readHidden,
  splitLocal,
  visibleRemote,
} from './remote'
import type { DeploymentWindowsConfig, SiteConfig } from './types'

export const STORAGE_KEYS = {
  domains: 'DOMAINS',
  sites: 'SITES',
  deployments: 'DEPLOYMENTS',
} as const

/**
 * The fallback used when storage is completely empty, so a fresh install still
 * demonstrates something useful.
 */
export function defaultConfig(): DeploymentWindowsConfig {
  return {
    domains: {
      github: ['*://*.github.com/*'],
      jira: ['*://*.atlassian.net/*'],
    },
    sites: {
      github: {
        insert: [
          // Directly under the repository tab strip, and outside the region
          // GitHub swaps as you move between tabs. `file-navigation`, which v1
          // aimed at, no longer exists, and `repository-content` only exists
          // on a full page load - it is gone after an in-app navigation.
          { class: '#repository-container-header', position: 'after' },
          // Anything that is not a repository page - an org or user profile -
          // has no repository header, so fall back to the whole page body.
          { class: '.application-main', position: 'before' },
        ],
      },
      jira: {
        insert: [{ class: 'mod-header', position: 'before' }],
      },
    },
    deployments: {},
  }
}

/**
 * Drop v1's `classes` from a stored site.
 *
 * The notice used to be styled by borrowing the host site's own classes, which
 * meant it looked like whatever that site's CSS happened to do and broke every
 * time the site changed. It now brings its own styling, so those values have
 * nowhere to go. They are dropped on load rather than rejected, so an existing
 * config keeps working and quietly loses the dead key the next time it is
 * saved.
 */
function migrateSites(
  sites: DeploymentWindowsConfig['sites'],
): DeploymentWindowsConfig['sites'] {
  const migrated: DeploymentWindowsConfig['sites'] = {}
  for (const [key, site] of Object.entries(sites)) {
    if (!site || typeof site !== 'object') {
      continue
    }
    const { insert, style } = site as SiteConfig
    migrated[key] = style ? { insert, style } : { insert }
  }
  return migrated
}

/**
 * Reads and writes the config in chrome.storage.sync.
 *
 * v1 wrote to storage as a side effect of property assignment, which made saves
 * un-awaitable and un-testable. Loading and saving are now explicit and return
 * promises. MV3 exposes chrome.storage with native promise support, so the
 * manual callback wrapping is gone too.
 *
 * What loads is two layers: an optional shared config fetched from a URL, and
 * whatever is configured on this machine on top of it. See config/remote.ts.
 * Everything above this class - the notice, the popup, the dashboard - sees the
 * one merged config and does not have to care which layer an entry came from.
 */
export class Config {
  /** Read only what this machine has stored, with no shared layer merged in. */
  static async loadLocal(): Promise<DeploymentWindowsConfig> {
    const stored = await chrome.storage.sync.get([
      STORAGE_KEYS.domains,
      STORAGE_KEYS.sites,
      STORAGE_KEYS.deployments,
    ])

    const domains = stored[STORAGE_KEYS.domains] as
      | DeploymentWindowsConfig['domains']
      | undefined
    const sites = stored[STORAGE_KEYS.sites] as
      | DeploymentWindowsConfig['sites']
      | undefined
    const deployments = stored[STORAGE_KEYS.deployments] as
      | DeploymentWindowsConfig['deployments']
      | undefined

    return {
      domains: domains ?? {},
      sites: migrateSites(sites ?? {}),
      deployments: deployments ?? {},
    }
  }

  /**
   * Load what this machine should act on: the shared layer, minus anything
   * deleted from it, with the local layer on top.
   *
   * The defaults only stand in when both layers are empty. Someone whose whole
   * config comes from a shared file has not "got nothing configured", and
   * quietly adding GitHub and Jira underneath it would put a notice on pages
   * their team had deliberately left out.
   */
  static async load(): Promise<DeploymentWindowsConfig> {
    const local = await Config.loadLocal()
    const remote = visibleRemote(await Config.loadRemote(), await readHidden())

    if (isConfigEmpty(local) && isConfigEmpty(remote)) {
      return defaultConfig()
    }

    return mergeConfigs(remote, local)
  }

  /** The shared layer as last fetched, or an empty config when there is none. */
  static async loadRemote(): Promise<DeploymentWindowsConfig> {
    try {
      return await loadRemoteLayer()
    } catch {
      // A shared config that cannot be read is not a reason to lose the local
      // one; the options page reports the failure from the cache instead.
      return emptyConfig()
    }
  }

  /**
   * Persist the merged config, storing only what the shared layer does not
   * already say.
   *
   * Writing the whole thing would copy every shared entry into local storage,
   * where it would stop tracking the file it came from - which is the one thing
   * a shared config is for.
   */
  static async save(config: DeploymentWindowsConfig): Promise<void> {
    const remote = visibleRemote(await Config.loadRemote(), await readHidden())
    // A config assembled elsewhere may be missing a section entirely; the
    // storage layer has always filled those in rather than refusing them.
    const { local, hidden } = splitLocal(
      {
        domains: config.domains ?? {},
        sites: config.sites ?? {},
        deployments: config.deployments ?? {},
      },
      remote,
    )

    await chrome.storage.sync.set({
      [STORAGE_KEYS.domains]: local.domains,
      [STORAGE_KEYS.sites]: local.sites,
      [STORAGE_KEYS.deployments]: local.deployments,
    })

    if (isHiddenEmpty(hidden)) {
      await chrome.storage.sync.remove(REMOTE_HIDDEN_KEY)
    } else {
      await chrome.storage.sync.set({ [REMOTE_HIDDEN_KEY]: hidden })
    }
  }

  static async clear(): Promise<void> {
    await chrome.storage.sync.remove([
      STORAGE_KEYS.domains,
      STORAGE_KEYS.sites,
      STORAGE_KEYS.deployments,
      REMOTE_HIDDEN_KEY,
    ])
  }
}
