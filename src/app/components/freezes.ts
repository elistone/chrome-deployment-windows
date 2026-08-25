import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import timezone from 'dayjs/plugin/timezone'

// Registered here rather than relied on from elsewhere. `dayjs.extend` mutates
// one shared instance, so this worked for as long as Timezones.ts happened to
// be imported first - and `.tz()` silently returns the wrong day when it has
// not been. A test that imported only this module is what found it.
dayjs.extend(utc)
dayjs.extend(timezone)

/**
 * Dated freezes: stretches of the calendar when nothing ships, whatever the
 * window says.
 *
 * A freeze is not a property of a window, which is why it does not live inside
 * `time`. A window describes when deploying is allowed in the ordinary run of
 * things; a freeze suspends that for a fortnight in December because the people
 * who would fix it are not there. One is a rule, the other overrides it.
 *
 * Dates are plain `YYYY-MM-DD` and both ends are inclusive, so 20 December to
 * 2 January is frozen for the whole of both days. They are compared as strings,
 * which works because an ISO date sorts chronologically - and avoids parsing a
 * date only to compare it against another one.
 */

/** `YYYY-MM-DD`, the only date shape this accepts. */
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/

export interface Freeze {
  /** First frozen day, inclusive. */
  from: string
  /** Last frozen day, inclusive. */
  to: string
  /** Why, shown wherever the freeze is reported. */
  reason?: string
}

export interface ActiveFreeze {
  /** The day the freeze lifts, i.e. the day after `to`. */
  until: string
  /** The last frozen day, as configured. */
  to: string
  reason: string
}

/**
 * A real calendar date, not just the right shape.
 *
 * `2026-02-30` matches the pattern and is not a day. Left as a string
 * comparison everywhere else, but a range that can never contain today is
 * worth naming while somebody is looking at the editor.
 */
export function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string') {
    return false
  }
  const parts = ISO_DATE.exec(value)
  if (!parts) {
    return false
  }
  const [, year, month, day] = parts
  const date = new Date(Number(year), Number(month) - 1, Number(day))
  return (
    date.getFullYear() === Number(year) &&
    date.getMonth() === Number(month) - 1 &&
    date.getDate() === Number(day)
  )
}

/** Read stored freezes, dropping anything that is not a usable range. */
export function toFreezes(value: unknown): Freeze[] {
  if (!Array.isArray(value)) {
    return []
  }

  const freezes: Freeze[] = []
  for (const entry of value) {
    if (!entry || typeof entry !== 'object') {
      continue
    }
    const { from, to, reason } = entry as Partial<Freeze>
    if (!isCalendarDate(from) || !isCalendarDate(to) || to < from) {
      continue
    }
    freezes.push({
      from,
      to,
      ...(typeof reason === 'string' && reason.trim()
        ? { reason: reason.trim() }
        : {}),
    })
  }
  return freezes
}

/**
 * Today's date in `zone`, as `YYYY-MM-DD`.
 *
 * A freeze is a run of calendar days, and which day it is depends on where you
 * are standing. The window's own timezone is the one that decides: a freeze is
 * written by the same people who wrote the window, against the same calendar.
 */
export function todayIn(zone: string, at: Date = new Date()): string {
  try {
    return dayjs(at).tz(zone).format('YYYY-MM-DD')
  } catch {
    return dayjs(at).format('YYYY-MM-DD')
  }
}

/** The day after `date`, as `YYYY-MM-DD`. */
export function dayAfter(date: string): string {
  const parts = ISO_DATE.exec(date)
  if (!parts) {
    return date
  }
  const [, year, month, day] = parts
  const next = new Date(Number(year), Number(month) - 1, Number(day) + 1)
  return [
    String(next.getFullYear()).padStart(4, '0'),
    String(next.getMonth() + 1).padStart(2, '0'),
    String(next.getDate()).padStart(2, '0'),
  ].join('-')
}

/**
 * The freeze covering `today`, if any.
 *
 * The one that ends latest wins where two overlap, so the answer to "when can
 * I deploy again" is not shortened by a freeze that is about to lift while
 * another one runs on.
 */
export function activeFreeze(
  freezes: readonly Freeze[],
  today: string,
): ActiveFreeze | null {
  let latest: Freeze | null = null
  for (const freeze of freezes) {
    if (freeze.from <= today && today <= freeze.to) {
      if (!latest || freeze.to > latest.to) {
        latest = freeze
      }
    }
  }

  if (!latest) {
    return null
  }
  return {
    until: dayAfter(latest.to),
    to: latest.to,
    reason: latest.reason ?? '',
  }
}
