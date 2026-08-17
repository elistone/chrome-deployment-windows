import { Config } from '../config/Config'
import type {
  DeploymentConfig,
  DeploymentWindowsConfig,
  ResolvedDeployment,
  ResolvedTimes,
} from '../config/types'
import { matchesAny } from '../matching/MatchPattern'
import { Methods } from './Methods'
import { Timezones } from './Timezones'

const DEFAULT_TIME = '00:00'

/**
 * Resolves "what, if anything, should be shown for this URL".
 *
 * Construction is synchronous and takes an explicit config, which makes the
 * whole class directly testable. Use {@link DW.create} for the loading variant.
 */
export class DW {
  private readonly config: DeploymentWindowsConfig
  private readonly currentUrl: string
  private readonly domainKey: string | null
  private readonly resolved: ResolvedDeployment | null

  constructor(config: DeploymentWindowsConfig, url: string) {
    this.config = config
    this.currentUrl = url
    this.domainKey = this.findDomainKey()
    this.resolved = this.resolveDeployment()
  }

  /** Load the config from storage, then resolve against `url`. */
  static async create(url: string = window.location.href): Promise<DW> {
    return new DW(await Config.load(), url)
  }

  getConfig(): DeploymentWindowsConfig {
    return this.config
  }

  getUrl(): string {
    return this.currentUrl
  }

  /** The matched domain key (e.g. `github`), or null when nothing matched. */
  getDomainKey(): string | null {
    return this.domainKey
  }

  /** The matched deployment with times/status computed, or null. */
  getDeploymentInfo(): ResolvedDeployment | null {
    return this.resolved
  }

  hasDeployment(): boolean {
    return this.resolved !== null
  }

  /** Which configured domain, if any, does the current URL belong to? */
  private findDomainKey(): string | null {
    for (const [key, patterns] of Object.entries(this.config.domains ?? {})) {
      if (matchesAny(patterns, this.currentUrl)) {
        return key
      }
    }
    return null
  }

  /**
   * Find the first deployment whose fragment for the matched domain appears in
   * the current URL, and build the resolved view of it.
   */
  private resolveDeployment(): ResolvedDeployment | null {
    const domainKey = this.domainKey
    if (!domainKey) {
      return null
    }

    const site = this.config.sites?.[domainKey]
    if (!site) {
      // A domain can be matched without a corresponding `sites` entry, in which
      // case there is nowhere to inject and nothing to render.
      return null
    }

    for (const [key, deployment] of Object.entries(
      this.config.deployments ?? {},
    )) {
      const fragment = deployment[domainKey]
      if (typeof fragment !== 'string' || fragment.length === 0) {
        continue
      }

      const caseSensitive = deployment['case-sensitive'] === true
      const needle = caseSensitive ? fragment : fragment.toLowerCase()
      const haystack = caseSensitive
        ? this.currentUrl
        : this.currentUrl.toLowerCase()

      if (haystack.includes(needle)) {
        return this.buildResolved(key, deployment, domainKey)
      }
    }

    return null
  }

  private buildResolved(
    key: string,
    deployment: DeploymentConfig,
    domainKey: string,
  ): ResolvedDeployment {
    const timeObj = DW.buildTimes(deployment)
    const { start, end } = timeObj.local

    return {
      key,
      name: typeof deployment.name === 'string' ? deployment.name : key,
      notes: typeof deployment.notes === 'string' ? deployment.notes : '',
      notesOnly: deployment['notes-only'] === true,
      caseSensitive: deployment['case-sensitive'] === true,
      domainKey,
      domainInfo: this.config.sites[domainKey],
      timeObj,
      status: DW.statusText(start, end),
      canDeploy: DW.canDeploy(start, end),
    }
  }

  /** Build the original/local pair of windows for a deployment. */
  static buildTimes(deployment: DeploymentConfig): ResolvedTimes {
    const time = deployment.time
    const start =
      typeof time?.start === 'string' && time.start ? time.start : DEFAULT_TIME
    const end =
      typeof time?.end === 'string' && time.end ? time.end : DEFAULT_TIME
    const timezone =
      typeof time?.timezone === 'string' && time.timezone
        ? time.timezone
        : Timezones.findLocalTimezone()

    const startTime = new Timezones(start, timezone)
    const endTime = new Timezones(end, timezone)

    return {
      original: {
        start: startTime.toOriginalTime(),
        end: endTime.toOriginalTime(),
        timezone: endTime.getOriginalTimezone(),
      },
      local: {
        start: startTime.toLocalTime(),
        end: endTime.toLocalTime(),
        timezone: endTime.getLocalTimezone(),
      },
    }
  }

  static canDeploy(startTime: string, endTime: string): boolean {
    return Timezones.isDeploymentWindow(startTime, endTime)
  }

  static statusText(startTime: string, endTime: string): string {
    return DW.canDeploy(startTime, endTime)
      ? Methods.i18n('l10nDeploymentOpen')
      : Methods.i18n('l10nDeploymentClosed')
  }
}
