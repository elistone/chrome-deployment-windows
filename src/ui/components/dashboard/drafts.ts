import { Methods } from '../../../app/components/Methods'
import { Timezones, isValidTimezone } from '../../../app/components/Timezones'
import {
  WEEKDAYS,
  type Weekday,
  isEveryDay,
  toWeekdays,
} from '../../../app/components/weekdays'
import { MatchPattern } from '../../../app/matching/MatchPattern'
import { isCssSpacing } from '../../../app/config/css'
import type {
  DeploymentConfig,
  DeploymentWindowsConfig,
  InsertLocation,
  SiteConfig,
  SiteStyle,
} from '../../../app/config/types'

/**
 * Conversions between stored config and the flat, all-strings shapes the forms
 * edit, plus the validation both forms share.
 *
 * Keeping this out of the components means the rules can be tested directly,
 * and means the form never has to hold a half-built config object - the draft
 * is only turned back into config once it validates.
 */

const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/

export const DEPLOYMENT_RESERVED_KEYS = new Set([
  'name',
  'notes',
  'time',
  'case-sensitive',
  'notes-only',
])

export interface DeploymentDraft {
  key: string
  name: string
  notes: string
  notesOnly: boolean
  caseSensitive: boolean
  start: string
  end: string
  timezone: string
  /**
   * Days the window opens on. All seven, which is the default, means the same
   * as none - the form ticks them all rather than showing an empty row that
   * reads as a window that never opens.
   */
  days: Weekday[]
  /** domain key -> url fragment, one entry per configured site. */
  fragments: Record<string, string>
}

export interface SiteDraft {
  key: string
  patterns: string[]
  insert: InsertLocation[]
  /** Spacing overrides, blank when the notice's own defaults will do. */
  margin: string
  padding: string
  maxWidth: string
}

export type DraftErrors = Record<string, string>

/* ------------------------------------------------------------------ */
/* deployments                                                         */
/* ------------------------------------------------------------------ */

export function toDeploymentDraft(
  key: string,
  deployment: DeploymentConfig,
  domainKeys: string[],
): DeploymentDraft {
  const fragments: Record<string, string> = {}
  for (const domainKey of domainKeys) {
    const value = deployment[domainKey]
    fragments[domainKey] = typeof value === 'string' ? value : ''
  }

  const time = deployment.time
  const stored = toWeekdays(time?.days)

  return {
    key,
    name: typeof deployment.name === 'string' ? deployment.name : '',
    notes: typeof deployment.notes === 'string' ? deployment.notes : '',
    notesOnly: deployment['notes-only'] === true,
    caseSensitive: deployment['case-sensitive'] === true,
    start: time?.start ?? '09:00',
    end: time?.end ?? '17:00',
    timezone: time?.timezone ?? Timezones.findLocalTimezone(),
    days: stored.length > 0 ? stored : [...WEEKDAYS],
    fragments,
  }
}

export function emptyDeploymentDraft(domainKeys: string[]): DeploymentDraft {
  return toDeploymentDraft('', {}, domainKeys)
}

export function fromDeploymentDraft(draft: DeploymentDraft): DeploymentConfig {
  const deployment: DeploymentConfig = { name: draft.name.trim() }

  if (draft.notes.trim()) {
    deployment.notes = draft.notes.trim()
  }
  if (draft.notesOnly) {
    deployment['notes-only'] = true
  }
  if (draft.caseSensitive) {
    deployment['case-sensitive'] = true
  }
  // Every entry is either a window or a set of notes. A stored config may also
  // contain a deployment with no time at all, but that resolves to 00:00-00:00
  // and so reads as closed all day - the form never writes one back.
  if (!draft.notesOnly) {
    deployment.time = {
      start: draft.start.trim(),
      end: draft.end.trim(),
      timezone: draft.timezone.trim(),
    }
    // Left off entirely when the window opens every day, so a config that
    // never cared about days does not grow a key saying so.
    if (!isEveryDay(draft.days)) {
      deployment.time.days = WEEKDAYS.filter((day) => draft.days.includes(day))
    }
  }

  for (const [domainKey, fragment] of Object.entries(draft.fragments)) {
    if (fragment.trim()) {
      deployment[domainKey] = fragment.trim()
    }
  }

  return deployment
}

export function validateDeploymentDraft(
  draft: DeploymentDraft,
  takenKeys: string[],
): DraftErrors {
  const errors: DraftErrors = {}
  const key = draft.key.trim()

  if (!key) {
    errors.key = Methods.i18n('l10nRequired')
  } else if (!KEY_PATTERN.test(key)) {
    errors.key = Methods.i18n('l10nKeyFormat')
  } else if (takenKeys.includes(key)) {
    errors.key = Methods.i18n('l10nDuplicateKey')
  }

  if (!draft.name.trim()) {
    errors.name = Methods.i18n('l10nRequired')
  }

  if (!draft.notesOnly) {
    if (!TIME_PATTERN.test(draft.start.trim())) {
      errors.start = Methods.i18n('l10nInvalidTime')
    }
    if (!TIME_PATTERN.test(draft.end.trim())) {
      errors.end = Methods.i18n('l10nInvalidTime')
    }
    if (!isValidTimezone(draft.timezone.trim())) {
      errors.timezone = Methods.i18n('l10nInvalidTimezone')
    }
    // A window with no days can never open, which is never what was meant.
    if (draft.days.length === 0) {
      errors.days = Methods.i18n('l10nDaysRequired')
    }
  }

  if (draft.notesOnly && !draft.notes.trim()) {
    errors.notes = Methods.i18n('l10nNotesRequired')
  }

  // Without a fragment for at least one site there is no URL this entry could
  // ever match, so it would save cleanly and then silently do nothing.
  const hasFragment = Object.values(draft.fragments).some((value) =>
    value.trim(),
  )
  if (!hasFragment) {
    errors.fragments = Methods.i18n('l10nFragmentRequired')
  }

  return errors
}

/* ------------------------------------------------------------------ */
/* sites                                                               */
/* ------------------------------------------------------------------ */

export function toSiteDraft(
  key: string,
  patterns: string[],
  site: SiteConfig | undefined,
): SiteDraft {
  return {
    key,
    patterns: patterns.length > 0 ? [...patterns] : [''],
    insert:
      site?.insert && site.insert.length > 0
        ? site.insert.map((entry) => ({ ...entry }))
        : [{ class: '', position: 'after' }],
    margin: site?.style?.margin ?? '',
    padding: site?.style?.padding ?? '',
    maxWidth: site?.style?.maxWidth ?? '',
  }
}

export function emptySiteDraft(): SiteDraft {
  return toSiteDraft('', [], undefined)
}

export function fromSiteDraft(draft: SiteDraft): SiteConfig {
  const site: SiteConfig = {
    insert: draft.insert
      .filter((entry) => entry.class.trim())
      .map((entry) => ({ class: entry.class.trim(), position: entry.position })),
  }

  // Left off entirely when nothing was overridden, so a site that takes the
  // defaults stays as short in the JSON as it reads on the card.
  const style: SiteStyle = {}
  if (draft.margin.trim()) {
    style.margin = draft.margin.trim()
  }
  if (draft.padding.trim()) {
    style.padding = draft.padding.trim()
  }
  if (draft.maxWidth.trim()) {
    style.maxWidth = draft.maxWidth.trim()
  }
  if (Object.keys(style).length > 0) {
    site.style = style
  }

  return site
}

export function sitePatterns(draft: SiteDraft): string[] {
  return draft.patterns.map((value) => value.trim()).filter(Boolean)
}

export function validateSiteDraft(
  draft: SiteDraft,
  takenKeys: string[],
): DraftErrors {
  const errors: DraftErrors = {}
  const key = draft.key.trim()

  if (!key) {
    errors.key = Methods.i18n('l10nRequired')
  } else if (!KEY_PATTERN.test(key)) {
    errors.key = Methods.i18n('l10nKeyFormat')
  } else if (takenKeys.includes(key)) {
    errors.key = Methods.i18n('l10nDuplicateKey')
  } else if (DEPLOYMENT_RESERVED_KEYS.has(key)) {
    // Deployments store their url fragments as extra keys, so a site named
    // "notes" would collide with the deployment's own notes field.
    errors.key = Methods.i18n('l10nReservedKey')
  }

  const patterns = sitePatterns(draft)
  if (patterns.length === 0) {
    errors.patterns = Methods.i18n('l10nPatternRequired')
  } else {
    draft.patterns.forEach((pattern, index) => {
      const value = pattern.trim()
      if (!value) {
        return
      }
      try {
        new MatchPattern(value)
      } catch {
        errors[`pattern.${index}`] = Methods.i18n('l10nInvalidPattern')
      }
    })
  }

  if (draft.insert.every((entry) => !entry.class.trim())) {
    errors.insert = Methods.i18n('l10nInsertRequired')
  }

  for (const field of ['margin', 'padding', 'maxWidth'] as const) {
    const value = draft[field].trim()
    if (value && !isCssSpacing(value)) {
      errors[field] = Methods.i18n('l10nInvalidLength')
    }
  }

  return errors
}

/* ------------------------------------------------------------------ */
/* config edits                                                        */
/* ------------------------------------------------------------------ */

/** Replace (or add) a keyed entry while preserving the original ordering. */
function replaceEntry<T>(
  record: Record<string, T>,
  previousKey: string | null,
  key: string,
  value: T,
): Record<string, T> {
  if (previousKey && previousKey !== key) {
    // Rebuild in place so a rename does not shunt the entry to the end.
    return Object.fromEntries(
      Object.entries(record).map(([existing, existingValue]) =>
        existing === previousKey ? [key, value] : [existing, existingValue],
      ),
    )
  }
  return { ...record, [key]: value }
}

export function upsertDeployment(
  config: DeploymentWindowsConfig,
  previousKey: string | null,
  key: string,
  deployment: DeploymentConfig,
): DeploymentWindowsConfig {
  return {
    ...config,
    deployments: replaceEntry(
      config.deployments,
      previousKey,
      key,
      deployment,
    ),
  }
}

export function removeDeployment(
  config: DeploymentWindowsConfig,
  key: string,
): DeploymentWindowsConfig {
  const deployments = { ...config.deployments }
  delete deployments[key]
  return { ...config, deployments }
}

/**
 * Write a site back, renaming its key everywhere it is referenced.
 *
 * A site key is not just a label: every deployment stores its url fragment
 * under that key. Renaming only the site would orphan every fragment, so the
 * deployments are rewritten in the same operation.
 */
export function upsertSite(
  config: DeploymentWindowsConfig,
  previousKey: string | null,
  key: string,
  patterns: string[],
  site: SiteConfig,
): DeploymentWindowsConfig {
  const next: DeploymentWindowsConfig = {
    domains: replaceEntry(config.domains, previousKey, key, patterns),
    sites: replaceEntry(config.sites, previousKey, key, site),
    deployments: config.deployments,
  }

  if (previousKey && previousKey !== key) {
    next.deployments = Object.fromEntries(
      Object.entries(config.deployments).map(([deploymentKey, deployment]) => {
        if (!(previousKey in deployment)) {
          return [deploymentKey, deployment]
        }
        const { [previousKey]: fragment, ...rest } = deployment
        return [deploymentKey, { ...rest, [key]: fragment }]
      }),
    )
  }

  return next
}

export function removeSite(
  config: DeploymentWindowsConfig,
  key: string,
): DeploymentWindowsConfig {
  const domains = { ...config.domains }
  const sites = { ...config.sites }
  delete domains[key]
  delete sites[key]

  // Drop the now-meaningless fragments too, rather than leaving keys behind
  // that nothing resolves and the JSON view cannot explain.
  const deployments = Object.fromEntries(
    Object.entries(config.deployments).map(([deploymentKey, deployment]) => {
      if (!(key in deployment)) {
        return [deploymentKey, deployment]
      }
      const { [key]: _removed, ...rest } = deployment
      return [deploymentKey, rest]
    }),
  )

  return { domains, sites, deployments }
}

/** How many deployments would lose a url fragment if this site went away. */
export function deploymentsUsingSite(
  config: DeploymentWindowsConfig,
  key: string,
): number {
  return Object.values(config.deployments).filter(
    (deployment) => typeof deployment[key] === 'string' && deployment[key],
  ).length
}
