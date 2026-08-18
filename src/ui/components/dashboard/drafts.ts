import { Methods } from '../../../app/components/Methods'
import { Timezones, isValidTimezone } from '../../../app/components/Timezones'
import { MatchPattern } from '../../../app/matching/MatchPattern'
import type {
  DeploymentConfig,
  DeploymentWindowsConfig,
  InsertLocation,
  SiteConfig,
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
  /** domain key -> url fragment, one entry per configured site. */
  fragments: Record<string, string>
}

export interface SiteDraft {
  key: string
  patterns: string[]
  insert: InsertLocation[]
  deploy: string
  noDeploy: string
  notes: string
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

  return {
    key,
    name: typeof deployment.name === 'string' ? deployment.name : '',
    notes: typeof deployment.notes === 'string' ? deployment.notes : '',
    notesOnly: deployment['notes-only'] === true,
    caseSensitive: deployment['case-sensitive'] === true,
    start: time?.start ?? '09:00',
    end: time?.end ?? '17:00',
    timezone: time?.timezone ?? Timezones.findLocalTimezone(),
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
    deploy: site?.classes?.deploy ?? '',
    noDeploy: site?.classes?.['no-deploy'] ?? '',
    notes: site?.classes?.notes ?? '',
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
    classes: {
      deploy: draft.deploy.trim(),
      'no-deploy': draft.noDeploy.trim(),
    },
  }

  if (draft.notes.trim()) {
    site.classes.notes = draft.notes.trim()
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

  if (!draft.deploy.trim()) {
    errors.deploy = Methods.i18n('l10nRequired')
  }
  if (!draft.noDeploy.trim()) {
    errors.noDeploy = Methods.i18n('l10nRequired')
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
