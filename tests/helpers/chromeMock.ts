import { vi } from 'vitest'

import messages from '../../public/_locales/en/messages.json'

type StorageArea = Record<string, unknown>

export interface ChromeMock {
  /** Backing store for chrome.storage.sync. */
  storage: StorageArea
  /** Tabs returned by chrome.tabs.query. */
  tabs: chrome.tabs.Tab[]
  /** Messages passed to chrome.runtime.sendMessage. */
  sentMessages: unknown[]
  /** Icon paths applied via chrome.action.setIcon. */
  setIcons: { path: string | Record<number, string>; tabId?: number }[]
  /** When true, storage reads/writes reject. */
  failStorage: boolean
}

const state: ChromeMock = {
  storage: {},
  tabs: [],
  sentMessages: [],
  setIcons: [],
  failStorage: false,
}

export function chromeMock(): ChromeMock {
  return state
}

export function resetChromeMock(): void {
  state.storage = {}
  state.tabs = []
  state.sentMessages = []
  state.setIcons = []
  state.failStorage = false
}

/** Seed chrome.storage.sync. */
export function seedStorage(values: StorageArea): void {
  Object.assign(state.storage, values)
}

/** Seed the tabs that chrome.tabs.query resolves with. */
export function seedTabs(tabs: Partial<chrome.tabs.Tab>[]): void {
  state.tabs = tabs as chrome.tabs.Tab[]
}

function keysToRead(keys: unknown): string[] {
  if (typeof keys === 'string') return [keys]
  if (Array.isArray(keys)) return keys as string[]
  if (keys && typeof keys === 'object') return Object.keys(keys)
  return Object.keys(state.storage)
}

/**
 * A hand-rolled stand-in for the parts of the chrome API this extension uses.
 *
 * Promise-based throughout, matching MV3. Deliberately small: it only covers
 * storage.sync, tabs.query, runtime messaging, i18n and action.setIcon.
 */
export function installChromeMock(): void {
  const mock = {
    storage: {
      sync: {
        get: vi.fn(async (keys?: unknown) => {
          if (state.failStorage) {
            throw new Error('storage unavailable')
          }
          const result: StorageArea = {}
          for (const key of keysToRead(keys)) {
            if (key in state.storage) {
              result[key] = state.storage[key]
            }
          }
          return result
        }),
        set: vi.fn(async (items: StorageArea) => {
          if (state.failStorage) {
            throw new Error('storage unavailable')
          }
          Object.assign(state.storage, items)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete state.storage[key]
          }
        }),
        clear: vi.fn(async () => {
          state.storage = {}
        }),
      },
    },

    tabs: {
      query: vi.fn(async () => state.tabs),
    },

    runtime: {
      // Extension-relative URLs, as chrome resolves them on an extension page.
      getURL: vi.fn((path: string) => `chrome-extension://test-extension${path}`),
      openOptionsPage: vi.fn(async () => {}),
      sendMessage: vi.fn(async (message: unknown) => {
        state.sentMessages.push(message)
        return { error: false }
      }),
      onMessage: {
        addListener: vi.fn(),
        removeListener: vi.fn(),
      },
      lastError: undefined as chrome.runtime.LastError | undefined,
    },

    action: {
      setIcon: vi.fn(
        async (details: {
          path: string | Record<number, string>
          tabId?: number
        }) => {
          state.setIcons.push(details)
        },
      ),
    },

    // Reads the real messages.json so tests assert against the strings users
    // actually see, and a missing key is a test failure rather than silence.
    i18n: {
      getMessage: vi.fn((key: string) => {
        const entry = (messages as Record<string, { message: string }>)[key]
        return entry?.message ?? ''
      }),
    },
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = mock
}
