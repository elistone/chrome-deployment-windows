/**
 * Shapes for the user-editable configuration, plus the resolved view of a
 * deployment that the notice and popup render from.
 */

import type { Weekday } from '../components/weekdays'

export type InsertPosition = 'before' | 'after'

export interface InsertLocation {
  class: string
  position: InsertPosition
}

/**
 * Per-site spacing for the notice.
 *
 * The notice brings its own styling now, but every host page puts it in a
 * slightly different place, so the gap around it is worth being able to nudge.
 * Values are CSS lengths, checked before they are applied.
 */
export interface SiteStyle {
  /** Space outside the notice, e.g. `1.5rem 0`. */
  margin?: string
  /** Space inside it. */
  padding?: string
  /** Overrides the default reading width. */
  maxWidth?: string
}

export interface SiteConfig {
  insert: InsertLocation[]
  style?: SiteStyle
}

export interface DeploymentTime {
  /** 24 hour HH:mm */
  start: string
  /** 24 hour HH:mm */
  end: string
  /** IANA timezone, e.g. Europe/London */
  timezone: string
  /**
   * Days the window opens on, e.g. `["mon", "tue", "wed", "thu"]`.
   *
   * Absent means every day, which is what every config written before this
   * existed means. A day names when the window *opens*: a Monday 23:00-02:00
   * window runs into Tuesday morning and is still Monday's window.
   */
  days?: Weekday[]
}

/**
 * A configured deployment. Alongside the known keys, any additional string
 * property is treated as "url fragment for the domain of this key" - e.g.
 * `github: "elistone/chrome-deployment-windows"`.
 */
export interface DeploymentConfig {
  name?: string
  notes?: string
  time?: DeploymentTime
  'case-sensitive'?: boolean
  'notes-only'?: boolean
  [domainKey: string]: string | boolean | DeploymentTime | undefined
}

export interface DeploymentWindowsConfig {
  /** domain key -> match patterns */
  domains: Record<string, string[]>
  /** domain key -> where and how to inject */
  sites: Record<string, SiteConfig>
  /** deployment key -> deployment */
  deployments: Record<string, DeploymentConfig>
}

export interface ResolvedTimeWindow {
  start: string
  end: string
  timezone: string
  /**
   * Days this window opens on, in this window's own terms. Empty means every
   * day. On the local window these are shifted with the times, so a Monday in
   * Tokyo can read as a Sunday in Los Angeles - which is what the viewer's
   * calendar actually says.
   */
  days: Weekday[]
}

export interface ResolvedTimes {
  /** The window as configured, in its own timezone. */
  original: ResolvedTimeWindow
  /** The same window converted into the viewer's timezone. */
  local: ResolvedTimeWindow
}

/**
 * A deployment matched against the current URL, with everything the UI needs
 * already computed. Unlike the v1 implementation this is a fresh object - it
 * never mutates the stored config.
 */
export interface ResolvedDeployment {
  /** The deployment's key in `config.deployments`. */
  key: string
  name: string
  notes: string
  notesOnly: boolean
  caseSensitive: boolean
  /** The matched domain key, e.g. `github`. */
  domainKey: string
  /** Insert locations and classes for the matched domain. */
  domainInfo: SiteConfig
  timeObj: ResolvedTimes
  /** Localised "open"/"closed" text. */
  status: string
  canDeploy: boolean
}
