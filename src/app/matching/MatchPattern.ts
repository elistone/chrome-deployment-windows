/**
 * Chrome extension match patterns.
 *
 * Replaces the abandoned `url-match-patterns` package (last published 2016).
 * Implements the documented grammar:
 *
 *   <scheme>://<host><path>
 *
 *   scheme  '*' (http or https only), or one of http, https, file, ftp, urn
 *   host    '*', '*.example.com' (the domain AND its subdomains), or a literal
 *           host. May be empty for file://.
 *   path    always starts with '/', '*' matches any run of characters.
 *
 * The literal '<all_urls>' matches every supported scheme.
 *
 * @see https://developer.chrome.com/docs/extensions/develop/concepts/match-patterns
 */

const ALL_URLS = '<all_urls>'

const SUPPORTED_SCHEMES = ['http', 'https', 'file', 'ftp', 'urn'] as const

/** A bare '*' scheme means http or https - not every scheme. */
const WILDCARD_SCHEMES = ['http', 'https'] as const

const PATTERN_RE = /^(\*|[a-z][a-z0-9+.-]*):\/\/(\*|\*\.[^/*]+|[^/*]*)(\/.*)$/

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Turn a pattern segment into a regex source, where only '*' is special. */
function wildcardToRegExpSource(value: string): string {
  return value.split('*').map(escapeRegExp).join('.*')
}

/**
 * Thrown for syntactically invalid patterns so bad config surfaces as a clear
 * error rather than silently never matching.
 */
export class InvalidMatchPatternError extends Error {
  constructor(pattern: string, reason: string) {
    super(`Invalid match pattern "${pattern}": ${reason}`)
    this.name = 'InvalidMatchPatternError'
  }
}

export class MatchPattern {
  private readonly schemes: readonly string[]
  private readonly hostRe: RegExp
  private readonly pathRe: RegExp

  /**
   * The host as written, including any leading `*.`.
   *
   * Kept because the options UI wants to name the site a pattern covers, and
   * re-parsing the pattern elsewhere would put the grammar in two places.
   */
  readonly host: string

  constructor(public readonly pattern: string) {
    if (pattern === ALL_URLS) {
      this.schemes = SUPPORTED_SCHEMES
      this.hostRe = /^.*$/
      this.pathRe = /^.*$/
      this.host = '*'
      return
    }

    const parts = PATTERN_RE.exec(pattern)
    if (!parts) {
      throw new InvalidMatchPatternError(
        pattern,
        'expected <scheme>://<host><path>',
      )
    }

    const [, scheme, host, path] = parts
    this.host = host

    if (scheme === '*') {
      this.schemes = WILDCARD_SCHEMES
    } else if ((SUPPORTED_SCHEMES as readonly string[]).includes(scheme)) {
      this.schemes = [scheme]
    } else {
      throw new InvalidMatchPatternError(pattern, `unsupported scheme "${scheme}"`)
    }

    if (host === '*') {
      this.hostRe = /^.*$/
    } else if (host.startsWith('*.')) {
      // '*.example.com' matches example.com and any subdomain of it, but not
      // 'notexample.com'.
      const domain = escapeRegExp(host.slice(2))
      this.hostRe = new RegExp(`^(?:.+\\.)?${domain}$`)
    } else if (host.includes('*')) {
      throw new InvalidMatchPatternError(
        pattern,
        "'*' in a host is only allowed as the whole host or as a leading '*.'",
      )
    } else {
      this.hostRe = new RegExp(`^${escapeRegExp(host)}$`)
    }

    this.pathRe = new RegExp(`^${wildcardToRegExpSource(path)}$`)
  }

  matches(url: string): boolean {
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return false
    }

    const scheme = parsed.protocol.replace(/:$/, '')
    if (!this.schemes.includes(scheme)) {
      return false
    }

    if (!this.hostRe.test(parsed.hostname)) {
      return false
    }

    // Chrome matches against the path and query string, but ignores the
    // fragment - it is never sent to a server and plays no part in matching.
    // Including it made `https://example.com/a` fail against `.../a#section`.
    return this.pathRe.test(`${parsed.pathname}${parsed.search}`)
  }
}

/**
 * Convenience wrapper. Invalid patterns never match rather than throwing, so a
 * single bad entry in user config cannot break matching for every other domain.
 */
export function matchesPattern(pattern: string, url: string): boolean {
  try {
    return new MatchPattern(pattern).matches(url)
  } catch {
    return false
  }
}

/** True when any of `patterns` matches `url`. */
export function matchesAny(patterns: readonly string[], url: string): boolean {
  return patterns.some((pattern) => matchesPattern(pattern, url))
}
