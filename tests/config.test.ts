import { describe, expect, it } from 'vitest'

import { Config, STORAGE_KEYS, defaultConfig } from '../src/app/config/Config'
import { chromeMock, seedStorage } from './helpers/chromeMock'

describe('Config', () => {
  describe('load', () => {
    it('falls back to the default config when storage is empty', async () => {
      const config = await Config.load()
      expect(config).toEqual(defaultConfig())
      expect(Object.keys(config.domains)).toEqual(['github', 'jira'])
    })

    it('falls back when every stored value is an empty object', async () => {
      seedStorage({
        [STORAGE_KEYS.domains]: {},
        [STORAGE_KEYS.sites]: {},
        [STORAGE_KEYS.deployments]: {},
      })
      expect(await Config.load()).toEqual(defaultConfig())
    })

    it('returns stored values when present', async () => {
      seedStorage({
        [STORAGE_KEYS.domains]: { acme: ['https://acme.dev/*'] },
        [STORAGE_KEYS.sites]: {
          acme: {
            insert: [{ class: 'header', position: 'before' }],
            classes: { deploy: 'ok', 'no-deploy': 'bad' },
          },
        },
        [STORAGE_KEYS.deployments]: { one: { name: 'One', acme: 'team' } },
      })

      const config = await Config.load()
      expect(config.domains).toEqual({ acme: ['https://acme.dev/*'] })
      expect(config.deployments.one.name).toBe('One')
    })

    it('does NOT fall back when only some sections are populated', async () => {
      seedStorage({ [STORAGE_KEYS.domains]: { acme: ['https://acme.dev/*'] } })

      const config = await Config.load()
      expect(config.domains).toEqual({ acme: ['https://acme.dev/*'] })
      // The missing sections stay empty rather than being filled with defaults,
      // otherwise a user who deleted the sample sites would get them back.
      expect(config.sites).toEqual({})
      expect(config.deployments).toEqual({})
    })
  })

  describe('save', () => {
    it('writes all three sections in one call', async () => {
      const config = defaultConfig()
      config.deployments = { proj: { name: 'Proj', github: 'acme/proj' } }

      await Config.save(config)

      expect(chromeMock().storage[STORAGE_KEYS.domains]).toEqual(config.domains)
      expect(chromeMock().storage[STORAGE_KEYS.sites]).toEqual(config.sites)
      expect(chromeMock().storage[STORAGE_KEYS.deployments]).toEqual(
        config.deployments,
      )
      expect(chrome.storage.sync.set).toHaveBeenCalledTimes(1)
    })

    it('round trips through load', async () => {
      const config = defaultConfig()
      config.deployments = {
        proj: {
          name: 'Proj',
          github: 'acme/proj',
          time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
        },
      }

      await Config.save(config)
      expect(await Config.load()).toEqual(config)
    })

    it('coerces missing sections to empty objects', async () => {
      await Config.save({
        domains: undefined,
        sites: undefined,
        deployments: undefined,
      } as never)

      expect(chromeMock().storage[STORAGE_KEYS.domains]).toEqual({})
      expect(chromeMock().storage[STORAGE_KEYS.sites]).toEqual({})
      expect(chromeMock().storage[STORAGE_KEYS.deployments]).toEqual({})
    })

    it('propagates a storage failure rather than silently succeeding', async () => {
      chromeMock().failStorage = true
      await expect(Config.save(defaultConfig())).rejects.toThrow(
        'storage unavailable',
      )
    })
  })

  describe('clear', () => {
    it('removes only this extension keys', async () => {
      seedStorage({
        [STORAGE_KEYS.domains]: { a: [] },
        SOMETHING_ELSE: 'keep me',
      })

      await Config.clear()

      expect(chromeMock().storage[STORAGE_KEYS.domains]).toBeUndefined()
      expect(chromeMock().storage.SOMETHING_ELSE).toBe('keep me')
    })
  })

  describe('defaultConfig', () => {
    it('returns a fresh object each time so callers cannot mutate the default', () => {
      const first = defaultConfig()
      first.domains.github.push('https://evil.dev/*')
      expect(defaultConfig().domains.github).toEqual(['*://*.github.com/*'])
    })
  })
})
