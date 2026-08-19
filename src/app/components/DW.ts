import { Config } from '../config/Config'
import type {
  DeploymentConfig,
  DeploymentWindowsConfig,
  ResolvedDeployment,
  ResolvedTimes,
} from '../config/types'
import { matchesAny } from '../matching/MatchPattern'
import { Methods } from './Methods'
import { Timezones, isValidTimezone } from './Timezones'

const DEFAULT_TIME = '00:00'
const MINUTES_PER_HOUR = 60

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
   * Find the deployment whose fragment for the matched domain best identifies
   * the current URL, and build the resolved view of it.
   *
   * Matching is by substring, so fragments can overlap: "acme/repo" is
   * contained in ".../acme/repo-two". Taking the first match meant the more
   * general entry shadowed the more specific one, and which of the two won
   * depended on object key order. The longest matching fragment is the most
   * specific, so that is the one that wins.
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

    let best: { key: string; deployment: DeploymentConfig; length: number } | null =
      null

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

      // Ties keep the earlier entry, so ordering stays predictable.
      if (haystack.includes(needle) && fragment.length > (best?.length ?? 0)) {
        best = { key, deployment, length: fragment.length }
      }
    }

    return best
      ? this.buildResolved(best.key, best.deployment, domainKey)
      : null
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
    // An unrecognised zone makes dayjs throw, which previously escaped all the
    // way out and left the page with no notice at all. Fall back instead, so a
    // typo degrades to "your own timezone" rather than to nothing.
    const configured =
      typeof time?.timezone === 'string' ? time.timezone : ''
    const timezone = isValidTimezone(configured)
      ? configured
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

  /**
   * "Closes in 2h 10m", or "Opens in 45m".
   *
   * The status on its own answers whether you can deploy; this answers the
   * question everybody asks straight afterwards, which is the one you plan
   * around. Empty when the times cannot be read, so every caller can render it
   * unconditionally.
   */
  static countdownText(startTime: string, endTime: string): string {
    const countdown = Timezones.countdown(startTime, endTime)
    if (!countdown) {
      return ''
    }
    const label = Methods.i18n(
      countdown.open ? 'l10nClosesIn' : 'l10nOpensIn',
    )
    return `${label} ${DW.duration(countdown.minutes)}`
  }

  /**
   * Whole minutes as "2h 10m".
   *
   * A window never sits more than a day away, so hours are the largest unit
   * needed. Anything under a minute is worded rather than shown as "0m", which
   * reads as though it has already happened.
   */
  private static duration(minutes: number): string {
    if (minutes <= 0) {
      return Methods.i18n('l10nUnderAMinute')
    }

    const hours = Math.floor(minutes / MINUTES_PER_HOUR)
    const rest = minutes % MINUTES_PER_HOUR
    const parts: string[] = []

    if (hours > 0) {
      parts.push(`${hours}${Methods.i18n('l10nHoursShort')}`)
    }
    if (rest > 0) {
      parts.push(`${rest}${Methods.i18n('l10nMinutesShort')}`)
    }
    return parts.join(' ')
  }
}
