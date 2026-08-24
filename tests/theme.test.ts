import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'

import {
  THEME_STORAGE_KEY,
  applyTheme,
  loadTheme,
  resolveTheme,
  saveTheme,
  systemPrefersDark,
  useTheme,
} from '../src/ui/theme'
import { chromeMock, seedStorage } from './helpers/chromeMock'

type Listener = () => void

/** jsdom has no matchMedia, so tests that need one install it themselves. */
function stubMatchMedia(matches: boolean) {
  const listeners = new Set<Listener>()
  const query = {
    matches,
    addEventListener: (_: string, listener: Listener) => listeners.add(listener),
    removeEventListener: (_: string, listener: Listener) =>
      listeners.delete(listener),
  }
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: vi.fn(() => query),
  })
  return {
    setMatches(next: boolean) {
      query.matches = next
      for (const listener of listeners) {
        listener()
      }
    },
    listenerCount: () => listeners.size,
  }
}

afterEach(() => {
  delete document.documentElement.dataset.theme
  Reflect.deleteProperty(window, 'matchMedia')
})

describe('applyTheme', () => {
  it('marks the document for an explicit choice', () => {
    applyTheme('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')

    applyTheme('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })

  it('removes the attribute for system', () => {
    // The absence of the attribute is what lets the prefers-color-scheme rules
    // in tokens.css apply, so an explicit choice always beats the OS setting.
    applyTheme('dark')
    applyTheme('system')
    expect(document.documentElement.dataset.theme).toBeUndefined()
  })
})

describe('resolveTheme', () => {
  it('passes an explicit choice straight through', () => {
    expect(resolveTheme('light')).toBe('light')
    expect(resolveTheme('dark')).toBe('dark')
  })

  it('asks the system when following it', () => {
    stubMatchMedia(true)
    expect(resolveTheme('system')).toBe('dark')
  })

  it('falls back to light when there is no matchMedia at all', () => {
    expect(systemPrefersDark()).toBe(false)
    expect(resolveTheme('system')).toBe('light')
  })
})

describe('storage', () => {
  it('defaults to system when nothing is stored', async () => {
    await expect(loadTheme()).resolves.toBe('system')
  })

  it('reads a stored choice', async () => {
    seedStorage({ [THEME_STORAGE_KEY]: 'dark' })
    await expect(loadTheme()).resolves.toBe('dark')
  })

  it('ignores a stored value that is not a theme', async () => {
    seedStorage({ [THEME_STORAGE_KEY]: 'neon' })
    await expect(loadTheme()).resolves.toBe('system')
  })

  it('falls back to system when storage is unavailable', async () => {
    chromeMock().failStorage = true
    await expect(loadTheme()).resolves.toBe('system')
  })

  it('writes the choice under its own key', async () => {
    await saveTheme('light')
    expect(chromeMock().storage[THEME_STORAGE_KEY]).toBe('light')
  })

  it('does not throw when the write fails', async () => {
    chromeMock().failStorage = true
    await expect(saveTheme('light')).resolves.toBeUndefined()
  })
})

describe('useTheme', () => {
  it('starts on system and adopts the stored choice', async () => {
    seedStorage({ [THEME_STORAGE_KEY]: 'dark' })
    const { result } = renderHook(() => useTheme())

    await waitFor(() => expect(result.current.choice).toBe('dark'))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('applies and persists a new choice', async () => {
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.choice).toBe('system'))

    act(() => result.current.setChoice('light'))

    expect(result.current.choice).toBe('light')
    expect(result.current.resolved).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
    await waitFor(() =>
      expect(chromeMock().storage[THEME_STORAGE_KEY]).toBe('light'),
    )
  })

  it('follows the system when the OS preference changes', async () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.choice).toBe('system'))
    expect(result.current.resolved).toBe('light')

    act(() => media.setMatches(true))

    expect(result.current.resolved).toBe('dark')
  })

  it('keeps an explicit choice when the OS preference changes', async () => {
    const media = stubMatchMedia(false)
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.choice).toBe('system'))

    act(() => result.current.setChoice('light'))
    act(() => media.setMatches(true))

    expect(result.current.resolved).toBe('light')
  })

  it('cycles light, dark, system', async () => {
    const { result } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.choice).toBe('system'))

    act(() => result.current.cycle())
    expect(result.current.choice).toBe('light')
    act(() => result.current.cycle())
    expect(result.current.choice).toBe('dark')
    act(() => result.current.cycle())
    expect(result.current.choice).toBe('system')
  })

  it('unsubscribes from the media query on unmount', async () => {
    const media = stubMatchMedia(false)
    const { result, unmount } = renderHook(() => useTheme())
    await waitFor(() => expect(result.current.choice).toBe('system'))
    expect(media.listenerCount()).toBeGreaterThan(0)

    unmount()

    expect(media.listenerCount()).toBe(0)
  })
})
