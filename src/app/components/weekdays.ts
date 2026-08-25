/**
 * Days of the week, as the config writes them.
 *
 * Stored as short names rather than numbers because the config is hand-edited
 * and passed between people: `["mon", "tue", "wed", "thu"]` says what it means
 * and `[1, 2, 3, 4]` needs a lookup and an argument about whether weeks start
 * on Sunday.
 *
 * The order here is JavaScript's - `Date.getDay()` returns 0 for Sunday - and
 * is used for indexing, never for display. What the interface shows starts on
 * Monday, which is what a working week means to the people configuring one.
 */

export const WEEKDAYS = [
  'sun',
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
] as const

export type Weekday = (typeof WEEKDAYS)[number]

/** Monday first, for anything a person reads. */
export const WEEK_DISPLAY_ORDER: readonly Weekday[] = [
  'mon',
  'tue',
  'wed',
  'thu',
  'fri',
  'sat',
  'sun',
]

const DAYS_PER_WEEK = WEEKDAYS.length

export function isWeekday(value: unknown): value is Weekday {
  return (
    typeof value === 'string' && (WEEKDAYS as readonly string[]).includes(value)
  )
}

/** The weekday `date` falls on. */
export function weekdayOf(date: Date): Weekday {
  return WEEKDAYS[date.getDay()]
}

/** `days` shifted by whole days, wrapping around the week. */
export function shiftDays(days: readonly Weekday[], by: number): Weekday[] {
  if (by === 0) {
    return [...days]
  }
  return days.map((day) => {
    const index = WEEKDAYS.indexOf(day)
    return WEEKDAYS[(index + by + DAYS_PER_WEEK * 7) % DAYS_PER_WEEK]
  })
}

/** The day before `day`. */
export function previousDay(day: Weekday): Weekday {
  return WEEKDAYS[(WEEKDAYS.indexOf(day) + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK]
}

/**
 * Read a stored `days` value, dropping anything unrecognised.
 *
 * An empty result means every day. That is what an absent key has always meant
 * and it is what an empty list most likely means too - "no days at all" is a
 * deployment window that can never open, which nobody sets on purpose.
 */
export function toWeekdays(value: unknown): Weekday[] {
  if (!Array.isArray(value)) {
    return []
  }
  const seen = new Set<Weekday>()
  for (const entry of value) {
    if (isWeekday(entry)) {
      seen.add(entry)
    }
  }
  return WEEKDAYS.filter((day) => seen.has(day))
}

/** Does this set of days constrain anything? */
export function isEveryDay(days: readonly Weekday[]): boolean {
  return days.length === 0 || days.length === DAYS_PER_WEEK
}

/**
 * The message key holding the short label for a day.
 *
 * Spelled out rather than built from the day name. check-locales.js reads the
 * source for the keys it can see, so a computed one is invisible to it - and a
 * message key nothing can verify is one that breaks quietly when it is
 * renamed. It caught exactly that when these were assembled from the day name.
 */
const DAY_MESSAGE_KEYS: Record<Weekday, string> = {
  mon: 'l10nDayMon',
  tue: 'l10nDayTue',
  wed: 'l10nDayWed',
  thu: 'l10nDayThu',
  fri: 'l10nDayFri',
  sat: 'l10nDaySat',
  sun: 'l10nDaySun',
}

export function dayMessageKey(day: Weekday): string {
  return DAY_MESSAGE_KEYS[day]
}

/**
 * Split a set of days into consecutive runs, in the order a person reads them.
 *
 * "Mon, Tue, Wed, Thu" is four facts to hold; "Mon-Thu" is one. Runs are found
 * against the display order rather than the storage order, so a Saturday and
 * Sunday pair reads as the weekend it is rather than being split across the
 * ends of the list.
 */
export function groupWeekdays(days: readonly Weekday[]): Weekday[][] {
  const present = WEEK_DISPLAY_ORDER.filter((day) => days.includes(day))
  const runs: Weekday[][] = []

  for (const day of present) {
    const run = runs[runs.length - 1]
    const previous = run?.[run.length - 1]
    if (
      run &&
      previous &&
      WEEK_DISPLAY_ORDER.indexOf(day) === WEEK_DISPLAY_ORDER.indexOf(previous) + 1
    ) {
      run.push(day)
    } else {
      runs.push([day])
    }
  }

  return runs
}

/**
 * A set of days as text, e.g. "Mon-Thu" or "Mon, Wed, Fri".
 *
 * Takes the labels rather than reaching for them, so the shape of this is
 * testable without a message catalogue and the module stays free of the
 * extension APIs - it is on the content script's path.
 *
 * A run of two is listed rather than ranged: "Sat, Sun" is no longer than
 * "Sat-Sun" and does not ask the reader to expand anything.
 */
export function formatWeekdays(
  days: readonly Weekday[],
  label: (day: Weekday) => string,
): string {
  if (isEveryDay(days)) {
    return ''
  }

  return groupWeekdays(days)
    .map((run) =>
      run.length > 2
        ? `${label(run[0])}\u2013${label(run[run.length - 1])}`
        : run.map(label).join(', '),
    )
    .join(', ')
}
