import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DW } from '../src/app/components/DW'
import { Timezones } from '../src/app/components/Timezones'
import { Config, STORAGE_KEYS, defaultConfig } from '../src/app/config/Config'
import { seedStorage } from './helpers/chromeMock'
import { testConfig } from './helpers/fixtures'

describe('DW', () => {
  beforeEach(() => {
    vi.useRealTimers()
  })

  describe('domain matching', () => {
    it('finds the domain key for a matching url', () => {
      const dw = new DW(testConfig(), 'https://github.com/acme/daytime')
      expect(dw.getDomainKey()).toBe('github')
    })

    it('matches a different configured domain', () => {
      const dw = new DW(testConfig(), 'https://acme.atlassian.net/browse/BOARD-9')
      expect(dw.getDomainKey()).toBe('jira')
    })

    it('returns null for an unconfigured domain', () => {
      const dw = new DW(testConfig(), 'https://example.com/acme/daytime')
      expect(dw.getDomainKey()).toBeNull()
      expect(dw.getDeploymentInfo()).toBeNull()
    })
  })

  describe('deployment lookup', () => {
    it('resolves the deployment whose fragment appears in the url', () => {
      const dw = new DW(testConfig(), 'https://github.com/acme/daytime/pulls/12')
      expect(dw.getDeploymentInfo()?.key).toBe('daytime')
      expect(dw.getDeploymentInfo()?.name).toBe('Daytime project')
    })

    it('returns null when the domain matches but no deployment does', () => {
      const dw = new DW(testConfig(), 'https://github.com/acme/unknown')
      expect(dw.getDomainKey()).toBe('github')
      expect(dw.getDeploymentInfo()).toBeNull()
      expect(dw.hasDeployment()).toBe(false)
    })

    it('resolves per domain, so the same deployment matches via jira too', () => {
      const dw = new DW(testConfig(), 'https://acme.atlassian.net/browse/BOARD-9')
      expect(dw.getDeploymentInfo()?.key).toBe('overnight')
      expect(dw.getDeploymentInfo()?.domainKey).toBe('jira')
    })

    it('ignores an empty fragment rather than matching every url', () => {
      const config = testConfig()
      config.deployments.empty = { name: 'Empty', github: '' }
      const dw = new DW(config, 'https://github.com/totally/unrelated')
      expect(dw.getDeploymentInfo()).toBeNull()
    })

    it('returns null when the matched domain has no sites entry', () => {
      const config = testConfig()
      delete (config.sites as Record<string, unknown>).github
      const dw = new DW(config, 'https://github.com/acme/daytime')
      expect(dw.getDeploymentInfo()).toBeNull()
    })

    describe('case sensitivity', () => {
      it('matches case-insensitively by default', () => {
        const dw = new DW(testConfig(), 'https://github.com/ACME/DAYTIME')
        expect(dw.getDeploymentInfo()?.key).toBe('daytime')
      })

      it('respects case when case-sensitive is set', () => {
        const exact = new DW(testConfig(), 'https://github.com/acme/CaseSensitive')
        expect(exact.getDeploymentInfo()?.key).toBe('cased')

        const wrongCase = new DW(testConfig(), 'https://github.com/acme/casesensitive')
        expect(wrongCase.getDeploymentInfo()).toBeNull()
      })
    })
  })

  describe('resolved shape', () => {
    it('exposes the matched site config for injection', () => {
      const dw = new DW(testConfig(), 'https://github.com/acme/daytime')
      const info = dw.getDeploymentInfo()
      expect(info?.domainInfo.insert).toHaveLength(2)
      expect(info?.domainInfo.insert[0].class).toBe('file-navigation')
    })

    it('defaults name to the deployment key and notes to an empty string', () => {
      const config = testConfig()
      config.deployments.bare = { github: 'acme/bare' }
      const dw = new DW(config, 'https://github.com/acme/bare')
      const info = dw.getDeploymentInfo()
      expect(info?.name).toBe('bare')
      expect(info?.notes).toBe('')
    })

    it('exposes the notes-only and case-sensitive flags as booleans', () => {
      const notesOnly = new DW(testConfig(), 'https://github.com/acme/notes-only')
      expect(notesOnly.getDeploymentInfo()?.notesOnly).toBe(true)
      expect(notesOnly.getDeploymentInfo()?.caseSensitive).toBe(false)
    })

    it('never mutates the config it was given', () => {
      const config = testConfig()
      const snapshot = structuredClone(config)
      const dw = new DW(config, 'https://github.com/acme/daytime')
      dw.getDeploymentInfo()
      expect(config).toEqual(snapshot)
    })
  })

  describe('time resolution', () => {
    it('keeps the original window and converts it to local', () => {
      const config = testConfig()
      const dw = new DW(config, 'https://github.com/acme/daytime')
      const times = dw.getDeploymentInfo()!.timeObj

      expect(times.original).toEqual({
        start: '09:00',
        end: '17:00',
        timezone: 'Europe/London',
      })
      expect(times.local.timezone).toBe(Timezones.findLocalTimezone())
      expect(times.local.start).toMatch(/^\d{2}:\d{2}$/)
    })

    it('falls back to 00:00 in the local zone when no time is configured', () => {
      const dw = new DW(testConfig(), 'https://github.com/acme/untimed')
      const times = dw.getDeploymentInfo()!.timeObj
      expect(times.original.start).toBe('00:00')
      expect(times.original.end).toBe('00:00')
      expect(times.original.timezone).toBe(Timezones.findLocalTimezone())
    })
  })

  describe('status', () => {
    it('reports open inside the window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))
      expect(DW.canDeploy('09:00', '17:00')).toBe(true)
      expect(DW.statusText('09:00', '17:00')).toBe('Deployment window open')
    })

    it('reports closed outside the window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T20:00:00'))
      expect(DW.canDeploy('09:00', '17:00')).toBe(false)
      expect(DW.statusText('09:00', '17:00')).toBe('Deployment window closed')
    })

    it('handles a window that wraps past midnight', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T00:30:00'))
      expect(DW.canDeploy('23:00', '02:00')).toBe(true)
    })
  })

  describe('create', () => {
    it('loads config from storage before resolving', async () => {
      seedStorage({
        [STORAGE_KEYS.domains]: testConfig().domains,
        [STORAGE_KEYS.sites]: testConfig().sites,
        [STORAGE_KEYS.deployments]: testConfig().deployments,
      })

      const dw = await DW.create('https://github.com/acme/daytime')
      expect(dw.getDeploymentInfo()?.key).toBe('daytime')
    })

    it('uses the default config when storage is empty', async () => {
      const dw = await DW.create('https://github.com/anything')
      expect(dw.getConfig()).toEqual(defaultConfig())
      // Defaults ship no deployments, so nothing resolves.
      expect(dw.getDeploymentInfo()).toBeNull()
    })

    it('round trips a config saved through Config.save', async () => {
      await Config.save(testConfig())
      const dw = await DW.create('https://github.com/acme/overnight')
      expect(dw.getDeploymentInfo()?.name).toBe('Overnight project')
    })
  })
})
