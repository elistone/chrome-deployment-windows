import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { Config } from '../src/app/config/Config'
import {
  REMOTE_CACHE_KEY,
  REMOTE_HIDDEN_KEY,
  REMOTE_URL_KEY,
  emptyConfig,
  isUsableRemoteUrl,
  mergeConfigs,
  readCache,
  splitLocal,
  visibleRemote,
} from '../src/app/config/remote'
import { refreshRemote, setRemoteUrl } from '../src/app/config/remoteFetch'
import type { DeploymentWindowsConfig } from '../src/app/config/types'

const URL_ = 'https://example.com/windows.json'

function sharedConfig(): DeploymentWindowsConfig {
  return {
    domains: { github: ['*://*.github.com/*'] },
    sites: { github: { insert: [{ class: 'main', position: 'after' }] } },
    deployments: {
      team: {
        name: 'Team project',
        github: 'acme/team',
        time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
      },
    },
  }
}

/** Every request the stubbed network saw, so the headers can be asserted. */
let requests: { url: string; headers: Record<string, string> }[] = []

/**
 * The most recent request.
 *
 * Not `requests[0]`: a test that refreshes twice is usually asking about the
 * second one, and indexing from the front quietly asserts about the first.
 */
function lastRequest() {
  const request = requests[requests.length - 1]
  if (!request) {
    throw new Error('nothing was fetched')
  }
  return request
}

/** Stand in for the network, returning whatever a test wants back. */
function serve(
  body: unknown,
  init: {
    ok?: boolean
    status?: number
    headers?: Record<string, string>
  } = {},
) {
  const text = typeof body === 'string' ? body : JSON.stringify(body)
  const headers = init.headers ?? {}
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, options?: RequestInit) => {
      requests.push({
        url,
        headers: (options?.headers ?? {}) as Record<string, string>,
      })
      return {
        ok: init.ok ?? (init.status ?? 200) < 400,
        status: init.status ?? 200,
        statusText: init.status === 404 ? 'Not Found' : 'OK',
        headers: {
          get: (name: string) => headers[name.toLowerCase()] ?? null,
        },
        text: async () => text,
      }
    }),
  )
}

async function connect(config: unknown = sharedConfig()) {
  serve(config)
  return setRemoteUrl(URL_)
}

describe('shared config', () => {
  beforeEach(() => {
    requests = []
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('isUsableRemoteUrl', () => {
    it.each([
      ['https://example.com/a.json', true],
      ['http://example.com/a.json', false],
      ['file:///etc/passwd', false],
      ['not a url', false],
      ['', false],
    ])('%s -> %s', (url, expected) => {
      expect(isUsableRemoteUrl(url)).toBe(expected)
    })
  })

  describe('mergeConfigs', () => {
    it('lets the local entry win on a shared key', () => {
      const merged = mergeConfigs(
        { ...emptyConfig(), deployments: { a: { name: 'Shared' } } },
        { ...emptyConfig(), deployments: { a: { name: 'Mine' } } },
      )
      expect(merged.deployments.a.name).toBe('Mine')
    })

    it('keeps both where the keys do not collide', () => {
      const merged = mergeConfigs(
        { ...emptyConfig(), deployments: { a: { name: 'Shared' } } },
        { ...emptyConfig(), deployments: { b: { name: 'Mine' } } },
      )
      expect(Object.keys(merged.deployments).sort()).toEqual(['a', 'b'])
    })
  })

  describe('splitLocal', () => {
    it('stores nothing that the shared layer already says', () => {
      const remote = sharedConfig()
      const { local, hidden } = splitLocal(remote, remote)

      expect(local).toEqual(emptyConfig())
      expect(hidden).toEqual({ domains: [], sites: [], deployments: [] })
    })

    it('ignores key order when deciding whether an entry changed', () => {
      const remote = sharedConfig()
      const merged = structuredClone(remote)
      // Same entry, written the other way round.
      merged.deployments.team = {
        time: { timezone: 'Europe/London', end: '17:00', start: '09:00' },
        github: 'acme/team',
        name: 'Team project',
      }

      expect(splitLocal(merged, remote).local.deployments).toEqual({})
    })

    it('stores an entry once it differs', () => {
      const remote = sharedConfig()
      const merged = structuredClone(remote)
      merged.deployments.team.name = 'Corrected locally'

      const { local } = splitLocal(merged, remote)
      expect(local.deployments.team.name).toBe('Corrected locally')
      expect(local.domains).toEqual({})
    })

    it('remembers a deletion rather than losing it on the next merge', () => {
      const remote = sharedConfig()
      const merged = structuredClone(remote)
      delete merged.deployments.team

      const { hidden } = splitLocal(merged, remote)
      expect(hidden.deployments).toEqual(['team'])
      expect(visibleRemote(remote, hidden).deployments).toEqual({})
    })
  })

  describe('refreshRemote', () => {
    beforeEach(async () => {
      await chrome.storage.sync.set({ [REMOTE_URL_KEY]: URL_ })
    })

    it('caches a config that parses', async () => {
      serve(sharedConfig())
      const cache = await refreshRemote()

      expect(cache.error).toBeNull()
      expect(cache.config?.deployments.team.name).toBe('Team project')
      expect((await readCache())?.url).toBe(URL_)
    })

    it('records why a fetch failed', async () => {
      serve('', { ok: false, status: 404 })
      const cache = await refreshRemote()

      expect(cache.error).toContain('404')
      expect(cache.config).toBeNull()
    })

    it('records a response that is not a config', async () => {
      serve({ nope: true })
      expect((await refreshRemote()).error).toBeTruthy()
    })

    it('records a response that is not JSON at all', async () => {
      serve('<html>login required</html>')
      expect((await refreshRemote()).error).toBeTruthy()
    })

    it('keeps the last good config through a failed refresh', async () => {
      serve(sharedConfig())
      await refreshRemote()

      serve('', { ok: false, status: 500 })
      const cache = await refreshRemote()

      // The window is still the right one to show; only the copy is stale.
      expect(cache.error).toBeTruthy()
      expect(cache.config?.deployments.team.name).toBe('Team project')
    })

    it('asks for the whole file the first time', async () => {
      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      // Nothing to fall back on yet, so nothing conditional to ask.
      expect(requests).toHaveLength(1)
      expect(lastRequest().headers).toEqual({})
    })

    it('remembers the validators the server offered', async () => {
      serve(sharedConfig(), {
        headers: { etag: '"v1"', 'last-modified': 'Wed, 20 Aug 2026 10:00:00 GMT' },
      })
      const cache = await refreshRemote()

      expect(cache.etag).toBe('"v1"')
      expect(cache.lastModified).toBe('Wed, 20 Aug 2026 10:00:00 GMT')
    })

    it('asks whether anything changed on the next refresh', async () => {
      serve(sharedConfig(), {
        headers: { etag: '"v1"', 'last-modified': 'Wed, 20 Aug 2026 10:00:00 GMT' },
      })
      await refreshRemote()

      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      // An hourly refresh that re-downloads an unchanged file all day is most
      // of the cost of having one.
      expect(lastRequest().headers['If-None-Match']).toBe('"v1"')
      expect(lastRequest().headers['If-Modified-Since']).toBe(
        'Wed, 20 Aug 2026 10:00:00 GMT',
      )
    })

    it('keeps everything when the server says nothing changed', async () => {
      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      serve('', { status: 304 })
      const cache = await refreshRemote()

      expect(cache.unchanged).toBe(true)
      expect(cache.error).toBeNull()
      expect(cache.config?.deployments.team.name).toBe('Team project')
      // And the validator survives, so the next refresh can ask again.
      expect(cache.etag).toBe('"v1"')
    })

    it('takes the new file when the server says it changed', async () => {
      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      const changed = sharedConfig()
      changed.deployments.team.name = 'Renamed at the source'
      serve(changed, { headers: { etag: '"v2"' } })
      const cache = await refreshRemote()

      expect(cache.unchanged).toBe(false)
      expect(cache.config?.deployments.team.name).toBe('Renamed at the source')
      expect(cache.etag).toBe('"v2"')
    })

    it('forgets a validator the server has stopped sending', async () => {
      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      serve(sharedConfig())
      const cache = await refreshRemote()

      // Otherwise it would go on asking about a version the server no longer
      // knows, and be answered with the whole file every time anyway.
      expect(cache.etag).toBeUndefined()
    })

    it('does not ask conditionally after the URL changes', async () => {
      serve(sharedConfig(), { headers: { etag: '"v1"' } })
      await refreshRemote()

      await chrome.storage.sync.set({
        [REMOTE_URL_KEY]: 'https://example.com/other.json',
      })
      serve(sharedConfig())
      await refreshRemote()

      // A different file's etag says nothing about this one.
      expect(lastRequest().headers).toEqual({})
    })

    it('refuses a URL that is not https', async () => {
      serve(sharedConfig())
      await chrome.storage.sync.set({ [REMOTE_URL_KEY]: 'http://example.com/a' })
      const cache = await refreshRemote()

      expect(cache.error).toContain('https')
      // Turned away before the request, not after it.
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe('through Config', () => {
    it('merges the shared layer under the local one', async () => {
      await connect()
      const merged = await Config.load()
      merged.deployments.mine = { name: 'Mine only' }
      await Config.save(merged)

      const loaded = await Config.load()
      expect(Object.keys(loaded.deployments).sort()).toEqual(['mine', 'team'])
      expect(loaded.deployments.team.name).toBe('Team project')
    })

    it('does not copy the shared layer into local storage', async () => {
      await connect()
      // Saving what was loaded is what the dashboard does on every edit.
      await Config.save(await Config.load())

      const stored = await chrome.storage.sync.get('DEPLOYMENTS')
      expect(stored.DEPLOYMENTS).toEqual({})
    })

    it('stores an override, and lets it win', async () => {
      await connect()
      const loaded = await Config.load()
      loaded.deployments.team.name = 'Corrected locally'
      await Config.save(loaded)

      expect((await Config.load()).deployments.team.name).toBe(
        'Corrected locally',
      )
      const stored = await chrome.storage.sync.get('DEPLOYMENTS')
      expect(Object.keys(stored.DEPLOYMENTS as object)).toEqual(['team'])
    })

    it('keeps a shared entry deleted', async () => {
      await connect()
      const loaded = await Config.load()
      delete loaded.deployments.team
      await Config.save(loaded)

      expect((await Config.load()).deployments.team).toBeUndefined()
      expect((await chrome.storage.sync.get(REMOTE_HIDDEN_KEY))[REMOTE_HIDDEN_KEY])
        .toEqual({ domains: [], sites: [], deployments: ['team'] })
    })

    it('brings a deleted entry back once it is re-added', async () => {
      await connect()
      let loaded = await Config.load()
      delete loaded.deployments.team
      await Config.save(loaded)

      loaded = await Config.load()
      loaded.deployments.team = { name: 'Back again' }
      await Config.save(loaded)

      expect((await Config.load()).deployments.team.name).toBe('Back again')
      expect(
        (await chrome.storage.sync.get(REMOTE_HIDDEN_KEY))[REMOTE_HIDDEN_KEY],
      ).toBeUndefined()
    })

    it('takes global freezes from the shared config', async () => {
      // The point of a company freeze in a shared file: one entry, everyone.
      serve({
        ...sharedConfig(),
        freezes: [{ from: '2026-12-20', to: '2027-01-02', reason: 'Company' }],
      })
      await setRemoteUrl(URL_)

      expect((await Config.load()).freezes).toEqual([
        { from: '2026-12-20', to: '2027-01-02', reason: 'Company' },
      ])
    })

    it('does not store a shared freeze list as if it were yours', async () => {
      serve({
        ...sharedConfig(),
        freezes: [{ from: '2026-12-20', to: '2027-01-02' }],
      })
      await setRemoteUrl(URL_)
      await Config.save(await Config.load())

      expect((await chrome.storage.sync.get('FREEZES')).FREEZES).toEqual([])
    })

    it('lets a local list replace the shared one', async () => {
      serve({
        ...sharedConfig(),
        freezes: [{ from: '2026-12-20', to: '2027-01-02' }],
      })
      await setRemoteUrl(URL_)

      const merged = await Config.load()
      merged.freezes = [{ from: '2026-07-01', to: '2026-07-14', reason: 'Ours' }]
      await Config.save(merged)

      // A list, not a record: there is no key to win on, so it is one value.
      // Concatenating would read better until someone tried to remove a freeze
      // the file had put there and found they could not.
      expect((await Config.load()).freezes).toEqual([
        { from: '2026-07-01', to: '2026-07-14', reason: 'Ours' },
      ])
    })

    it('does not fall back to the defaults when only the shared layer has entries', async () => {
      await connect()

      // The GitHub and Jira defaults would otherwise appear underneath a
      // team's config, on pages they had deliberately left out.
      const loaded = await Config.load()
      expect(Object.keys(loaded.deployments)).toEqual(['team'])
      expect(Object.keys(loaded.domains)).toEqual(['github'])
    })

    it('still falls back to the defaults when both layers are empty', async () => {
      const loaded = await Config.load()
      expect(Object.keys(loaded.domains).sort()).toEqual(['github', 'jira'])
    })

    it('ignores a cache left over from a different URL', async () => {
      await connect()
      await chrome.storage.sync.set({
        [REMOTE_URL_KEY]: 'https://example.com/other.json',
      })

      expect(await Config.loadRemote()).toEqual(emptyConfig())
    })

    it('drops the cache when the URL is cleared', async () => {
      await connect()
      await setRemoteUrl('')

      expect(await readCache()).toBeNull()
      const local = await chrome.storage.local.get(REMOTE_CACHE_KEY)
      expect(local[REMOTE_CACHE_KEY]).toBeUndefined()
    })
  })
})
