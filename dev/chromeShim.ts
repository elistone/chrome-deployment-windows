import messages from '../public/_locales/en/messages.json'

/**
 * A browser-only stand-in for the parts of the chrome extension API this
 * project uses, so the popup, options page and in-page notice can be developed
 * in a normal tab without loading an unpacked extension.
 *
 * This file is only ever imported from dev/, which is not part of the extension
 * build, so none of it can reach a packaged release.
 *
 * Storage is backed by localStorage so edits survive a reload and are shared
 * between the harness frames.
 */

const STORAGE_LS_KEY = '__dw_dev_storage__'
const TAB_URL_LS_KEY = '__dw_dev_tab_url__'

export const DEFAULT_TAB_URL = 'https://github.com/acme/daytime'

/** Fired whenever the shim receives a setIcon request, for the harness UI. */
export const ICON_EVENT = 'dw-dev-icon'
/** Fired whenever stored config changes, so open frames can react. */
export const STORAGE_EVENT = 'dw-dev-storage'

type StorageArea = Record<string, unknown>

function readStorage(): StorageArea {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_LS_KEY) ?? '{}') as StorageArea
  } catch {
    return {}
  }
}

function writeStorage(value: StorageArea): void {
  localStorage.setItem(STORAGE_LS_KEY, JSON.stringify(value))
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}

export function getSimulatedTabUrl(): string {
  return localStorage.getItem(TAB_URL_LS_KEY) ?? DEFAULT_TAB_URL
}

export function setSimulatedTabUrl(url: string): void {
  localStorage.setItem(TAB_URL_LS_KEY, url)
}

export function clearDevStorage(): void {
  localStorage.removeItem(STORAGE_LS_KEY)
  window.dispatchEvent(new CustomEvent(STORAGE_EVENT))
}

export function readDevStorage(): StorageArea {
  return readStorage()
}

export function writeDevStorage(value: StorageArea): void {
  writeStorage(value)
}

function keysToRead(keys: unknown): string[] {
  if (typeof keys === 'string') return [keys]
  if (Array.isArray(keys)) return keys as string[]
  if (keys && typeof keys === 'object') return Object.keys(keys)
  return Object.keys(readStorage())
}

/**
 * Install the shim on globalThis.
 *
 * Call this before importing any module that touches chrome.*, since the
 * popup and options components reach for it as soon as they mount.
 */
export function installChromeShim(): void {
  // Chrome itself defines a partial window.chrome on ordinary pages, so the
  // presence of the object proves nothing. Only a real extension context has
  // chrome.runtime.id, and that is what must never be shadowed.
  const existing = (globalThis as { chrome?: { runtime?: { id?: string } } })
    .chrome
  if (existing?.runtime?.id) {
    return
  }

  const shim = {
    storage: {
      sync: {
        async get(keys?: unknown) {
          const all = readStorage()
          const result: StorageArea = {}
          for (const key of keysToRead(keys)) {
            if (key in all) result[key] = all[key]
          }
          return result
        },
        async set(items: StorageArea) {
          writeStorage({ ...readStorage(), ...items })
        },
        async remove(keys: string | string[]) {
          const all = readStorage()
          for (const key of Array.isArray(keys) ? keys : [keys]) {
            delete all[key]
          }
          writeStorage(all)
        },
        async clear() {
          writeStorage({})
        },
      },
    },

    tabs: {
      async query() {
        return [{ id: 1, url: getSimulatedTabUrl(), active: true }]
      },
    },

    runtime: {
      async sendMessage(message: unknown) {
        const iconPath = (message as { newIconPath?: string })?.newIconPath
        if (typeof iconPath === 'string') {
          // Surface it to the harness rather than silently dropping it.
          window.dispatchEvent(
            new CustomEvent(ICON_EVENT, { detail: { iconPath } }),
          )
          window.parent?.dispatchEvent(
            new CustomEvent(ICON_EVENT, { detail: { iconPath } }),
          )
        }
        return { error: false }
      },
      onMessage: {
        addListener() {},
        removeListener() {},
      },
      lastError: undefined,
    },

    action: {
      async setIcon() {},
    },

    i18n: {
      getMessage(key: string) {
        const entry = (messages as Record<string, { message: string }>)[key]
        return entry?.message ?? ''
      },
    },
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = shim
}
