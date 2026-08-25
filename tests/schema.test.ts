import { describe, expect, it } from 'vitest'

import { isValidConfig, validateConfig } from '../src/app/config/schema'
import { defaultConfig } from '../src/app/config/Config'

describe('config schema', () => {
  it('accepts the shipped default config', () => {
    expect(validateConfig(defaultConfig())).toEqual({ valid: true, errors: [] })
  })

  it('accepts the documented example from HowToUse.md', () => {
    const example = {
      domains: {
        github: ['*://*.github.com/*'],
        jira: ['*://*.atlassian.net/*'],
      },
      sites: {
        github: {
          insert: [
            { class: 'file-navigation', position: 'after' },
            { class: 'repository-content', position: 'before' },
          ],
        },
        jira: {
          insert: [{ class: 'mod-header', position: 'before' }],
        },
      },
      deployments: {
        'chrome-deployment-windows': {
          name: 'chrome-deployment-windows',
          github: 'elistone/chrome-deployment-windows',
          jira: '',
          time: { start: '23:00', end: '10:00', timezone: 'Europe/Paris' },
          notes: 'An example of some extra notes I want to have displayed.',
        },
      },
    }

    expect(isValidConfig(example)).toBe(true)
  })

  it('still accepts a v1 config carrying its classes', () => {
    // The notice no longer borrows them, but rejecting the key would fail the
    // whole config of everyone who has not saved since.
    const config = defaultConfig() as unknown as {
      sites: Record<string, Record<string, unknown>>
    }
    config.sites.github.classes = {
      deploy: 'flash flash-success',
      'no-deploy': 'flash flash-error',
    }
    expect(isValidConfig(config)).toBe(true)
  })

  it('accepts the optional spacing overrides', () => {
    const config = defaultConfig()
    config.sites.github.style = {
      margin: '1.5rem 0',
      padding: '12px 16px',
      maxWidth: '80%',
    }
    expect(isValidConfig(config)).toBe(true)
  })

  it('accepts the optional deployment flags', () => {
    const config = defaultConfig()
    config.deployments = {
      proj: { name: 'p', 'case-sensitive': true, 'notes-only': true },
    }
    expect(isValidConfig(config)).toBe(true)
  })

  describe('rejections', () => {
    it('rejects a missing top level section', () => {
      const result = validateConfig({ domains: {}, sites: {} })
      expect(result.valid).toBe(false)
      expect(result.errors.join(' ')).toMatch(/deployments/)
    })

    it('rejects an unknown top level section', () => {
      expect(
        isValidConfig({ ...defaultConfig(), somethingElse: {} }),
      ).toBe(false)
    })

    it('rejects a non-array domain pattern list', () => {
      expect(
        isValidConfig({ ...defaultConfig(), domains: { github: 'not-an-array' } }),
      ).toBe(false)
    })

    it('rejects an empty domain pattern list', () => {
      expect(isValidConfig({ ...defaultConfig(), domains: { github: [] } })).toBe(
        false,
      )
    })

    it('rejects an invalid insert position', () => {
      const config = defaultConfig()
      config.sites.github.insert = [
        { class: 'x', position: 'sideways' as never },
      ]
      expect(isValidConfig(config)).toBe(false)
    })

    it.each(['red', '10', '1rem; position: fixed', 'url(x)', '1 2 3 4 5rem'])(
      'rejects spacing value %j',
      (margin) => {
        const config = defaultConfig()
        config.sites.github.style = { margin }
        expect(isValidConfig(config)).toBe(false)
      },
    )

    it('rejects an unknown key inside style', () => {
      const config = defaultConfig()
      config.sites.github.style = { colour: 'red' } as never
      expect(isValidConfig(config)).toBe(false)
    })

    it.each(['9:00', '25:00', '09:60', '0900', 'morning', ''])(
      'rejects malformed time %j',
      (start) => {
        const config = defaultConfig()
        config.deployments = {
          proj: { time: { start, end: '17:00', timezone: 'Europe/London' } },
        }
        expect(isValidConfig(config)).toBe(false)
      },
    )

    it.each(['00:00', '09:05', '13:59', '23:59'])(
      'accepts well formed time %j',
      (start) => {
        const config = defaultConfig()
        config.deployments = {
          proj: { time: { start, end: '23:59', timezone: 'Europe/London' } },
        }
        expect(isValidConfig(config)).toBe(true)
      },
    )

    it('rejects a time block missing its timezone', () => {
      const config = defaultConfig()
      config.deployments = {
        proj: { time: { start: '09:00', end: '17:00' } as never },
      }
      expect(isValidConfig(config)).toBe(false)
    })

    it('rejects a non-string domain fragment on a deployment', () => {
      const config = defaultConfig()
      config.deployments = { proj: { github: 42 as never } }
      expect(isValidConfig(config)).toBe(false)
    })

    it('rejects non-object input', () => {
      for (const value of [null, 'string', 42, []]) {
        expect(isValidConfig(value)).toBe(false)
      }
    })
  })

  describe('error messages', () => {
    it('reports every problem, not just the first', () => {
      const result = validateConfig({
        domains: { a: 'nope' },
        sites: { a: {} },
        deployments: {},
      })
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })

    it('includes the path to the offending value', () => {
      const config = defaultConfig()
      config.deployments = {
        proj: { time: { start: 'nope', end: '17:00', timezone: 'Europe/London' } },
      }
      const result = validateConfig(config)
      expect(result.errors.join(' ')).toMatch(
        /\/deployments\/proj\/time\/start/,
      )
    })
  })
})

describe('days', () => {
  function withDays(days: unknown) {
    return {
      domains: { github: ['*://*.github.com/*'] },
      sites: { github: { insert: [{ class: 'main', position: 'after' }] } },
      deployments: {
        a: {
          name: 'A',
          github: 'acme/a',
          time: {
            start: '09:00',
            end: '17:00',
            timezone: 'Europe/London',
            days,
          },
        },
      },
    }
  }

  it('accepts a list of short day names', () => {
    expect(validateConfig(withDays(['mon', 'tue'])).valid).toBe(true)
  })

  it('accepts an empty list, which means every day', () => {
    expect(validateConfig(withDays([])).valid).toBe(true)
  })

  it('accepts a window with no days at all', () => {
    const config = withDays([])
    delete (config.deployments.a.time as Record<string, unknown>).days
    expect(validateConfig(config).valid).toBe(true)
  })

  it('names a long day name where it was written', () => {
    // "monday" for "mon" is the mistake worth catching, and a config is read
    // and copied by people - so it is rejected rather than quietly dropped.
    const result = validateConfig(withDays(['monday']))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('/deployments/a/time/days/0')
    expect(result.errors[0]).toContain('"mon"')
  })

  it.each([['MON'], [1], [null]])('rejects %j', (entry) => {
    expect(validateConfig(withDays([entry])).valid).toBe(false)
  })

  it('rejects a repeated day', () => {
    const result = validateConfig(withDays(['mon', 'mon']))
    expect(result.valid).toBe(false)
    expect(result.errors[0]).toContain('must not repeat')
  })

  it('rejects days that are not a list', () => {
    expect(validateConfig(withDays('mon')).valid).toBe(false)
  })
})
