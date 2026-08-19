import type { DeploymentWindowsConfig } from './types'

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
        classes: {
          deploy: 'flash flash-success',
          'no-deploy': 'flash flash-error',
        },
      },
      jira: {
        insert: [{ class: 'mod-header', position: 'before' }],
        classes: {
          deploy: 'aui-message aui-message-success',
          'no-deploy': 'aui-message aui-message-error',
        },
      },
    },
    deployments: {},
  }
}

function isEmpty(value: object | undefined | null): boolean {
  return !value || Object.keys(value).length === 0
}

/**
 * Reads and writes the config in chrome.storage.sync.
 *
 * v1 wrote to storage as a side effect of property assignment, which made saves
 * un-awaitable and un-testable. Loading and saving are now explicit and return
 * promises. MV3 exposes chrome.storage with native promise support, so the
 * manual callback wrapping is gone too.
 */
export class Config {
  /** Load the stored config, falling back to defaults when storage is empty. */
  static async load(): Promise<DeploymentWindowsConfig> {
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

    if (isEmpty(domains) && isEmpty(sites) && isEmpty(deployments)) {
      return defaultConfig()
    }

    return {
      domains: domains ?? {},
      sites: sites ?? {},
      deployments: deployments ?? {},
    }
  }

  /** Persist the whole config in one write. */
  static async save(config: DeploymentWindowsConfig): Promise<void> {
    await chrome.storage.sync.set({
      [STORAGE_KEYS.domains]: config.domains ?? {},
      [STORAGE_KEYS.sites]: config.sites ?? {},
      [STORAGE_KEYS.deployments]: config.deployments ?? {},
    })
  }

  static async clear(): Promise<void> {
    await chrome.storage.sync.remove([
      STORAGE_KEYS.domains,
      STORAGE_KEYS.sites,
      STORAGE_KEYS.deployments,
    ])
  }
}
