import { useEffect, useState } from 'react'

/**
 * Fallback zones for engines without Intl.supportedValuesOf. Deliberately
 * short - it only has to keep the picker usable, not complete, and anything
 * missing can still be typed in because the control is a combobox.
 */
const FALLBACK_TIMEZONES = [
  'UTC',
  'Europe/London',
  'Europe/Dublin',
  'Europe/Lisbon',
  'Europe/Madrid',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Stockholm',
  'Europe/Warsaw',
  'Europe/Athens',
  'Europe/Kyiv',
  'Europe/Moscow',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Vancouver',
  'America/Sao_Paulo',
  'Africa/Lagos',
  'Africa/Johannesburg',
  'Africa/Cairo',
  'Asia/Jerusalem',
  'Asia/Dubai',
  'Asia/Karachi',
  'Asia/Kolkata',
  'Asia/Bangkok',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Perth',
  'Australia/Sydney',
  'Pacific/Auckland',
]

let cachedZones: string[] | null = null

/** Every IANA zone the browser knows about, for the timezone combobox. */
export function timezoneOptions(): string[] {
  if (cachedZones) {
    return cachedZones
  }

  const supported = (
    Intl as typeof Intl & {
      supportedValuesOf?: (key: string) => string[]
    }
  ).supportedValuesOf

  try {
    const zones = supported?.('timeZone')
    cachedZones = zones && zones.length > 0 ? zones : FALLBACK_TIMEZONES
  } catch {
    cachedZones = FALLBACK_TIMEZONES
  }

  return cachedZones
}

/**
 * Re-render on a timer so "open now" badges do not go stale on a page that can
 * sit open for hours. Half a minute is well inside the one-minute resolution
 * of a deployment window.
 */
export function useTick(intervalMs = 30_000): number {
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const timer = setInterval(() => setTick((value) => value + 1), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])

  return tick
}

/** Case-insensitive "does any of this text contain the query" helper. */
export function matchesFilter(query: string, ...values: string[]): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) {
    return true
  }
  return values.some((value) => value.toLowerCase().includes(needle))
}

/** Turn a display name into a usable config key. */
export function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
}

/** Make `key` unique against `taken` by appending -2, -3, ... */
export function uniqueKey(key: string, taken: string[]): string {
  if (!taken.includes(key)) {
    return key
  }
  let suffix = 2
  while (taken.includes(`${key}-${suffix}`)) {
    suffix += 1
  }
  return `${key}-${suffix}`
}
