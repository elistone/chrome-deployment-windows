import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DW } from '../src/app/components/DW'
import { ICONS, Notice } from '../src/app/components/Notice'
import type { ResolvedDeployment } from '../src/app/config/types'
import { chromeMock } from './helpers/chromeMock'
import { renderGithubPage, testConfig } from './helpers/fixtures'

function resolve(url: string): ResolvedDeployment {
  const info = new DW(testConfig(), url).getDeploymentInfo()
  if (!info) {
    throw new Error(`no deployment resolved for ${url}`)
  }
  return info
}

const DAYTIME = 'https://github.com/acme/daytime'
const NOTES_ONLY = 'https://github.com/acme/notes-only'

describe('Notice', () => {
  let notice: Notice | null = null

  beforeEach(() => {
    renderGithubPage()
  })

  afterEach(() => {
    notice?.destroy()
    notice = null
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  describe('build', () => {
    it('renders the name, both windows and the live status', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      const element = notice.build()

      expect(element.querySelector('.dw-current-name')?.textContent).toBe(
        'Daytime project',
      )
      expect(element.querySelector('.dw-deployment-time')?.textContent).toContain(
        '09:00 - 17:00',
      )
      expect(element.querySelector('.dw-deployment-time')?.textContent).toContain(
        'Europe/London',
      )
      expect(element.querySelector('.dw-local-time')).not.toBeNull()
      expect(element.querySelector('.dw-current-status-text')?.textContent).toBe(
        'Deployment window open',
      )
    })

    it('applies the deploy class while the window is open', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))
      notice = new Notice(resolve(DAYTIME))
      expect(notice.build().className).toBe('dw-notification flash flash-success')
    })

    it('applies the no-deploy class while the window is closed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice = new Notice(resolve(DAYTIME))
      expect(notice.build().className).toBe('dw-notification flash flash-error')
    })

    it('renders notes as markdown behind a toggle', () => {
      notice = new Notice(resolve(DAYTIME))
      const element = notice.build()

      expect(element.querySelector('#dw-toggle-btn')?.textContent).toBe(
        'Show details',
      )
      const details = element.querySelector<HTMLElement>('.dw-details')
      expect(details?.style.display).toBe('none')
      // The markdown '**two**' inside the notes body, not the "Notes" heading.
      expect(details?.querySelector('.dw-notes strong')?.textContent).toBe('two')
    })

    it('omits the toggle entirely when there are no notes', () => {
      const deployment = resolve(DAYTIME)
      deployment.notes = ''
      notice = new Notice(deployment)
      const element = notice.build()

      expect(element.querySelector('#dw-toggle-btn')).toBeNull()
      expect(element.querySelector('.dw-details')).toBeNull()
    })

    describe('notes-only', () => {
      it('shows notes without any window or status', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const element = notice.build()

        expect(element.querySelector('.dw-current-name')?.textContent).toBe(
          'Notes only project',
        )
        expect(element.querySelector('.dw-deployment-time')).toBeNull()
        expect(element.querySelector('.dw-current-status')).toBeNull()
        expect(element.querySelector('.dw-notes')?.textContent).toContain(
          'Frozen until Q3.',
        )
      })

      it('shows the notes immediately rather than behind a toggle', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const details = notice.build().querySelector<HTMLElement>('.dw-details')
        expect(details?.style.display).toBe('')
      })

      it('uses the notes class override when configured', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        expect(notice.build().className).toBe('dw-notification flash flash-warn')
      })

      it('falls back to the deploy/no-deploy class without an override', () => {
        const deployment = resolve(NOTES_ONLY)
        delete deployment.domainInfo.classes.notes
        notice = new Notice(deployment)
        expect(notice.build().className).toMatch(/flash flash-(success|error)$/)
      })
    })

    it('escapes a name containing markup', () => {
      const deployment = resolve(DAYTIME)
      deployment.name = '<img src=x onerror=alert(1)>'
      notice = new Notice(deployment)
      const element = notice.build()

      expect(element.querySelector('img')).toBeNull()
      expect(element.querySelector('.dw-current-name')?.textContent).not.toContain(
        '<img',
      )
    })

    it('does not emit a script tag from notes', () => {
      const deployment = resolve(DAYTIME)
      deployment.notes = '<script>alert(1)</script>'
      notice = new Notice(deployment)
      expect(notice.build().querySelector('script')).toBeNull()
    })
  })

  describe('insert', () => {
    it('inserts after the first matching class', () => {
      notice = new Notice(resolve(DAYTIME))
      expect(notice.insert()).toBe(true)

      const nav = document.querySelector('.file-navigation')
      expect(nav?.nextElementSibling?.classList.contains('dw-notification')).toBe(
        true,
      )
    })

    it('inserts only once even with several candidate locations', () => {
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      expect(document.querySelectorAll('.dw-notification')).toHaveLength(1)
    })

    it('falls through to the next location when the first is absent', () => {
      document.querySelector('.file-navigation')?.remove()

      notice = new Notice(resolve(DAYTIME))
      expect(notice.insert()).toBe(true)

      const content = document.querySelector('.repository-content')
      expect(
        content?.previousElementSibling?.classList.contains('dw-notification'),
      ).toBe(true)
    })

    it('reports failure when no location exists on the page', () => {
      document.body.innerHTML = '<div id="page">nothing to hook onto</div>'

      notice = new Notice(resolve(DAYTIME))
      expect(notice.insert()).toBe(false)
      expect(document.querySelector('.dw-notification')).toBeNull()
    })

    it('does not start the clock when insertion failed', () => {
      vi.useFakeTimers()
      document.body.innerHTML = '<div id="page"></div>'

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      vi.advanceTimersByTime(5000)

      expect(chromeMock().sentMessages).toHaveLength(0)
    })
  })

  describe('realtime updates', () => {
    it('refreshes the clock every second', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      const clock = () =>
        document.querySelector('.dw-current-time-text')?.textContent
      expect(clock()).toBe('12:00:00')

      // advanceTimersByTime moves the fake clock as well as firing the timer.
      vi.advanceTimersByTime(1000)
      expect(clock()).toBe('12:00:01')

      vi.advanceTimersByTime(1000)
      expect(clock()).toBe('12:00:02')
    })

    it('flips status and classes when the window closes', () => {
      // The fixture window is 09:00-17:00 Europe/London, which is 04:00-12:00
      // in the America/New_York timezone the tests are pinned to.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T11:59:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      const element = document.querySelector('.dw-notification')!
      expect(element.className).toBe('dw-notification flash flash-success')

      vi.setSystemTime(new Date('2024-06-03T13:30:00'))
      vi.advanceTimersByTime(1000)

      expect(
        document.querySelector('.dw-current-status-text')?.textContent,
      ).toBe('Deployment window closed')
      expect(
        document.querySelector('.dw-notification')?.className,
      ).toBe('dw-notification flash flash-error')
    })

    it('does not let a crafted status string inject markup', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))
      vi.mocked(chrome.i18n.getMessage).mockReturnValue('<img src=x>')

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      vi.advanceTimersByTime(1000)

      expect(document.querySelector('.dw-current-status-text img')).toBeNull()
      expect(
        document.querySelector('.dw-current-status-text')?.textContent,
      ).toBe('<img src=x>')
    })
  })

  describe('icon updates', () => {
    it('sends the open icon while the window is open', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      expect(chromeMock().sentMessages).toEqual([{ newIconPath: ICONS.open }])
    })

    it('sends the closed icon while the window is closed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      expect(chromeMock().sentMessages).toEqual([{ newIconPath: ICONS.closed }])
    })

    it('only messages the worker when the icon actually changes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      vi.advanceTimersByTime(10_000)

      // Ten ticks, one message: the v1 code messaged on every single tick.
      expect(chromeMock().sentMessages).toHaveLength(1)

      vi.setSystemTime(new Date('2024-06-03T17:30:00'))
      vi.advanceTimersByTime(1000)
      expect(chromeMock().sentMessages).toHaveLength(2)
    })
  })

  describe('details toggle', () => {
    it('opens and closes the notes', () => {
      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      const toggle = document.getElementById('dw-toggle-btn')!
      const details = document.querySelector<HTMLElement>('.dw-details')!

      toggle.click()
      expect(details.style.display).toBe('block')
      expect(toggle.textContent).toBe('Hide details')

      toggle.click()
      expect(details.style.display).toBe('none')
      expect(toggle.textContent).toBe('Show details')
    })
  })

  describe('destroy', () => {
    it('removes the notice and stops the clock', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      const local = new Notice(resolve(DAYTIME))
      local.insert()
      expect(document.querySelector('.dw-notification')).not.toBeNull()

      local.destroy()

      expect(document.querySelector('.dw-notification')).toBeNull()
      expect(local.inserted).toBe(false)

      const before = chromeMock().sentMessages.length
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      vi.advanceTimersByTime(10_000)
      expect(chromeMock().sentMessages).toHaveLength(before)
    })
  })
})
