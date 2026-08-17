import { beforeEach, describe, expect, it } from 'vitest'

import {
  DEFAULT_TAB_URL,
  clearDevStorage,
  getSimulatedTabUrl,
  installChromeShim,
  readDevStorage,
  setSimulatedTabUrl,
} from '../dev/chromeShim'
import { ensureSeeded, reseed } from '../dev/seed'
import { SCENARIOS, devConfig } from '../dev/presets'
import { STORAGE_KEYS } from '../src/app/config/Config'
import { isValidConfig } from '../src/app/config/schema'
import { DW } from '../src/app/components/DW'

/**
 * The harness is developer tooling, not shipped code, but it imports the real
 * components. These tests keep it from rotting silently when those change.
 */
describe('dev harness', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('presets', () => {
    it('produces a config that passes the real validator', () => {
      expect(isValidConfig(devConfig())).toBe(true)
    })

    it('offers a scenario url for every configured deployment', () => {
      const config = devConfig()
      const scenarioUrls = SCENARIOS.map((scenario) => scenario.url)

      for (const deployment of Object.values(config.deployments)) {
        const fragment = deployment.github
        expect(typeof fragment).toBe('string')
        expect(
          scenarioUrls.some((url) => url.includes(fragment as string)),
          `no scenario covers "${fragment as string}"`,
        ).toBe(true)
      }
    })

    it('every scenario url resolves the way its label claims', () => {
      const config = devConfig()
      const resolve = (url: string) => new DW(config, url).getDeploymentInfo()

      expect(resolve('https://github.com/acme/daytime')?.canDeploy).toBe(true)
      expect(resolve('https://github.com/acme/overnight')?.canDeploy).toBe(false)
      expect(resolve('https://github.com/acme/notes-only')?.notesOnly).toBe(true)
      expect(resolve('https://github.com/acme/not-configured')).toBeNull()
      expect(resolve('https://example.com/somewhere')).toBeNull()
    })

    it('converts the cross-timezone window away from its source zone', () => {
      const info = new DW(
        devConfig(),
        'https://github.com/acme/cross-zone',
      ).getDeploymentInfo()

      expect(info?.timeObj.original).toEqual({
        start: '09:00',
        end: '17:00',
        timezone: 'Asia/Tokyo',
      })
      // Tests are pinned to America/New_York, so the local window must differ.
      expect(info?.timeObj.local.timezone).toBe('America/New_York')
      expect(info?.timeObj.local.start).not.toBe('09:00')
    })
  })

  describe('seeding', () => {
    it('writes the sample config on first run', () => {
      installChromeShim()
      ensureSeeded()

      const stored = readDevStorage()
      expect(stored[STORAGE_KEYS.domains]).toBeDefined()
      expect(stored[STORAGE_KEYS.deployments]).toBeDefined()
    })

    it('leaves existing storage alone on later runs', () => {
      installChromeShim()
      ensureSeeded()

      const edited = readDevStorage()
      ;(edited[STORAGE_KEYS.deployments] as Record<string, unknown>).daytime = {
        name: 'Edited by hand',
      }
      localStorage.setItem('__dw_dev_storage__', JSON.stringify(edited))

      ensureSeeded()

      const after = readDevStorage() as Record<string, Record<string, { name: string }>>
      expect(after[STORAGE_KEYS.deployments].daytime.name).toBe('Edited by hand')
    })

    it('reseed discards edits', () => {
      installChromeShim()
      ensureSeeded()
      reseed()

      const after = readDevStorage() as Record<string, Record<string, { name: string }>>
      expect(after[STORAGE_KEYS.deployments].daytime.name).toBe(
        'Daytime project (open now)',
      )
    })
  })

  describe('simulated tab url', () => {
    it('defaults to the open scenario', () => {
      expect(getSimulatedTabUrl()).toBe(DEFAULT_TAB_URL)
    })

    it('round trips a chosen url', () => {
      setSimulatedTabUrl('https://github.com/acme/overnight')
      expect(getSimulatedTabUrl()).toBe('https://github.com/acme/overnight')
    })
  })

  describe('chrome shim', () => {
    it('never shadows a real extension context', () => {
      const real = { runtime: { id: 'abcdef' } }
      ;(globalThis as unknown as { chrome: unknown }).chrome = real

      installChromeShim()

      expect((globalThis as unknown as { chrome: unknown }).chrome).toBe(real)
    })

    it('does install over the partial window.chrome an ordinary page has', () => {
      // Chrome defines this on normal pages; it has no runtime.id.
      ;(globalThis as unknown as { chrome: unknown }).chrome = { runtime: {} }

      installChromeShim()

      expect(chrome.storage?.sync).toBeDefined()
      expect(chrome.i18n.getMessage('l10nStatus')).toBe('Status')
    })

    it('backs storage with localStorage so surfaces share it', async () => {
      ;(globalThis as unknown as { chrome?: unknown }).chrome = undefined
      installChromeShim()

      await chrome.storage.sync.set({ [STORAGE_KEYS.domains]: { a: ['x'] } })

      expect(readDevStorage()[STORAGE_KEYS.domains]).toEqual({ a: ['x'] })
      const read = await chrome.storage.sync.get(STORAGE_KEYS.domains)
      expect(read[STORAGE_KEYS.domains]).toEqual({ a: ['x'] })
    })

    it('serves the simulated tab through chrome.tabs.query', async () => {
      ;(globalThis as unknown as { chrome?: unknown }).chrome = undefined
      installChromeShim()
      setSimulatedTabUrl('https://github.com/acme/notes-only')

      const [tab] = await chrome.tabs.query({ active: true })
      expect(tab.url).toBe('https://github.com/acme/notes-only')
    })

    it('clearDevStorage empties the backing store', async () => {
      ;(globalThis as unknown as { chrome?: unknown }).chrome = undefined
      installChromeShim()
      await chrome.storage.sync.set({ a: 1 })

      clearDevStorage()

      expect(readDevStorage()).toEqual({})
    })
  })
})
