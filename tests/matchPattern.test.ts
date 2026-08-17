import { describe, expect, it } from 'vitest'

import {
  InvalidMatchPatternError,
  MatchPattern,
  matchesAny,
  matchesPattern,
} from '../src/app/matching/MatchPattern'

describe('MatchPattern', () => {
  describe('scheme handling', () => {
    it("treats '*' as http and https only", () => {
      expect(matchesPattern('*://example.com/*', 'http://example.com/')).toBe(true)
      expect(matchesPattern('*://example.com/*', 'https://example.com/')).toBe(true)
      expect(matchesPattern('*://example.com/*', 'ftp://example.com/')).toBe(false)
      expect(matchesPattern('*://example.com/*', 'file://example.com/')).toBe(false)
    })

    it('matches an explicit scheme exactly', () => {
      expect(matchesPattern('https://example.com/*', 'https://example.com/')).toBe(true)
      expect(matchesPattern('https://example.com/*', 'http://example.com/')).toBe(false)
    })

    it('rejects unsupported schemes', () => {
      expect(() => new MatchPattern('javascript://example.com/*')).toThrow(
        InvalidMatchPatternError,
      )
    })
  })

  describe('host handling', () => {
    it("matches any host for '*'", () => {
      expect(matchesPattern('https://*/*', 'https://anything.dev/x')).toBe(true)
    })

    it("matches the domain and its subdomains for '*.'", () => {
      const pattern = '*://*.github.com/*'
      expect(matchesPattern(pattern, 'https://github.com/elistone')).toBe(true)
      expect(matchesPattern(pattern, 'https://www.github.com/elistone')).toBe(true)
      expect(matchesPattern(pattern, 'https://a.b.github.com/elistone')).toBe(true)
    })

    it("does not let '*.' match a lookalike domain", () => {
      const pattern = '*://*.github.com/*'
      expect(matchesPattern(pattern, 'https://notgithub.com/x')).toBe(false)
      expect(matchesPattern(pattern, 'https://github.com.evil.dev/x')).toBe(false)
      expect(matchesPattern(pattern, 'https://evilgithub.com/x')).toBe(false)
    })

    it('matches a literal host exactly', () => {
      expect(matchesPattern('https://github.com/*', 'https://github.com/x')).toBe(true)
      expect(matchesPattern('https://github.com/*', 'https://www.github.com/x')).toBe(
        false,
      )
    })

    it('rejects a wildcard in the middle of a host', () => {
      expect(() => new MatchPattern('https://foo.*.com/*')).toThrow(
        InvalidMatchPatternError,
      )
    })
  })

  describe('path handling', () => {
    it('matches wildcards anywhere in the path', () => {
      expect(
        matchesPattern('https://github.com/*/pulls', 'https://github.com/acme/pulls'),
      ).toBe(true)
      expect(
        matchesPattern('https://github.com/*/pulls', 'https://github.com/acme/issues'),
      ).toBe(false)
    })

    it('requires an exact path when no wildcard is present', () => {
      expect(matchesPattern('https://example.com/exact', 'https://example.com/exact')).toBe(
        true,
      )
      expect(
        matchesPattern('https://example.com/exact', 'https://example.com/exact/more'),
      ).toBe(false)
    })

    it('includes query and fragment in the path match', () => {
      expect(
        matchesPattern('https://example.com/*', 'https://example.com/a?b=c#d'),
      ).toBe(true)
      expect(
        matchesPattern('https://example.com/a', 'https://example.com/a?b=c'),
      ).toBe(false)
    })

    it('does not treat regex metacharacters in a pattern as regex', () => {
      expect(matchesPattern('https://example.com/a.b', 'https://example.com/axb')).toBe(
        false,
      )
      expect(matchesPattern('https://example.com/a.b', 'https://example.com/a.b')).toBe(
        true,
      )
    })
  })

  describe('<all_urls>', () => {
    it('matches every supported scheme', () => {
      for (const url of [
        'http://example.com/',
        'https://example.com/',
        'ftp://example.com/',
      ]) {
        expect(matchesPattern('<all_urls>', url)).toBe(true)
      }
    })
  })

  describe('robustness', () => {
    it('returns false for an unparseable url', () => {
      expect(matchesPattern('https://*/*', 'not a url')).toBe(false)
    })

    it('returns false rather than throwing for a malformed pattern', () => {
      expect(matchesPattern('nonsense', 'https://example.com/')).toBe(false)
      expect(matchesPattern('https://example.com', 'https://example.com/')).toBe(false)
    })

    it('throws from the class constructor so bad config is diagnosable', () => {
      expect(() => new MatchPattern('nonsense')).toThrow(
        /expected <scheme>:\/\/<host><path>/,
      )
    })
  })

  describe('matchesAny', () => {
    it('is true when any pattern matches', () => {
      const patterns = ['*://*.github.com/*', '*://*.atlassian.net/*']
      expect(matchesAny(patterns, 'https://acme.atlassian.net/browse/X-1')).toBe(true)
    })

    it('is false when none match', () => {
      expect(matchesAny(['*://*.github.com/*'], 'https://example.com/')).toBe(false)
    })

    it('ignores a broken pattern but still honours the valid ones', () => {
      expect(matchesAny(['nonsense', '*://*.github.com/*'], 'https://github.com/x')).toBe(
        true,
      )
    })

    it('is false for an empty pattern list', () => {
      expect(matchesAny([], 'https://github.com/x')).toBe(false)
    })
  })
})
