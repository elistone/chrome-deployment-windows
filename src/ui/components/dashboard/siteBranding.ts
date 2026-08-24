import { MatchPattern } from '../../../app/matching/MatchPattern'

/**
 * Gives each site card an identity of its own: the host it covers, that host's
 * favicon, and a colour that leans on the site's own branding.
 *
 * A configuration listing github, jira and an internal tool is much easier to
 * scan when the three do not look identical, and the host is information the
 * patterns already contain but never showed.
 */

/**
 * Hues for hosts common enough to be recognisable. Only the hue is fixed - the
 * saturation and lightness come from CSS, so the same accent works in both
 * themes rather than being legible in one and invisible in the other.
 */
const BRAND_HUES: Record<string, number> = {
  'github.com': 220,
  'gitlab.com': 20,
  'atlassian.net': 214,
  'atlassian.com': 214,
  'bitbucket.org': 210,
  'azure.com': 205,
  'visualstudio.com': 205,
  'sentry.io': 285,
  'jenkins.io': 355,
  'circleci.com': 150,
  'netlify.app': 175,
  'vercel.app': 260,
  'heroku.com': 265,
}

/** The host a pattern covers, with any leading `*.` removed. */
export function patternHost(pattern: string): string | null {
  try {
    const host = new MatchPattern(pattern).host
    if (host === '*') {
      return null
    }
    return host.startsWith('*.') ? host.slice(2) : host
  } catch {
    return null
  }
}

/** The first host any of a site's patterns names, for display and favicons. */
export function siteHost(patterns: readonly string[]): string | null {
  for (const pattern of patterns) {
    const host = patternHost(pattern)
    if (host) {
      return host
    }
  }
  return null
}

/** The registrable-ish tail of a host, so `id.atlassian.net` finds Atlassian. */
function brandKey(host: string): string {
  const labels = host.split('.')
  return labels.slice(-2).join('.')
}

/** Stable, evenly spread, and the same on every machine. */
function hashHue(value: string): number {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 360
  }
  return hash
}

/**
 * A hue for the site. Known brands keep theirs; anything else gets a stable one
 * derived from its name, so an internal tool is still distinguishable from its
 * neighbours.
 */
export function siteHue(key: string, host: string | null): number {
  if (host) {
    const brand = BRAND_HUES[brandKey(host)]
    if (brand !== undefined) {
      return brand
    }
  }
  return hashHue(host ?? key)
}

/**
 * Chrome's own favicon cache, which needs no network request and leaks nothing
 * about the configured sites. Returns null outside an extension page - the dev
 * harness and the tests both land there - so the caller can fall back.
 */
export function faviconUrl(host: string | null, size = 32): string | null {
  if (!host) {
    return null
  }
  try {
    const getURL = chrome?.runtime?.getURL
    if (typeof getURL !== 'function') {
      return null
    }
    const target = new URL(`https://${host}`)
    return getURL(
      `/_favicon/?pageUrl=${encodeURIComponent(target.href)}&size=${size}`,
    )
  } catch {
    return null
  }
}

/**
 * The placeholder shown when there is no favicon.
 *
 * One letter for a single word and two for a compound one - `github` reads
 * better as "G" than as "GI", while `internal-tools` needs both to be
 * distinguishable from its neighbours.
 */
export function siteInitials(value: string): string {
  const words = value.split(/[^A-Za-z0-9]+/).filter(Boolean)
  if (words.length === 0) {
    return '?'
  }
  if (words.length === 1) {
    return words[0][0].toUpperCase()
  }
  return (words[0][0] + words[1][0]).toUpperCase()
}
