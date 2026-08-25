import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(customParseFormat)
dayjs.extend(timezone)

import {
  WEEKDAYS,
  type Weekday,
  isEveryDay,
  previousDay,
  weekdayOf,
} from './weekdays'

const HH_MM_FORMAT = 'HH:mm'
const HH_MM_SS_FORMAT = 'HH:mm:ss'

const TIME_SEPARATOR = ':'
const MINUTES_PER_DAY = 24 * 60

const WEEK_ORDER = WEEKDAYS
const DAYS_IN_WEEK = WEEKDAYS.length
const MAX_DAY_INDEX = DAYS_IN_WEEK - 1
const WEEK_INDEX: Record<Weekday, number> = Object.fromEntries(
  WEEKDAYS.map((day, index) => [day, index]),
) as Record<Weekday, number>

/** Any date works for formatting a bare time; this one is just a fixed anchor. */
const ANCHOR_DATE = '2000-01-01'

/** How long is left of the current state of a deployment window. */
export interface WindowCountdown {
  /** Is the window open right now? */
  open: boolean
  /** Whole minutes until it closes, or until it next opens. */
  minutes: number
}

/**
 * A window as something to ask questions of: when it opens, when it closes and
 * which days it opens on.
 *
 * Passed as one object rather than as loose strings so the days cannot be
 * quietly dropped at a call site that predates them.
 */
export interface WindowSpec {
  start: string
  end: string
  /** Days the window opens on. Empty means every day. */
  days?: readonly Weekday[]
}

export interface CurrentDate {
  day: string
  month: string
  year: number
}

/** Parse "HH:mm" (trailing seconds tolerated) into minutes since midnight. */
export function toMinutesOfDay(time: string): number | null {
  const parts = /^(\d{1,2}):([0-5]\d)(?::[0-5]\d)?$/.exec(time?.trim() ?? '')
  if (!parts) {
    return null
  }
  const hours = Number(parts[1])
  if (hours > 23) {
    return null
  }
  return hours * 60 + Number(parts[2])
}

/**
 * Is `zone` an IANA timezone this runtime understands?
 *
 * Guards every dayjs.tz call: an unrecognised zone throws a RangeError, and one
 * typo in the config used to take the whole notice down with it.
 */
export function isValidTimezone(zone: string): boolean {
  if (!zone || typeof zone !== 'string') {
    return false
  }
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

export class Timezones {
  readonly time: string
  readonly timeFormat: string
  readonly originalTimeZone: string
  readonly localTimeZone: string
  /**
   * Optional YYYY/MM/DD override for "today".
   *
   * Instance state, not static: it used to be a class property that every
   * constructor call reset, so building a second Timezones silently wiped the
   * date pinned on the first.
   */
  readonly currentDate: string | null

  /**
   * @param time              the time being looked at, 24 hour HH:mm
   * @param originalTimeZone  the timezone that `time` is expressed in
   * @param localTimeZone     optional viewer timezone; guessed when omitted
   * @param currentDate       optional YYYY/MM/DD override for "today"
   */
  constructor(
    time: string,
    originalTimeZone: string,
    localTimeZone: string | null = null,
    currentDate: string | null = null,
  ) {
    this.time = time
    this.timeFormat = HH_MM_FORMAT
    // Fall back rather than throw, so one bad zone cannot break everything.
    this.originalTimeZone = isValidTimezone(originalTimeZone)
      ? originalTimeZone
      : Timezones.findLocalTimezone()
    const local = localTimeZone ?? Timezones.findLocalTimezone()
    this.localTimeZone = isValidTimezone(local)
      ? local
      : Timezones.findLocalTimezone()
    this.currentDate = currentDate
  }

  /**
   * Convert the time into the viewer's timezone.
   *
   * The date matters: the offset between two zones depends on whether either is
   * observing daylight saving on the day in question.
   */
  toLocalTime(timeZone: string | null = null): string {
    const from = timeZone ?? this.getOriginalTimezone()
    const source = isValidTimezone(from) ? from : Timezones.findLocalTimezone()
    return dayjs
      .tz(this.getFormattedTime(), source)
      .tz(this.getLocalTimezone())
      .format(this.timeFormat)
  }

  /** The time as configured, i.e. converted from and to the same zone. */
  toOriginalTime(): string {
    return this.toLocalTime(this.getLocalTimezone())
  }

  /**
   * How many calendar days converting this time into the viewer's zone moves
   * it: -1, 0 or 1.
   *
   * Only the clock face survives {@link toLocalTime}, so a Tokyo morning shown
   * in Los Angeles keeps its hours and silently loses the fact that it is the
   * previous afternoon there. The days a window opens on have to move by the
   * same amount, or a Monday window would be advertised as opening on the
   * viewer's Monday when their calendar says Sunday.
   */
  dayShift(): number {
    const source = dayjs.tz(this.getFormattedTime(), this.getOriginalTimezone())
    const local = source.tz(this.getLocalTimezone())
    const difference = local.day() - source.day()

    // Across the Saturday/Sunday boundary the raw difference comes out as the
    // long way round the week.
    if (difference === MAX_DAY_INDEX) {
      return -1
    }
    if (difference === -MAX_DAY_INDEX) {
      return 1
    }
    return difference
  }

  static findLocalTimezone(): string {
    return dayjs.tz.guess()
  }

  getOriginalTimezone(): string {
    return this.originalTimeZone
  }

  getLocalTimezone(): string {
    return this.localTimeZone
  }

  private getFormattedTime(): string {
    const [hours, minutes] = this.time.split(TIME_SEPARATOR)
    const date = Timezones.getCurrentDate(this.currentDate)
    return `${date.year}-${date.month}-${date.day} ${hours}${TIME_SEPARATOR}${minutes}`
  }

  /**
   * The current wall-clock time, or `setTime` normalised to `timeFormat`.
   */
  static getCurrentTime(
    setTime: string | null = null,
    timeFormat: string = HH_MM_SS_FORMAT,
  ): string {
    if (!setTime) {
      return dayjs().format(timeFormat)
    }
    // The date is irrelevant when formatting a bare time, so anchor it.
    return dayjs(`${ANCHOR_DATE} ${setTime}`).format(timeFormat)
  }

  /**
   * Is the current time inside the window?
   *
   * Both bounds are compared at minute granularity and are inclusive, so a
   * 09:00-17:00 window is open from 09:00:00 up to and including 17:00:59.
   *
   * This replaced a dayjs comparison that widened the window by a minute at
   * each end to fake inclusivity, which reported "open" from 08:59:01 - a full
   * minute before the window actually began.
   *
   * A window whose end is before its start (23:00-02:00) wraps past midnight.
   */
  static isDeploymentWindow(
    startTime: string,
    endTime: string,
    setTime: string | null = null,
  ): boolean {
    const start = toMinutesOfDay(startTime)
    const end = toMinutesOfDay(endTime)
    const now = setTime === null ? Timezones.nowMinutes() : toMinutesOfDay(setTime)

    if (start === null || end === null || now === null) {
      return false
    }

    if (start <= end) {
      return now >= start && now <= end
    }
    return now >= start || now <= end
  }

  /**
   * How long until the window changes state, in whole minutes.
   *
   * The extension knew the window and it knew the time, and never subtracted
   * one from the other - so it could say "closed" without ever saying for how
   * much longer, which is the only part anyone actually acts on.
   *
   * Both directions wrap past midnight, so a window that has already ended
   * today counts forward to tomorrow's opening rather than going negative.
   * Zero means the boundary is inside the current minute: the window ends at
   * the close of `end`, so 0 is "any second now", not "already over".
   */
  static countdown(
    startTime: string,
    endTime: string,
    setTime: string | null = null,
  ): WindowCountdown | null {
    const start = toMinutesOfDay(startTime)
    const end = toMinutesOfDay(endTime)
    const now =
      setTime === null ? Timezones.nowMinutes() : toMinutesOfDay(setTime)

    if (start === null || end === null || now === null) {
      return null
    }

    const open = Timezones.isDeploymentWindow(startTime, endTime, setTime)
    const target = open ? end : start
    return {
      open,
      minutes: (target - now + MINUTES_PER_DAY) % MINUTES_PER_DAY,
    }
  }

  /**
   * Is the window open, taking its days into account?
   *
   * The day a window names is the day it *opens*. It has to be: a 23:00-02:00
   * window on Monday is one window - Monday night - not two hours of Monday
   * and two hours of Tuesday. So for a window that wraps past midnight, the
   * hours after midnight belong to the day before.
   */
  static isOpen(spec: WindowSpec, at: Date = new Date()): boolean {
    const start = toMinutesOfDay(spec.start)
    const end = toMinutesOfDay(spec.end)
    if (start === null || end === null) {
      return false
    }

    const now = at.getHours() * 60 + at.getMinutes()
    const inHours =
      start <= end ? now >= start && now <= end : now >= start || now <= end
    if (!inHours) {
      return false
    }

    const days = spec.days ?? []
    if (isEveryDay(days)) {
      return true
    }

    const today = weekdayOf(at)
    // Past midnight on a wrapping window: the window that is open now is the
    // one that opened yesterday.
    const openedOn = start <= end || now >= start ? today : previousDay(today)
    return days.includes(openedOn)
  }

  /**
   * How long until the window changes state, in whole minutes.
   *
   * Unlike the time-only {@link countdown} this looks forward through the week,
   * because with days a window can be several days from opening. Closing is
   * always within a day of now - the window is open, so its end is the next
   * boundary either way.
   */
  static countdownFor(
    spec: WindowSpec,
    at: Date = new Date(),
  ): WindowCountdown | null {
    const start = toMinutesOfDay(spec.start)
    const end = toMinutesOfDay(spec.end)
    if (start === null || end === null) {
      return null
    }

    const now = at.getHours() * 60 + at.getMinutes()

    if (Timezones.isOpen(spec, at)) {
      return { open: true, minutes: (end - now + MINUTES_PER_DAY) % MINUTES_PER_DAY }
    }

    const days = spec.days ?? []
    if (isEveryDay(days)) {
      return { open: false, minutes: (start - now + MINUTES_PER_DAY) % MINUTES_PER_DAY }
    }

    // Walk forward to the next day the window opens on. Eight steps rather
    // than seven so that "a week today" is reachable from a day whose opening
    // has already been and gone.
    const today = weekdayOf(at)
    const todayIndex = WEEK_INDEX[today]
    for (let offset = 0; offset <= DAYS_IN_WEEK; offset += 1) {
      const day = WEEK_ORDER[(todayIndex + offset) % DAYS_IN_WEEK]
      if (!days.includes(day)) {
        continue
      }
      // Today only counts if its opening is still ahead of us.
      if (offset === 0 && now >= start) {
        continue
      }
      return { open: false, minutes: offset * MINUTES_PER_DAY + start - now }
    }

    return null
  }

  /** Minutes since local midnight, right now. */
  private static nowMinutes(): number {
    const now = new Date()
    return (now.getHours() * 60 + now.getMinutes()) % MINUTES_PER_DAY
  }

  /**
   * Today's date, or the supplied YYYY/MM/DD override, zero padded.
   */
  static getCurrentDate(override: string | null = null): CurrentDate {
    let day: number
    let month: number
    let year: number

    if (override) {
      const [y, m, d] = override.split('/')
      day = parseInt(d, 10)
      month = parseInt(m, 10)
      year = parseInt(y, 10)
    } else {
      const now = new Date()
      day = now.getDate()
      month = now.getMonth() + 1
      year = now.getFullYear()
    }

    return {
      day: String(day).padStart(2, '0'),
      month: String(month).padStart(2, '0'),
      year,
    }
  }
}
