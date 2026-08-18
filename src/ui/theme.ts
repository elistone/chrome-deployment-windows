import { useCallback, useEffect, useState } from 'react'

/**
 * Light/dark handling for the extension's own pages.
 *
 * The choice is stored in chrome.storage.sync alongside the config (under its
 * own key, so it never travels through the config validator) and applied as a
 * `data-theme` attribute on <html>. "system" removes the attribute entirely,
 * which is what lets the prefers-color-scheme block in tokens.css take over -
 * an explicit choice therefore always beats the OS setting.
 */

export const THEME_STORAGE_KEY = 'THEME'

export const THEME_CHOICES = ['light', 'dark', 'system'] as const
export type ThemeChoice = (typeof THEME_CHOICES)[number]
/** What the page is actually painted as, once "system" has been resolved. */
export type ResolvedTheme = 'light' | 'dark'

const DARK_QUERY = '(prefers-color-scheme: dark)'

function isThemeChoice(value: unknown): value is ThemeChoice {
  return (
    typeof value === 'string' &&
    (THEME_CHOICES as readonly string[]).includes(value)
  )
}

/** jsdom has no matchMedia, and neither does a torn-down extension page. */
function darkMediaQuery(): MediaQueryList | null {
  try {
    return window.matchMedia?.(DARK_QUERY) ?? null
  } catch {
    return null
  }
}

export function systemPrefersDark(): boolean {
  return darkMediaQuery()?.matches === true
}

export function resolveTheme(choice: ThemeChoice): ResolvedTheme {
  if (choice === 'system') {
    return systemPrefersDark() ? 'dark' : 'light'
  }
  return choice
}

/** Paint the choice. Safe to call before React has mounted. */
export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement
  if (choice === 'system') {
    delete root.dataset.theme
  } else {
    root.dataset.theme = choice
  }
}

export async function loadTheme(): Promise<ThemeChoice> {
  try {
    const stored = await chrome.storage.sync.get(THEME_STORAGE_KEY)
    const value = stored[THEME_STORAGE_KEY]
    return isThemeChoice(value) ? value : 'system'
  } catch {
    return 'system'
  }
}

export async function saveTheme(choice: ThemeChoice): Promise<void> {
  try {
    await chrome.storage.sync.set({ [THEME_STORAGE_KEY]: choice })
  } catch {
    // A failed write only costs the preference next time the page opens; the
    // current page is already painted, so there is nothing useful to report.
  }
}

export interface ThemeController {
  choice: ThemeChoice
  resolved: ResolvedTheme
  setChoice: (choice: ThemeChoice) => void
  /** light -> dark -> system -> light, for the header's single-button switch. */
  cycle: () => void
}

export function useTheme(): ThemeController {
  const [choice, setStoredChoice] = useState<ThemeChoice>('system')
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolveTheme('system'),
  )

  useEffect(() => {
    let active = true
    void loadTheme().then((stored) => {
      if (!active) {
        return
      }
      setStoredChoice(stored)
      applyTheme(stored)
      setResolved(resolveTheme(stored))
    })
    return () => {
      active = false
    }
  }, [])

  // Only meaningful while following the system, but the listener is cheap and
  // unconditional hooks are simpler than a conditional subscription.
  useEffect(() => {
    const query = darkMediaQuery()
    if (!query) {
      return
    }
    const onChange = () => setResolved(resolveTheme(choice))
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [choice])

  const setChoice = useCallback((next: ThemeChoice) => {
    setStoredChoice(next)
    applyTheme(next)
    setResolved(resolveTheme(next))
    void saveTheme(next)
  }, [])

  const cycle = useCallback(() => {
    setChoice(
      choice === 'light' ? 'dark' : choice === 'dark' ? 'system' : 'light',
    )
  }, [choice, setChoice])

  return { choice, resolved, setChoice, cycle }
}
