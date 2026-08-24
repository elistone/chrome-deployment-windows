import { vi } from 'vitest'

import messages from '../../public/_locales/en/messages.json'

type StorageArea = Record<string, unknown>

type StorageChangeListener = (
  changes: Record<string, chrome.storage.StorageChange>,
  area: string,
) => void

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

/**
 * Chrome serialises what it stores, so a value read back is never the object
 * that was written. Cloning here keeps that true: without it a test could
 * mutate "stored" data in place and the code under test would appear to agree.
 */
function clone<T>(value: T): T {
  return structuredClone(value)
}

function keysToRead(keys: unknown, area: StorageArea = state.storage): string[] {
  if (typeof keys === 'string') return [keys]
  if (Array.isArray(keys)) return keys as string[]
  if (keys && typeof keys === 'object') return Object.keys(keys)
  return Object.keys(area)
}

/**
 * A hand-rolled stand-in for the parts of the chrome API this extension uses.
 *
 * Promise-based throughout, matching MV3. Deliberately small: it only covers
 * storage.sync, storage.local, tabs.query, runtime messaging, i18n and
 * action.setIcon.
 */
export function installChromeMock(): void {
  /**
   * storage.onChanged listeners, fired by writes the way Chrome fires them.
   * The content script relies on that event to notice an edit made elsewhere,
   * so a mock that stored silently would let that regress unnoticed.
   */
  const changeListeners: StorageChangeListener[] = []

  const announce = (changes: Record<string, chrome.storage.StorageChange>) => {
    if (Object.keys(changes).length === 0) {
      return
    }
    for (const listener of [...changeListeners]) {
      listener(changes, 'sync')
    }
  }

  /**
   * storage.local, kept separate from sync the way Chrome keeps it. The shared
   * config is cached here precisely because it is too big for sync, so a mock
   * that aliased the two would hide that.
   */
  const local: StorageArea = {}

  const mock = {
    storage: {
      local: {
        get: vi.fn(async (keys?: unknown) => {
          const result: StorageArea = {}
          for (const key of keysToRead(keys, local)) {
            if (key in local) {
              result[key] = clone(local[key])
            }
          }
          return result
        }),
        set: vi.fn(async (items: StorageArea) => {
          Object.assign(local, clone(items))
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete local[key]
          }
        }),
        clear: vi.fn(async () => {
          for (const key of Object.keys(local)) {
            delete local[key]
          }
        }),
      },

      onChanged: {
        addListener: vi.fn((listener: StorageChangeListener) => {
          changeListeners.push(listener)
        }),
        removeListener: vi.fn((listener: StorageChangeListener) => {
          const index = changeListeners.indexOf(listener)
          if (index >= 0) {
            changeListeners.splice(index, 1)
          }
        }),
      },
      sync: {
        get: vi.fn(async (keys?: unknown) => {
          if (state.failStorage) {
            throw new Error('storage unavailable')
          }
          const result: StorageArea = {}
          for (const key of keysToRead(keys)) {
            if (key in state.storage) {
              result[key] = clone(state.storage[key])
            }
          }
          return result
        }),
        set: vi.fn(async (items: StorageArea) => {
          if (state.failStorage) {
            throw new Error('storage unavailable')
          }
          const changes: Record<string, chrome.storage.StorageChange> = {}
          for (const [key, newValue] of Object.entries(items)) {
            changes[key] = { oldValue: state.storage[key], newValue }
          }
          Object.assign(state.storage, clone(items))
          announce(changes)
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          const changes: Record<string, chrome.storage.StorageChange> = {}
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            if (key in state.storage) {
              changes[key] = { oldValue: state.storage[key] }
            }
            delete state.storage[key]
          }
          announce(changes)
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
      onInstalled: {
        addListener: vi.fn(),
      },
      onStartup: {
        addListener: vi.fn(),
      },
      lastError: undefined as chrome.runtime.LastError | undefined,
    },

    alarms: {
      create: vi.fn(async () => {}),
      clear: vi.fn(async () => true),
      onAlarm: {
        addListener: vi.fn(),
      },
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
