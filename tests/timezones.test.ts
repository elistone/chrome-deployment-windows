import { afterEach, describe, expect, it, vi } from 'vitest'

import { Timezones } from '../src/app/components/Timezones'

describe('Timezones', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('toOriginalTime', () => {
    it('returns the configured time unchanged, whatever the zone', () => {
      const cases = [
        { time: '01:00', zone: 'Europe/Zurich' },
        { time: '04:00', zone: 'Europe/London' },
        { time: '05:15', zone: 'Europe/Budapest' },
        { time: '13:25', zone: 'Asia/Jerusalem' },
        { time: '21:30', zone: 'Asia/Hong_Kong' },
        { time: '23:45', zone: 'America/New_York' },
      ]

      for (const { time, zone } of cases) {
        expect(new Timezones(time, zone).toOriginalTime()).toBe(time)
      }
    })
  })

  describe('toLocalTime', () => {
    const winter = '2020/01/01'
    const summer = '2020/06/01'

    it.each([
      ['Europe/London', 'Africa/Johannesburg', '14:00', winter],
      ['Europe/London', 'America/New_York', '07:00', winter],
      ['Europe/London', 'America/Los_Angeles', '04:00', winter],
      ['Europe/London', 'Asia/Hong_Kong', '20:00', winter],
      ['Europe/London', 'Australia/Perth', '20:00', winter],
      ['Europe/London', 'Asia/Tokyo', '21:00', winter],
      ['Africa/Johannesburg', 'Europe/London', '10:00', winter],
      ['America/New_York', 'Europe/London', '17:00', winter],
      ['America/Los_Angeles', 'Europe/London', '20:00', winter],
      ['Asia/Hong_Kong', 'Europe/London', '04:00', winter],
      ['Australia/Perth', 'Europe/London', '04:00', winter],
      ['Asia/Tokyo', 'Europe/London', '03:00', winter],
    ])('converts 12:00 %s -> %s = %s (winter)', (from, to, expected, date) => {
      expect(new Timezones('12:00', from, to, date).toLocalTime()).toBe(expected)
    })

    it.each([
      ['Europe/London', 'Africa/Johannesburg', '13:00', summer],
      ['Europe/London', 'America/New_York', '07:00', summer],
      ['Europe/London', 'America/Los_Angeles', '04:00', summer],
      ['Europe/London', 'Asia/Hong_Kong', '19:00', summer],
      ['Europe/London', 'Australia/Perth', '19:00', summer],
      ['Europe/London', 'Asia/Tokyo', '20:00', summer],
      ['Africa/Johannesburg', 'Europe/London', '11:00', summer],
      ['America/New_York', 'Europe/London', '17:00', summer],
      ['America/Los_Angeles', 'Europe/London', '20:00', summer],
      ['Asia/Hong_Kong', 'Europe/London', '05:00', summer],
      ['Australia/Perth', 'Europe/London', '05:00', summer],
      ['Asia/Tokyo', 'Europe/London', '04:00', summer],
    ])(
      'converts 12:00 %s -> %s = %s (summer, DST applied)',
      (from, to, expected, date) => {
        expect(new Timezones('12:00', from, to, date).toLocalTime()).toBe(expected)
      },
    )

    it('crosses the date line without losing the time-of-day', () => {
      expect(
        new Timezones('23:00', 'Pacific/Auckland', 'America/Los_Angeles', winter).toLocalTime(),
      ).toBe('02:00')
    })
  })

  describe('isDeploymentWindow', () => {
    it.each([
      ['22:00', '06:00', '12:00', false],
      ['22:00', '06:00', '04:00', true],
      ['05:00', '22:00', '23:00', false],
      ['05:00', '22:00', '12:00', true],
      ['00:00', '23:59', '01:00', true],
      ['00:00', '23:59', '07:00', true],
      ['00:00', '23:59', '11:00', true],
      ['00:00', '23:59', '15:00', true],
      ['00:00', '23:59', '19:00', true],
      ['00:00', '23:59', '22:00', true],
      ['10:00', '10:30', '10:31', false],
      ['10:00', '10:30', '10:30', true],
    ])('window %s-%s at %s -> %s', (start, end, now, expected) => {
      expect(Timezones.isDeploymentWindow(start, end, now)).toBe(expected)
    })

    it('includes both boundaries of a normal window', () => {
      expect(Timezones.isDeploymentWindow('09:00', '17:00', '09:00')).toBe(true)
      expect(Timezones.isDeploymentWindow('09:00', '17:00', '17:00')).toBe(true)
      expect(Timezones.isDeploymentWindow('09:00', '17:00', '08:59')).toBe(false)
      expect(Timezones.isDeploymentWindow('09:00', '17:00', '17:01')).toBe(false)
    })

    it('handles a window that wraps past midnight', () => {
      expect(Timezones.isDeploymentWindow('23:00', '02:00', '23:30')).toBe(true)
      expect(Timezones.isDeploymentWindow('23:00', '02:00', '00:30')).toBe(true)
      expect(Timezones.isDeploymentWindow('23:00', '02:00', '01:59')).toBe(true)
      expect(Timezones.isDeploymentWindow('23:00', '02:00', '12:00')).toBe(false)
      expect(Timezones.isDeploymentWindow('23:00', '02:00', '22:00')).toBe(false)
    })

    it('uses the real clock when no time is supplied', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2020-01-01T13:00:00'))
      expect(Timezones.isDeploymentWindow('09:00', '17:00')).toBe(true)

      vi.setSystemTime(new Date('2020-01-01T20:00:00'))
      expect(Timezones.isDeploymentWindow('09:00', '17:00')).toBe(false)
    })
  })

  describe('countdown', () => {
    it('counts down to the close while the window is open', () => {
      expect(Timezones.countdown('09:00', '17:00', '12:00')).toEqual({
        open: true,
        minutes: 300,
      })
    })

    it('counts down to the opening before the window starts', () => {
      expect(Timezones.countdown('09:00', '17:00', '07:30')).toEqual({
        open: false,
        minutes: 90,
      })
    })

    it('counts forward to tomorrow once the window has passed', () => {
      // 20:00 to the next 09:00 is 13 hours, not minus eleven.
      expect(Timezones.countdown('09:00', '17:00', '20:00')).toEqual({
        open: false,
        minutes: 780,
      })
    })

    it('counts down across midnight inside a wrapping window', () => {
      expect(Timezones.countdown('23:00', '02:00', '00:30')).toEqual({
        open: true,
        minutes: 90,
      })
    })

    it('counts up to a wrapping window from the middle of the day', () => {
      expect(Timezones.countdown('23:00', '02:00', '12:00')).toEqual({
        open: false,
        minutes: 660,
      })
    })

    it('reports zero for the closing minute itself', () => {
      // The window runs to the end of 17:00, so this is "any second now"
      // rather than "already shut".
      expect(Timezones.countdown('09:00', '17:00', '17:00')).toEqual({
        open: true,
        minutes: 0,
      })
    })

    it('returns null for a time it cannot read', () => {
      expect(Timezones.countdown('nope', '17:00', '12:00')).toBeNull()
      expect(Timezones.countdown('09:00', '', '12:00')).toBeNull()
    })

    it('uses the clock when no time is supplied', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T15:45:00'))
      expect(Timezones.countdown('09:00', '17:00')).toEqual({
        open: true,
        minutes: 75,
      })
    })
  })

  describe('getCurrentDate', () => {
    it('zero pads day and month', () => {
      expect(Timezones.getCurrentDate('2020/01/05')).toEqual({
        day: '05',
        month: '01',
        year: 2020,
      })
    })

    it('does not pad two digit values', () => {
      expect(Timezones.getCurrentDate('2020/11/23')).toEqual({
        day: '23',
        month: '11',
        year: 2020,
      })
    })

    it('falls back to the system date when unset', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2021-03-09T10:00:00'))
      expect(Timezones.getCurrentDate()).toEqual({
        day: '09',
        month: '03',
        year: 2021,
      })
    })
  })

  describe('getCurrentTime', () => {
    it('formats the supplied time with seconds', () => {
      expect(Timezones.getCurrentTime('09:30')).toBe('09:30:00')
    })

    it('honours a custom format', () => {
      expect(Timezones.getCurrentTime('09:30', 'HH:mm')).toBe('09:30')
    })
  })

  describe('findLocalTimezone', () => {
    it('returns a usable IANA zone name', () => {
      expect(Timezones.findLocalTimezone()).toMatch(/^[A-Za-z_]+\/[A-Za-z_+\-/]+$|^UTC$/)
    })
  })
})
