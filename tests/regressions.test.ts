import { describe, expect, it, vi } from 'vitest'

import { DW } from '../src/app/components/DW'
import { Notice } from '../src/app/components/Notice'
import { Timezones, isValidTimezone } from '../src/app/components/Timezones'
import { matchesPattern } from '../src/app/matching/MatchPattern'
import { validateConfig } from '../src/app/config/schema'
import type { DeploymentWindowsConfig } from '../src/app/config/types'
import { testConfig } from './helpers/fixtures'

/**
 * One block per bug found in review. Each asserts the corrected behaviour and
 * names what used to happen, so a regression is recognisable rather than just
 * red.
 */

function configWith(
  deployments: DeploymentWindowsConfig['deployments'],
): DeploymentWindowsConfig {
  const config = testConfig()
  config.deployments = deployments
  return config
}

describe('regression: deployment window boundaries', () => {
  // The old implementation widened the window by a minute at each end to fake
  // inclusivity, so it reported "open" from 08:59:01 through 17:00:59.
  it('is closed in the final seconds before the window opens', () => {
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '08:59:30')).toBe(false)
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '08:59:59')).toBe(false)
  })

  it('opens exactly on the start minute', () => {
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '09:00:00')).toBe(true)
  })

  it('stays open through the end minute, then closes', () => {
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '17:00:00')).toBe(true)
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '17:00:59')).toBe(true)
    expect(Timezones.isDeploymentWindow('09:00', '17:00', '17:01:00')).toBe(false)
  })

  it('applies the same boundaries to a window that wraps midnight', () => {
    expect(Timezones.isDeploymentWindow('23:00', '02:00', '22:59:30')).toBe(false)
    expect(Timezones.isDeploymentWindow('23:00', '02:00', '23:00:00')).toBe(true)
    expect(Timezones.isDeploymentWindow('23:00', '02:00', '02:00:59')).toBe(true)
    expect(Timezones.isDeploymentWindow('23:00', '02:00', '02:01:00')).toBe(false)
  })

  it('treats a one minute window as exactly that minute', () => {
    expect(Timezones.isDeploymentWindow('12:00', '12:00', '11:59:59')).toBe(false)
    expect(Timezones.isDeploymentWindow('12:00', '12:00', '12:00:00')).toBe(true)
    expect(Timezones.isDeploymentWindow('12:00', '12:00', '12:00:59')).toBe(true)
    expect(Timezones.isDeploymentWindow('12:00', '12:00', '12:01:00')).toBe(false)
  })

  it('is closed rather than open when a time cannot be parsed', () => {
    expect(Timezones.isDeploymentWindow('nonsense', '17:00', '12:00')).toBe(false)
    expect(Timezones.isDeploymentWindow('09:00', '99:99', '12:00')).toBe(false)
  })
})

describe('regression: overlapping deployment fragments', () => {
  // Matching is by substring, so "acme/repo" is contained in "acme/repo-two".
  // Taking the first match let the more general entry shadow the specific one,
  // and which won depended on object key order.
  const overlapping = {
    short: { name: 'SHORT', github: 'acme/repo' },
    long: { name: 'LONG', github: 'acme/repo-two' },
  }

  it('prefers the most specific fragment', () => {
    const info = new DW(
      configWith(overlapping),
      'https://github.com/acme/repo-two',
    ).getDeploymentInfo()
    expect(info?.name).toBe('LONG')
  })

  it('is independent of the order the deployments are declared in', () => {
    const reversed = {
      long: overlapping.long,
      short: overlapping.short,
    }
    const info = new DW(
      configWith(reversed),
      'https://github.com/acme/repo-two',
    ).getDeploymentInfo()
    expect(info?.name).toBe('LONG')
  })

  it('still resolves the general entry for its own url', () => {
    const info = new DW(
      configWith(overlapping),
      'https://github.com/acme/repo',
    ).getDeploymentInfo()
    expect(info?.name).toBe('SHORT')
  })

  it('keeps the earlier entry when two fragments tie exactly', () => {
    const tied = {
      first: { name: 'FIRST', github: 'acme/x' },
      second: { name: 'SECOND', github: 'acme/x' },
    }
    const info = new DW(
      configWith(tied),
      'https://github.com/acme/x',
    ).getDeploymentInfo()
    expect(info?.name).toBe('FIRST')
  })
})

describe('regression: invalid timezone in config', () => {
  // dayjs throws a RangeError for an unknown zone. It escaped out of DW, so the
  // content script caught it and no notice appeared at all.
  const bad = {
    a: {
      name: 'Bad zone',
      github: 'acme/a',
      time: { start: '09:00', end: '17:00', timezone: 'Not/AZone' },
    },
  }

  it('still resolves a deployment instead of throwing', () => {
    expect(() =>
      new DW(configWith(bad), 'https://github.com/acme/a').getDeploymentInfo(),
    ).not.toThrow()

    const info = new DW(
      configWith(bad),
      'https://github.com/acme/a',
    ).getDeploymentInfo()
    expect(info?.name).toBe('Bad zone')
  })

  it('falls back to the viewer timezone', () => {
    const info = new DW(
      configWith(bad),
      'https://github.com/acme/a',
    ).getDeploymentInfo()
    expect(info?.timeObj.original.timezone).toBe(Timezones.findLocalTimezone())
  })

  it('still builds a notice that renders', () => {
    const info = new DW(
      configWith(bad),
      'https://github.com/acme/a',
    ).getDeploymentInfo()!
    const element = new Notice(info).build()
    expect(element.shadowRoot?.querySelector('.name')?.textContent).toBe('Bad zone')
  })

  it('is rejected by the config validator so it cannot be saved', () => {
    const result = validateConfig(configWith(bad))
    expect(result.valid).toBe(false)
    expect(result.errors.join(' ')).toMatch(/timezone.*Not\/AZone/)
  })

  describe('isValidTimezone', () => {
    it.each(['Europe/London', 'America/New_York', 'Asia/Tokyo', 'UTC'])(
      'accepts %s',
      (zone) => expect(isValidTimezone(zone)).toBe(true),
    )

    it.each(['Not/AZone', 'Europe/Fakeville', '', 'GMT+25'])(
      'rejects %j',
      (zone) => expect(isValidTimezone(zone)).toBe(false),
    )
  })
})

describe('regression: notice reads its own DOM, not the page', () => {
  // The notice is injected into pages we do not control. Looking its own parts
  // up with document.getElementsByClassName(...)[0] could return a host page
  // element that happened to share the class.
  function hostilePage(): void {
    document.body.innerHTML = `
      <div class="clock">HOST PAGE VALUE</div>
      <div class="status-text">HOST PAGE VALUE</div>
      <div class="details" data-open="true">HOST PAGE VALUE</div>
      <div class="toggle">HOST PAGE VALUE</div>
      <div class="file-navigation">nav</div>
    `
  }

  /** The notice's own tree, which the shadow boundary keeps to itself. */
  function own(notice: Notice): ShadowRoot {
    const root = notice.element?.shadowRoot
    if (!root) {
      throw new Error('the notice has no shadow root')
    }
    return root
  }

  it('does not overwrite host page elements that share its classes', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T12:00:00'))
    hostilePage()

    const info = new DW(
      testConfig(),
      'https://github.com/acme/daytime',
    ).getDeploymentInfo()!
    const notice = new Notice(info)
    notice.insert()
    vi.advanceTimersByTime(2000)

    expect(
      document.querySelector('body > .clock')?.textContent,
    ).toBe('HOST PAGE VALUE')
    expect(
      document.querySelector('body > .status-text')?.textContent,
    ).toBe('HOST PAGE VALUE')

    notice.destroy()
    vi.useRealTimers()
  })

  it('updates its own clock even when the page has a decoy first', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-03T12:00:00'))
    hostilePage()

    const info = new DW(
      testConfig(),
      'https://github.com/acme/daytime',
    ).getDeploymentInfo()!
    const notice = new Notice(info)
    notice.insert()
    vi.advanceTimersByTime(1000)

    expect(own(notice).querySelector('.clock')?.textContent).toBe('12:00:01')

    notice.destroy()
    vi.useRealTimers()
  })

  it('toggles its own details, not a host page element', () => {
    hostilePage()

    const info = new DW(
      testConfig(),
      'https://github.com/acme/daytime',
    ).getDeploymentInfo()!
    const notice = new Notice(info)
    notice.insert()

    const ownDetails = own(notice).querySelector<HTMLElement>('.details')!
    const hostDetails =
      document.querySelector<HTMLElement>('body > .details')!

    own(notice).querySelector<HTMLElement>('.toggle')!.click()

    expect(ownDetails.dataset.open).toBe('true')
    expect(hostDetails.dataset.open).toBe('true') // untouched
    expect(hostDetails.textContent).toBe('HOST PAGE VALUE')

    notice.destroy()
  })

  it('does not inject a fixed id into the host document', () => {
    // A hardcoded element id can collide with the page it is injected into.
    hostilePage()
    const info = new DW(
      testConfig(),
      'https://github.com/acme/daytime',
    ).getDeploymentInfo()!
    const notice = new Notice(info)
    notice.insert()

    expect(document.getElementById('dw-toggle-btn')).toBeNull()
    notice.destroy()
  })
})

describe('regression: match patterns ignore the fragment', () => {
  // Chrome does not consider the fragment when matching, so neither should we.
  it('matches a url carrying a fragment', () => {
    expect(
      matchesPattern('https://example.com/a', 'https://example.com/a#section'),
    ).toBe(true)
  })

  it('still matches with both a query and a fragment', () => {
    expect(
      matchesPattern('https://example.com/*', 'https://example.com/a?b=c#d'),
    ).toBe(true)
  })

  it('continues to consider the query string', () => {
    expect(
      matchesPattern('https://example.com/a', 'https://example.com/a?b=c'),
    ).toBe(false)
    expect(
      matchesPattern('https://example.com/a*', 'https://example.com/a?b=c'),
    ).toBe(true)
  })
})

describe('regression: Timezones has no shared mutable state', () => {
  // currentDate used to be static and reset by every constructor call, so
  // building a second instance silently changed the first one's answers.
  it('one instance cannot change another instance date', () => {
    const winter = new Timezones('12:00', 'Europe/London', 'Asia/Tokyo', '2020/01/01')
    const first = winter.toLocalTime()

    // Constructing another instance with no pinned date must not disturb it.
    new Timezones('09:00', 'America/New_York')

    expect(winter.toLocalTime()).toBe(first)
    expect(winter.toLocalTime()).toBe('21:00')
  })

  it('two instances keep their own dates', () => {
    const winter = new Timezones('12:00', 'Europe/London', 'Asia/Tokyo', '2020/01/01')
    const summer = new Timezones('12:00', 'Europe/London', 'Asia/Tokyo', '2020/06/01')

    expect(winter.toLocalTime()).toBe('21:00')
    expect(summer.toLocalTime()).toBe('20:00')
    // Re-read the first: it must not have been changed by the second.
    expect(winter.toLocalTime()).toBe('21:00')
  })
})
