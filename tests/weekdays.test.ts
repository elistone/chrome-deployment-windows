import { describe, expect, it } from 'vitest'

import {
  WEEKDAYS,
  dayMessageKey,
  formatWeekdays,
  groupWeekdays,
  WEEK_DISPLAY_ORDER,
  isEveryDay,
  isWeekday,
  previousDay,
  shiftDays,
  toWeekdays,
  weekdayOf,
} from '../src/app/components/weekdays'

describe('weekdays', () => {
  it('indexes the way Date.getDay does', () => {
    // Everything that maps a date onto this list depends on it.
    expect(WEEKDAYS[0]).toBe('sun')
    expect(WEEKDAYS).toHaveLength(7)
  })

  it('shows the week starting on Monday', () => {
    // A working week, which is what the people configuring one mean by it.
    expect(WEEK_DISPLAY_ORDER[0]).toBe('mon')
    expect(WEEK_DISPLAY_ORDER[6]).toBe('sun')
    expect([...WEEK_DISPLAY_ORDER].sort()).toEqual([...WEEKDAYS].sort())
  })

  describe('weekdayOf', () => {
    it.each([
      ['2024-06-02T12:00:00', 'sun'],
      ['2024-06-03T12:00:00', 'mon'],
      ['2024-06-07T12:00:00', 'fri'],
      ['2024-06-08T12:00:00', 'sat'],
    ])('reads %s as %s', (iso, expected) => {
      expect(weekdayOf(new Date(iso))).toBe(expected)
    })
  })

  describe('previousDay', () => {
    it('steps back one', () => {
      expect(previousDay('tue')).toBe('mon')
    })

    it('wraps around the start of the week', () => {
      expect(previousDay('sun')).toBe('sat')
    })
  })

  describe('shiftDays', () => {
    it('leaves a zero shift alone', () => {
      expect(shiftDays(['mon', 'fri'], 0)).toEqual(['mon', 'fri'])
    })

    it('moves a set forward', () => {
      expect(shiftDays(['mon', 'fri'], 1)).toEqual(['tue', 'sat'])
    })

    it('moves a set backward, wrapping the week', () => {
      expect(shiftDays(['mon', 'sun'], -1)).toEqual(['sun', 'sat'])
    })
  })

  describe('toWeekdays', () => {
    it('keeps what it recognises, in week order', () => {
      expect(toWeekdays(['fri', 'mon'])).toEqual(['mon', 'fri'])
    })

    it('drops duplicates', () => {
      expect(toWeekdays(['mon', 'mon'])).toEqual(['mon'])
    })

    it.each([
      [['monday']],
      [['MON']],
      [[1]],
      [[null]],
      ['mon'],
      [undefined],
      [{}],
    ])('reads %j as no constraint', (value) => {
      expect(toWeekdays(value)).toEqual([])
    })
  })

  describe('isEveryDay', () => {
    it('treats nothing as everything', () => {
      // An absent list has always meant "any day", and an empty one is far
      // more likely a mistake than a window that can never open.
      expect(isEveryDay([])).toBe(true)
    })

    it('treats all seven as everything', () => {
      expect(isEveryDay([...WEEKDAYS])).toBe(true)
    })

    it('treats a subset as a constraint', () => {
      expect(isEveryDay(['mon'])).toBe(false)
    })
  })

  describe('isWeekday', () => {
    it.each(WEEKDAYS)('accepts %s', (day) => {
      expect(isWeekday(day)).toBe(true)
    })

    it.each(['monday', 'Mon', '', 1, null, undefined])(
      'rejects %j',
      (value) => {
        expect(isWeekday(value)).toBe(false)
      },
    )
  })
})

describe('reading a set of days', () => {
  const label = (day: string) => day.charAt(0).toUpperCase() + day.slice(1)

  describe('groupWeekdays', () => {
    it('reads the week starting on Monday', () => {
      expect(groupWeekdays(['sun', 'mon'])).toEqual([['mon'], ['sun']])
    })

    it('joins consecutive days into a run', () => {
      expect(groupWeekdays(['mon', 'tue', 'wed'])).toEqual([
        ['mon', 'tue', 'wed'],
      ])
    })

    it('keeps a gap as a gap', () => {
      expect(groupWeekdays(['mon', 'wed', 'fri'])).toEqual([
        ['mon'],
        ['wed'],
        ['fri'],
      ])
    })

    it('reads a weekend as one run rather than two ends of the week', () => {
      expect(groupWeekdays(['sat', 'sun'])).toEqual([['sat', 'sun']])
    })
  })

  describe('formatWeekdays', () => {
    it.each([
      [['mon', 'tue', 'wed', 'thu'], 'Mon–Thu'],
      [['mon', 'tue', 'wed', 'thu', 'fri'], 'Mon–Fri'],
      [['mon', 'wed', 'fri'], 'Mon, Wed, Fri'],
      [['mon'], 'Mon'],
      // Two is listed rather than ranged: no shorter, and nothing to expand.
      [['sat', 'sun'], 'Sat, Sun'],
      [['mon', 'tue', 'wed', 'sat'], 'Mon–Wed, Sat'],
    ])('reads %j as %s', (days, expected) => {
      expect(formatWeekdays(days as never, label as never)).toBe(expected)
    })

    it('says nothing when every day is included', () => {
      // There is no constraint to report, so reporting one would be noise.
      expect(formatWeekdays([], label as never)).toBe('')
      expect(formatWeekdays([...WEEKDAYS], label as never)).toBe('')
    })
  })

  describe('dayMessageKey', () => {
    it('names the catalogue entry for a day', () => {
      expect(dayMessageKey('mon')).toBe('l10nDayMon')
      expect(dayMessageKey('sun')).toBe('l10nDaySun')
    })
  })
})
