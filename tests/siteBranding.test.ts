import { describe, expect, it, vi } from 'vitest'

import {
  faviconUrl,
  patternHost,
  siteHost,
  siteHue,
  siteInitials,
} from '../src/ui/components/dashboard/siteBranding'

describe('patternHost', () => {
  it.each([
    ['*://*.github.com/*', 'github.com'],
    ['https://gitlab.com/*', 'gitlab.com'],
    ['*://*.atlassian.net/*', 'atlassian.net'],
    ['http://localhost/*', 'localhost'],
  ])('reads %s as %s', (pattern, host) => {
    expect(patternHost(pattern)).toBe(host)
  })

  it('has no host for a wildcard host', () => {
    expect(patternHost('*://*/*')).toBeNull()
  })

  it('has no host for <all_urls>', () => {
    expect(patternHost('<all_urls>')).toBeNull()
  })

  it('returns null rather than throwing on a malformed pattern', () => {
    // A site card must still render when its config is wrong.
    expect(patternHost('not a pattern')).toBeNull()
  })
})

describe('siteHost', () => {
  it('takes the first pattern that names a host', () => {
    expect(siteHost(['*://*/*', '*://*.github.com/*'])).toBe('github.com')
  })

  it('is null when nothing names a host', () => {
    expect(siteHost(['*://*/*'])).toBeNull()
    expect(siteHost([])).toBeNull()
  })
})

describe('siteHue', () => {
  it('gives a known brand its own hue', () => {
    expect(siteHue('github', 'github.com')).toBe(220)
    expect(siteHue('gitlab', 'gitlab.com')).toBe(20)
  })

  it('recognises a brand through a subdomain', () => {
    expect(siteHue('jira', 'acme.atlassian.net')).toBe(214)
  })

  it('is stable for an unknown host', () => {
    expect(siteHue('internal', 'deploy.acme.internal')).toBe(
      siteHue('internal', 'deploy.acme.internal'),
    )
  })

  it('separates two unknown hosts', () => {
    expect(siteHue('a', 'one.example.com')).not.toBe(
      siteHue('b', 'two.example.com'),
    )
  })

  it('falls back to the site key when there is no host', () => {
    expect(siteHue('internal', null)).toBe(siteHue('internal', null))
  })

  it('always produces a usable hue', () => {
    for (const host of ['a.com', 'zzzz.example.org', 'x', 'deploy.internal']) {
      const hue = siteHue('key', host)
      expect(hue).toBeGreaterThanOrEqual(0)
      expect(hue).toBeLessThan(360)
    }
  })
})

describe('faviconUrl', () => {
  it('asks Chrome for its own cached icon', () => {
    vi.mocked(chrome.runtime.getURL).mockImplementation(
      (path: string) => `chrome-extension://abc${path}`,
    )

    const url = faviconUrl('github.com')

    // Chrome's own cache, so no request leaves the machine and no third party
    // learns which sites are configured.
    expect(url).toContain('/_favicon/')
    expect(url).toContain(encodeURIComponent('https://github.com/'))
    expect(url).toContain('size=32')
  })

  it('honours the requested size', () => {
    vi.mocked(chrome.runtime.getURL).mockImplementation((path: string) => path)
    expect(faviconUrl('github.com', 64)).toContain('size=64')
  })

  it('is null without a host', () => {
    expect(faviconUrl(null)).toBeNull()
  })

  it('is null outside an extension page', () => {
    // The dev harness and the unit tests both land here, so the caller has to
    // have something to fall back to.
    const original = globalThis.chrome
    // @ts-expect-error - deliberately removing the API the guard protects against
    delete globalThis.chrome
    try {
      expect(faviconUrl('github.com')).toBeNull()
    } finally {
      globalThis.chrome = original
    }
  })
})

describe('siteInitials', () => {
  it.each([
    ['github', 'G'],
    ['jira', 'J'],
    ['internal-tools', 'IT'],
    ['deploy board', 'DB'],
    ['a', 'A'],
  ])('reduces %s to %s', (value, expected) => {
    expect(siteInitials(value)).toBe(expected)
  })

  it('has something to show for an empty name', () => {
    expect(siteInitials('')).toBe('?')
  })
})
