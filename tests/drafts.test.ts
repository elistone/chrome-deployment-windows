import { describe, expect, it } from 'vitest'

import {
  deploymentsUsingSite,
  emptyDeploymentDraft,
  emptySiteDraft,
  fromDeploymentDraft,
  fromSiteDraft,
  removeDeployment,
  removeSite,
  sitePatterns,
  toDeploymentDraft,
  toSiteDraft,
  upsertDeployment,
  upsertSite,
  validateDeploymentDraft,
  validateSiteDraft,
  type DeploymentDraft,
  type SiteDraft,
} from '../src/ui/components/dashboard/drafts'
import { slugify, uniqueKey } from '../src/ui/components/dashboard/support'
import { testConfig } from './helpers/fixtures'

const DOMAINS = ['github', 'jira']

function deploymentDraft(
  overrides: Partial<DeploymentDraft> = {},
): DeploymentDraft {
  return {
    ...emptyDeploymentDraft(DOMAINS),
    key: 'checkout',
    name: 'Checkout',
    start: '09:00',
    end: '17:00',
    timezone: 'Europe/London',
    fragments: { github: 'acme/checkout', jira: '' },
    ...overrides,
  }
}

function siteDraft(overrides: Partial<SiteDraft> = {}): SiteDraft {
  return {
    ...emptySiteDraft(),
    key: 'github',
    patterns: ['*://*.github.com/*'],
    insert: [{ class: 'file-navigation', position: 'after' }],
    deploy: 'flash flash-success',
    noDeploy: 'flash flash-error',
    ...overrides,
  }
}

describe('deployment drafts', () => {
  describe('round trip', () => {
    it('reads an existing deployment into a draft', () => {
      const config = testConfig()
      const draft = toDeploymentDraft('daytime', config.deployments.daytime, DOMAINS)

      expect(draft.name).toBe('Daytime project')
      expect(draft.start).toBe('09:00')
      expect(draft.timezone).toBe('Europe/London')
      expect(draft.fragments).toEqual({ github: 'acme/daytime', jira: '' })
    })

    it('keeps the flags', () => {
      const config = testConfig()
      const draft = toDeploymentDraft('cased', config.deployments.cased, DOMAINS)
      expect(draft.caseSensitive).toBe(true)
      expect(draft.notesOnly).toBe(false)
    })

    it('writes a draft back to the stored shape', () => {
      expect(fromDeploymentDraft(deploymentDraft())).toEqual({
        name: 'Checkout',
        github: 'acme/checkout',
        time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
      })
    })

    it('omits blank fragments rather than storing empty strings', () => {
      const result = fromDeploymentDraft(deploymentDraft())
      expect('jira' in result).toBe(false)
    })

    it('omits false flags rather than storing them', () => {
      const result = fromDeploymentDraft(deploymentDraft())
      expect('case-sensitive' in result).toBe(false)
      expect('notes-only' in result).toBe(false)
    })

    it('drops the window from a notes-only entry', () => {
      const result = fromDeploymentDraft(
        deploymentDraft({ notesOnly: true, notes: 'Frozen.' }),
      )
      expect('time' in result).toBe(false)
      expect(result['notes-only']).toBe(true)
      expect(result.notes).toBe('Frozen.')
    })

    it('trims whitespace out of the values it stores', () => {
      const result = fromDeploymentDraft(
        deploymentDraft({
          name: '  Checkout  ',
          fragments: { github: '  acme/checkout ', jira: '   ' },
        }),
      )
      expect(result.name).toBe('Checkout')
      expect(result.github).toBe('acme/checkout')
      expect('jira' in result).toBe(false)
    })

    it('survives a full round trip unchanged', () => {
      const config = testConfig()
      const draft = toDeploymentDraft(
        'overnight',
        config.deployments.overnight,
        DOMAINS,
      )
      expect(fromDeploymentDraft(draft)).toEqual(config.deployments.overnight)
    })
  })

  describe('validation', () => {
    it('accepts a complete draft', () => {
      expect(validateDeploymentDraft(deploymentDraft(), [])).toEqual({})
    })

    it('requires a key and a name', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({ key: '', name: '' }),
        [],
      )
      expect(errors.key).toBe('Required')
      expect(errors.name).toBe('Required')
    })

    it('rejects a key with punctuation in it', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({ key: 'not a key!' }),
        [],
      )
      expect(errors.key).toMatch(/letters, numbers/)
    })

    it('rejects a key already in use', () => {
      const errors = validateDeploymentDraft(deploymentDraft(), ['checkout'])
      expect(errors.key).toMatch(/already in use/)
    })

    it('rejects a malformed time', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({ start: '9am', end: '25:00' }),
        [],
      )
      expect(errors.start).toMatch(/24 hour/)
      expect(errors.end).toMatch(/24 hour/)
    })

    it('rejects an unknown timezone', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({ timezone: 'Not/AZone' }),
        [],
      )
      expect(errors.timezone).toBe('Unknown timezone.')
    })

    it('skips the window rules entirely for a notes-only entry', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({
          notesOnly: true,
          notes: 'Frozen.',
          start: 'nonsense',
          timezone: 'Not/AZone',
        }),
        [],
      )
      expect(errors.start).toBeUndefined()
      expect(errors.timezone).toBeUndefined()
    })

    it('requires notes on a notes-only entry', () => {
      const errors = validateDeploymentDraft(
        deploymentDraft({ notesOnly: true, notes: '' }),
        [],
      )
      expect(errors.notes).toMatch(/needs some notes/)
    })

    it('requires at least one url fragment', () => {
      // Without one there is no page this entry could ever match, so it would
      // save happily and then do nothing at all.
      const errors = validateDeploymentDraft(
        deploymentDraft({ fragments: { github: '', jira: '' } }),
        [],
      )
      expect(errors.fragments).toMatch(/at least one site/)
    })
  })
})

describe('site drafts', () => {
  it('reads an existing site into a draft', () => {
    const config = testConfig()
    const draft = toSiteDraft('github', config.domains.github, config.sites.github)

    expect(draft.patterns).toEqual(['*://*.github.com/*'])
    expect(draft.insert).toHaveLength(2)
    expect(draft.deploy).toBe('flash flash-success')
    expect(draft.notes).toBe('flash flash-warn')
  })

  it('starts an empty draft with one blank row of each kind', () => {
    const draft = emptySiteDraft()
    expect(draft.patterns).toEqual([''])
    expect(draft.insert).toEqual([{ class: '', position: 'after' }])
  })

  it('writes a draft back to the stored shape', () => {
    expect(fromSiteDraft(siteDraft())).toEqual({
      insert: [{ class: 'file-navigation', position: 'after' }],
      classes: { deploy: 'flash flash-success', 'no-deploy': 'flash flash-error' },
    })
  })

  it('omits an empty notes class rather than storing a blank one', () => {
    expect('notes' in fromSiteDraft(siteDraft()).classes).toBe(false)
  })

  it('drops blank rows on the way out', () => {
    const result = fromSiteDraft(
      siteDraft({
        insert: [
          { class: 'file-navigation', position: 'after' },
          { class: '   ', position: 'before' },
        ],
      }),
    )
    expect(result.insert).toHaveLength(1)
  })

  it('drops blank patterns on the way out', () => {
    expect(sitePatterns(siteDraft({ patterns: ['a', '  ', 'b'] }))).toEqual([
      'a',
      'b',
    ])
  })

  describe('validation', () => {
    it('accepts a complete draft', () => {
      expect(validateSiteDraft(siteDraft(), [])).toEqual({})
    })

    it('rejects an invalid match pattern, naming the row', () => {
      const errors = validateSiteDraft(
        siteDraft({ patterns: ['*://*.github.com/*', 'not-a-pattern'] }),
        [],
      )
      expect(errors['pattern.1']).toBe('Not a valid match pattern.')
      expect(errors['pattern.0']).toBeUndefined()
    })

    it('requires at least one pattern', () => {
      const errors = validateSiteDraft(siteDraft({ patterns: [''] }), [])
      expect(errors.patterns).toMatch(/at least one URL pattern/)
    })

    it('requires somewhere to insert the notice', () => {
      const errors = validateSiteDraft(
        siteDraft({ insert: [{ class: '', position: 'after' }] }),
        [],
      )
      expect(errors.insert).toMatch(/at least one place/)
    })

    it('requires both status classes', () => {
      const errors = validateSiteDraft(
        siteDraft({ deploy: '', noDeploy: '' }),
        [],
      )
      expect(errors.deploy).toBe('Required')
      expect(errors.noDeploy).toBe('Required')
    })

    it('rejects a key that would collide with a deployment field', () => {
      // Deployments keep their url fragments as extra top level keys, so a
      // site called "notes" would be indistinguishable from the notes text.
      const errors = validateSiteDraft(siteDraft({ key: 'notes' }), [])
      expect(errors.key).toMatch(/reserved/)
    })
  })
})

describe('config edits', () => {
  it('adds a deployment', () => {
    const config = testConfig()
    const next = upsertDeployment(config, null, 'added', { name: 'Added' })
    expect(next.deployments.added).toEqual({ name: 'Added' })
    expect(config.deployments.added).toBeUndefined()
  })

  it('edits a deployment in place, keeping its position', () => {
    const config = testConfig()
    const next = upsertDeployment(config, 'overnight', 'overnight', {
      name: 'Renamed',
    })
    expect(Object.keys(next.deployments)).toEqual(Object.keys(config.deployments))
  })

  it('keeps a renamed deployment in its original position', () => {
    const config = testConfig()
    const next = upsertDeployment(config, 'overnight', 'nightly', { name: 'N' })
    expect(Object.keys(next.deployments)[1]).toBe('nightly')
    expect(next.deployments.overnight).toBeUndefined()
  })

  it('removes a deployment', () => {
    const config = testConfig()
    const next = removeDeployment(config, 'daytime')
    expect(next.deployments.daytime).toBeUndefined()
    expect(config.deployments.daytime).toBeDefined()
  })

  describe('sites', () => {
    it('writes both the patterns and the site entry', () => {
      const config = testConfig()
      const next = upsertSite(
        config,
        null,
        'gitlab',
        ['*://gitlab.com/*'],
        fromSiteDraft(siteDraft({ key: 'gitlab' })),
      )
      expect(next.domains.gitlab).toEqual(['*://gitlab.com/*'])
      expect(next.sites.gitlab.classes.deploy).toBe('flash flash-success')
    })

    it('carries deployment fragments across a rename', () => {
      // The site key is what every deployment stores its fragment under, so a
      // rename that only touched domains/sites would orphan all of them.
      const config = testConfig()
      const next = upsertSite(
        config,
        'github',
        'gh',
        config.domains.github,
        config.sites.github,
      )

      expect(next.deployments.daytime.gh).toBe('acme/daytime')
      expect('github' in next.deployments.daytime).toBe(false)
      expect(next.domains.gh).toBeDefined()
      expect(next.domains.github).toBeUndefined()
    })

    it('leaves deployments alone when the key does not change', () => {
      const config = testConfig()
      const next = upsertSite(
        config,
        'github',
        'github',
        ['*://*.github.com/*'],
        config.sites.github,
      )
      expect(next.deployments).toBe(config.deployments)
    })

    it('removes a site and the fragments that pointed at it', () => {
      const config = testConfig()
      const next = removeSite(config, 'jira')

      expect(next.domains.jira).toBeUndefined()
      expect(next.sites.jira).toBeUndefined()
      expect('jira' in next.deployments.overnight).toBe(false)
      expect(next.deployments.overnight.github).toBe('acme/overnight')
    })

    it('counts the deployments that would be affected', () => {
      const config = testConfig()
      expect(deploymentsUsingSite(config, 'github')).toBe(5)
      expect(deploymentsUsingSite(config, 'jira')).toBe(1)
    })
  })
})

describe('key helpers', () => {
  it.each([
    ['Checkout API', 'checkout-api'],
    ['  Spaces  ', 'spaces'],
    ['Weird!!Chars??', 'weird-chars'],
    ['ALLCAPS', 'allcaps'],
  ])('slugifies %j to %j', (input, expected) => {
    expect(slugify(input)).toBe(expected)
  })

  it('leaves an unused key alone', () => {
    expect(uniqueKey('checkout', ['other'])).toBe('checkout')
  })

  it('suffixes a taken key until it is free', () => {
    expect(uniqueKey('checkout', ['checkout'])).toBe('checkout-2')
    expect(uniqueKey('checkout', ['checkout', 'checkout-2'])).toBe('checkout-3')
  })
})
