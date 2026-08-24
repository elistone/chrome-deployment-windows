import { describe, expect, it } from 'vitest'

import type { DeploymentWindowsConfig } from '../src/app/config/types'
import {
  suggestFragment,
  suggestKey,
  suggestName,
  targetFor,
} from '../src/ui/components/popup/target'
import { testConfig } from './helpers/fixtures'

function resolved(key: string, domainKey: string) {
  // Only the two fields targetFor reads; the rest of ResolvedDeployment plays
  // no part in deciding what the popup can write.
  return { key, domainKey } as Parameters<typeof targetFor>[2]
}

describe('popup target', () => {
  describe('targetFor', () => {
    it('edits whatever the page resolved to', () => {
      expect(
        targetFor(testConfig(), 'github', resolved('daytime', 'github')),
      ).toEqual({ kind: 'edit', domainKey: 'github', deploymentKey: 'daytime' })
    })

    it('offers to add where the site matched but nothing else did', () => {
      expect(targetFor(testConfig(), 'github', null)).toEqual({
        kind: 'add',
        domainKey: 'github',
      })
    })

    it('has nothing to offer on an unconfigured host', () => {
      expect(targetFor(testConfig(), null, null)).toEqual({
        kind: 'unconfigured',
      })
    })

    it('will not add to a domain with no insert rules', () => {
      // The notice would have nowhere to go, so writing the deployment would
      // produce an entry that never appears on the page it was written for.
      const config = testConfig()
      delete config.sites.github

      expect(targetFor(config, 'github', null)).toEqual({
        kind: 'no-anchor',
        domainKey: 'github',
      })
    })

    it('still edits an existing entry whose site lost its insert rules', () => {
      const config: DeploymentWindowsConfig = testConfig()
      delete config.sites.jira

      expect(
        targetFor(config, 'jira', resolved('overnight', 'jira')),
      ).toMatchObject({ kind: 'edit' })
    })
  })

  describe('suggestFragment', () => {
    it.each([
      ['https://github.com/acme/checkout', 'acme/checkout'],
      ['https://github.com/acme/checkout/pull/12', 'acme/checkout'],
      ['https://acme.atlassian.net/browse/PAY-1', 'browse/PAY-1'],
      ['https://github.com/acme', 'acme'],
      ['https://github.com/acme/checkout?tab=readme#top', 'acme/checkout'],
    ])('turns %s into %s', (url, expected) => {
      expect(suggestFragment(url)).toBe(expected)
    })

    it('falls back to the host when there is no path', () => {
      expect(suggestFragment('https://example.com/')).toBe('example.com')
    })

    it('suggests nothing for something that is not a URL', () => {
      expect(suggestFragment('chrome://extensions')).toBe('extensions')
      expect(suggestFragment('not a url')).toBe('')
    })
  })

  describe('suggestName', () => {
    it('prefers the page title', () => {
      expect(suggestName('  Acme checkout  ', 'acme/checkout')).toBe(
        'Acme checkout',
      )
    })

    it('falls back to the fragment', () => {
      expect(suggestName(undefined, 'acme/checkout')).toBe('acme/checkout')
      expect(suggestName('   ', 'acme/checkout')).toBe('acme/checkout')
    })
  })

  describe('suggestKey', () => {
    it('slugifies the name', () => {
      expect(suggestKey('Acme Checkout', [])).toBe('acme-checkout')
    })

    it('steps around a key already in use', () => {
      expect(suggestKey('Acme Checkout', ['acme-checkout'])).toBe(
        'acme-checkout-2',
      )
    })

    it('has a name of its own when the slug comes out empty', () => {
      expect(suggestKey('///', [])).toBe('deployment')
    })
  })
})
