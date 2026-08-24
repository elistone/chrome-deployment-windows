import type {
  DeploymentWindowsConfig,
  ResolvedDeployment,
} from '../../../app/config/types'
import { slugify, uniqueKey } from '../dashboard/support'

/**
 * What the popup would be editing, worked out from the active tab.
 *
 * The popup can only offer to add or edit where there is somewhere for the
 * result to go: a configured site that matches the current URL, with an insert
 * location the notice can use. Everything that decides that lives here rather
 * than in the component, so it can be tested against URLs directly.
 */

/** How many leading path segments to offer as the url fragment. */
const SUGGESTED_SEGMENTS = 2

export type PopupTarget =
  | { kind: 'edit'; domainKey: string; deploymentKey: string }
  | { kind: 'add'; domainKey: string }
  /** The URL matches nothing configured, so there is nothing to hang it off. */
  | { kind: 'unconfigured' }
  /** A domain matched but has no `sites` entry, so the notice has no anchor. */
  | { kind: 'no-anchor'; domainKey: string }

export function targetFor(
  config: DeploymentWindowsConfig,
  domainKey: string | null,
  deployment: ResolvedDeployment | null,
): PopupTarget {
  if (deployment) {
    return {
      kind: 'edit',
      domainKey: deployment.domainKey,
      deploymentKey: deployment.key,
    }
  }
  if (!domainKey) {
    return { kind: 'unconfigured' }
  }
  if (!config.sites[domainKey]) {
    return { kind: 'no-anchor', domainKey }
  }
  return { kind: 'add', domainKey }
}

/**
 * A starting point for the url fragment, taken from the current URL.
 *
 * Fragments are matched as a substring of the whole URL, so the first couple of
 * path segments are usually the project: `acme/checkout` on GitHub, `browse/PAY`
 * on Jira. It is a suggestion and the field stays editable - the alternative,
 * an empty box, asks someone to work out the matching rules before they can
 * write anything down.
 */
export function suggestFragment(url: string): string {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return ''
  }

  const segments = parsed.pathname.split('/').filter(Boolean)
  if (segments.length === 0) {
    return parsed.hostname
  }
  return segments.slice(0, SUGGESTED_SEGMENTS).join('/')
}

/** A page title makes a better name than a URL, when the tab has one. */
export function suggestName(title: string | undefined, fragment: string): string {
  const cleaned = (title ?? '').trim()
  return cleaned || fragment
}

/** A key derived from the name, never colliding with one already in use. */
export function suggestKey(name: string, taken: string[]): string {
  return uniqueKey(slugify(name) || 'deployment', taken)
}
