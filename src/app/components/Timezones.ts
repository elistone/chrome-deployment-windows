import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import timezone from 'dayjs/plugin/timezone'
import isBetween from 'dayjs/plugin/isBetween'

dayjs.extend(utc)
dayjs.extend(customParseFormat)
dayjs.extend(timezone)
dayjs.extend(isBetween)

const HH_MM_FORMAT = 'HH:mm'
const HH_MM_SS_FORMAT = 'HH:mm:ss'

const TIME_SEPARATOR = ':'
const SECONDS_SUFFIX = '00'

export interface CurrentDate {
  day: string
  month: string
  year: number
}

export class Timezones {
  /**
   * Overrides "today" for the whole class. Only set by tests and by callers
   * that pass an explicit date; kept static to preserve the v1 API.
   */
  static currentDate: string | null = null

  readonly time: string
  readonly timeFormat: string
  readonly originalTimeZone: string
  readonly localTimeZone: string

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
    this.originalTimeZone = originalTimeZone
    this.localTimeZone = localTimeZone ?? Timezones.findLocalTimezone()
    Timezones.currentDate = currentDate
  }

  /** Convert the time into the viewer's timezone. */
  toLocalTime(timeZone: string | null = null): string {
    const from = timeZone ?? this.getOriginalTimezone()
    return dayjs
      .tz(this.getFormattedTime(), from)
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
    const date = Timezones.getCurrentDate()
    return `${date.year}-${date.month}-${date.day} ${hours}${TIME_SEPARATOR}${minutes}`
  }

  static getCurrentTime(
    setTime: string | null = null,
    timeFormat: string = HH_MM_SS_FORMAT,
  ): string {
    if (!setTime) {
      return dayjs().format(timeFormat)
    }
    const date = Timezones.getCurrentDate()
    return dayjs(`${date.year}-${date.month}-${date.day} ${setTime}`).format(
      timeFormat,
    )
  }

  /**
   * Is the current time inside the window?
   *
   * Windows that wrap past midnight (end < start) are handled by inverting the
   * check against the closed period instead.
   */
  static isDeploymentWindow(
    startTime: string,
    endTime: string,
    setTime: string | null = null,
    timeFormat: string = HH_MM_SS_FORMAT,
  ): boolean {
    const time = dayjs(Timezones.getCurrentTime(setTime), timeFormat)
    let beforeTime = dayjs(Timezones.withSecondsSuffix(startTime), timeFormat)
    let afterTime = dayjs(Timezones.withSecondsSuffix(endTime), timeFormat)

    if (afterTime < beforeTime) {
      return !time.isBetween(afterTime, beforeTime)
    }

    // isBetween is exclusive; widen by a minute either side so that a time
    // landing exactly on the start or end still counts as inside the window.
    beforeTime = beforeTime.add(-1, 'm')
    afterTime = afterTime.add(1, 'm')
    return time.isBetween(beforeTime, afterTime)
  }

  static getCurrentDate(): CurrentDate {
    let day: number
    let month: number
    let year: number

    if (Timezones.currentDate) {
      const [y, m, d] = Timezones.currentDate.split('/')
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

  private static withSecondsSuffix(hoursAndMinutes: string): string {
    return hoursAndMinutes + TIME_SEPARATOR + SECONDS_SUFFIX
  }
}
