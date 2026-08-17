import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'

dayjs.extend(utc)
dayjs.extend(customParseFormat)
dayjs.extend(timezone)

const HH_MM_FORMAT = 'HH:mm'
const HH_MM_SS_FORMAT = 'HH:mm:ss'

const TIME_SEPARATOR = ':'
const MINUTES_PER_DAY = 24 * 60

/** Any date works for formatting a bare time; this one is just a fixed anchor. */
const ANCHOR_DATE = '2000-01-01'

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
