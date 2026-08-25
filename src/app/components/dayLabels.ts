import { Methods } from './Methods'
import {
  type Weekday,
  dayMessageKey,
  formatWeekdays,
} from './weekdays'

/**
 * A window's days as text, in the viewer's language.
 *
 * The formatting lives in weekdays.ts, which knows nothing about the extension
 * APIs; this is the thin part that hands it the labels. Empty when the window
 * opens every day - there is no constraint to report, and reporting one anyway
 * is how a notice ends up saying more than it means.
 */
export function daysLabel(days: readonly Weekday[]): string {
  return formatWeekdays(days, (day) => Methods.i18n(dayMessageKey(day)))
}
