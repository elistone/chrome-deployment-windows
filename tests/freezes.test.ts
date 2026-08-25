import { describe, expect, it } from 'vitest'

import {
  activeFreeze,
  dayAfter,
  isCalendarDate,
  toFreezes,
  todayIn,
} from '../src/app/components/freezes'

const CHRISTMAS = { from: '2026-12-20', to: '2027-01-02', reason: 'Change freeze' }

describe('freezes', () => {
  describe('isCalendarDate', () => {
    it.each(['2026-12-20', '2027-01-02', '2024-02-29'])('accepts %s', (date) => {
      expect(isCalendarDate(date)).toBe(true)
    })

    it('rejects a date that looks right and is not a day', () => {
      // Matches the pattern, never happens.
      expect(isCalendarDate('2026-02-30')).toBe(false)
      expect(isCalendarDate('2025-02-29')).toBe(false)
      expect(isCalendarDate('2026-13-01')).toBe(false)
    })

    it.each(['20-12-2026', '2026/12/20', '2026-1-1', '', null, 20261220])(
      'rejects %j',
      (value) => {
        expect(isCalendarDate(value)).toBe(false)
      },
    )
  })

  describe('dayAfter', () => {
    it('steps to the next day', () => {
      expect(dayAfter('2026-12-20')).toBe('2026-12-21')
    })

    it('rolls over the end of a month', () => {
      expect(dayAfter('2026-11-30')).toBe('2026-12-01')
    })

    it('rolls over the end of a year', () => {
      expect(dayAfter('2026-12-31')).toBe('2027-01-01')
    })

    it('handles a leap day', () => {
      expect(dayAfter('2024-02-28')).toBe('2024-02-29')
      expect(dayAfter('2024-02-29')).toBe('2024-03-01')
    })
  })

  describe('toFreezes', () => {
    it('keeps a usable range', () => {
      expect(toFreezes([CHRISTMAS])).toEqual([CHRISTMAS])
    })

    it('keeps a single day', () => {
      expect(toFreezes([{ from: '2026-12-25', to: '2026-12-25' }])).toEqual([
        { from: '2026-12-25', to: '2026-12-25' },
      ])
    })

    it('drops a range that ends before it starts', () => {
      // Nothing could ever fall inside it, so it is a mistake rather than a
      // rule, and acting on it would freeze nothing while looking like it did.
      expect(toFreezes([{ from: '2027-01-02', to: '2026-12-20' }])).toEqual([])
    })

    it.each([
      [[{ from: '2026-12-20' }]],
      [[{ from: 'soon', to: '2027-01-02' }]],
      [[{ from: '2026-02-30', to: '2026-03-05' }]],
      [[null]],
      [['2026-12-20']],
      ['nope'],
      [undefined],
    ])('drops %j', (value) => {
      expect(toFreezes(value)).toEqual([])
    })

    it('drops a blank reason rather than storing an empty one', () => {
      expect(
        toFreezes([{ from: '2026-12-20', to: '2026-12-21', reason: '   ' }]),
      ).toEqual([{ from: '2026-12-20', to: '2026-12-21' }])
    })
  })

  describe('todayIn', () => {
    it('reads the date in the given zone', () => {
      // 14:00 UTC is the same day everywhere that matters here.
      const at = new Date('2026-12-20T14:00:00Z')
      expect(todayIn('Europe/London', at)).toBe('2026-12-20')
      expect(todayIn('Asia/Tokyo', at)).toBe('2026-12-20')
    })

    it('is a different day either side of the date line', () => {
      // 22:00 UTC is already tomorrow in Tokyo and still today in London.
      const at = new Date('2026-12-20T22:00:00Z')
      expect(todayIn('Europe/London', at)).toBe('2026-12-20')
      expect(todayIn('Asia/Tokyo', at)).toBe('2026-12-21')
    })

    it('falls back rather than throwing on a zone it does not know', () => {
      expect(todayIn('Mars/Olympus', new Date('2026-12-20T14:00:00Z'))).toMatch(
        /^\d{4}-\d{2}-\d{2}$/,
      )
    })
  })

  describe('activeFreeze', () => {
    it('finds a freeze covering today', () => {
      expect(activeFreeze([CHRISTMAS], '2026-12-25')).toEqual({
        until: '2027-01-03',
        to: '2027-01-02',
        reason: 'Change freeze',
      })
    })

    it('includes both ends of the range', () => {
      expect(activeFreeze([CHRISTMAS], '2026-12-20')).not.toBeNull()
      expect(activeFreeze([CHRISTMAS], '2027-01-02')).not.toBeNull()
    })

    it('is over the day after it ends', () => {
      expect(activeFreeze([CHRISTMAS], '2027-01-03')).toBeNull()
    })

    it('has not started the day before it begins', () => {
      expect(activeFreeze([CHRISTMAS], '2026-12-19')).toBeNull()
    })

    it('reports the later end when two freezes overlap', () => {
      // Otherwise "deploys resume on the 22nd" while the longer one runs on.
      const freezes = [
        { from: '2026-12-20', to: '2026-12-21' },
        { from: '2026-12-21', to: '2026-12-30' },
      ]
      expect(activeFreeze(freezes, '2026-12-21')?.to).toBe('2026-12-30')
    })

    it('has an empty reason rather than none at all', () => {
      expect(
        activeFreeze([{ from: '2026-12-20', to: '2026-12-21' }], '2026-12-20')
          ?.reason,
      ).toBe('')
    })

    it('finds nothing in an empty list', () => {
      expect(activeFreeze([], '2026-12-25')).toBeNull()
    })
  })
})
