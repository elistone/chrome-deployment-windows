import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { DW } from '../src/app/components/DW'
import { ICONS, Notice } from '../src/app/components/Notice'
import type { ResolvedDeployment } from '../src/app/config/types'
import { GLYPHS } from '../src/app/glyphs'
import { chromeMock } from './helpers/chromeMock'
import { renderGithubPage, testConfig } from './helpers/fixtures'

function resolve(url: string): ResolvedDeployment {
  const info = new DW(testConfig(), url).getDeploymentInfo()
  if (!info) {
    throw new Error(`no deployment resolved for ${url}`)
  }
  return info
}

/** The notice renders into a shadow root, so nothing is in the page's tree. */
function inside(host: Element | null | undefined): ShadowRoot {
  const root = (host as HTMLElement | null)?.shadowRoot
  if (!root) {
    throw new Error('the notice has no shadow root')
  }
  return root
}

/** The live notice on the page. */
function onPage(): ShadowRoot {
  return inside(document.querySelector('.dw-notification'))
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
      const root = inside(notice.build())

      expect(root.querySelector('.name')?.textContent).toBe('Daytime project')
      const rows = [...root.querySelectorAll('.row')].map(
        (row) => row.textContent?.replace(/\s+/g, ' ').trim(),
      )
      expect(rows[0]).toContain('09:00 – 17:00')
      expect(rows[0]).toContain('Europe/London')
      expect(rows[1]).toContain('04:00 – 12:00')
      expect(rows[1]).toContain('America/New_York')
      expect(root.querySelector('.status-text')?.textContent).toBe(
        'Deployment window open',
      )
    })

    it('keeps its own styling inside the shadow root', () => {
      notice = new Notice(resolve(DAYTIME))
      const host = notice.build()

      // Nothing is added to the page's own tree, and nothing the page styles
      // can reach what is drawn.
      expect(host.shadowRoot?.querySelector('style')).not.toBeNull()
      expect(host.querySelector('.notice')).toBeNull()
      expect(host.className).toBe('dw-notification')
    })

    it('marks itself open while the window is open', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())
      expect(root.querySelector('.notice')).toHaveAttribute(
        'data-status',
        'open',
      )
    })

    it('marks itself closed while the window is closed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())
      expect(root.querySelector('.notice')).toHaveAttribute(
        'data-status',
        'closed',
      )
    })

    it('follows the host page theme rather than the extension one', () => {
      const matchMedia = vi.fn().mockReturnValue({ matches: true })
      vi.stubGlobal('matchMedia', matchMedia)

      notice = new Notice(resolve(DAYTIME))
      expect(notice.build().dataset.theme).toBe('dark')

      vi.unstubAllGlobals()
    })

    it('renders notes as markdown behind a toggle', () => {
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())

      expect(root.querySelector('.toggle')?.textContent).toBe('Show details')
      expect(root.querySelector('.details')).toHaveAttribute(
        'data-open',
        'false',
      )
      // The markdown '**two**' inside the notes body, not the "Notes" heading.
      expect(root.querySelector('.notes strong')?.textContent).toBe('two')
    })

    it('omits the toggle entirely when there are no notes', () => {
      const deployment = resolve(DAYTIME)
      deployment.notes = ''
      notice = new Notice(deployment)
      const root = inside(notice.build())

      expect(root.querySelector('.toggle')).toBeNull()
      expect(root.querySelector('.details')).toBeNull()
    })

    describe('status mark', () => {
      const markOf = (root: ShadowRoot) =>
        root.querySelector('.mark path')?.getAttribute('d')

      it('wears the toolbar chevron while the window is open', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-06-03T10:00:00'))

        notice = new Notice(resolve(DAYTIME))
        expect(markOf(inside(notice.build()))).toBe(GLYPHS.open.d)
      })

      it('wears the toolbar bar while the window is shut', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-06-03T20:00:00'))

        notice = new Notice(resolve(DAYTIME))
        expect(markOf(inside(notice.build()))).toBe(GLYPHS.closed.d)
      })

      it('redraws the mark when the window closes under it', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-06-03T11:59:00'))

        notice = new Notice(resolve(DAYTIME))
        notice.insert()
        expect(markOf(onPage())).toBe(GLYPHS.open.d)

        vi.advanceTimersByTime(2 * 60 * 1000)

        expect(markOf(onPage())).toBe(GLYPHS.closed.d)
        expect(
          onPage().querySelector('.mark path')?.getAttribute('stroke-width'),
        ).toBe(String(GLYPHS.closed.width))
      })
    })

    describe('countdown', () => {
      // The fixture window is 09:00-17:00 Europe/London, which is 04:00-12:00
      // in the America/New_York timezone the tests are pinned to.
      it('says how long an open window has left', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-06-03T10:00:00'))

        notice = new Notice(resolve(DAYTIME))
        const root = inside(notice.build())

        expect(root.querySelector('.countdown')?.textContent).toBe(
          'Closes in 2h',
        )
      })

      it('says how long until a closed window opens', () => {
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2024-06-03T13:30:00'))

        notice = new Notice(resolve(DAYTIME))
        const root = inside(notice.build())

        expect(root.querySelector('.countdown')?.textContent).toBe(
          'Opens in 14h 30m',
        )
      })

      it('has nothing to count down for a notes-only entry', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const root = inside(notice.build())

        expect(root.querySelector('.countdown')).toBeNull()
      })
    })

    describe('spacing', () => {
      it('applies the site overrides as custom properties', () => {
        const deployment = resolve(DAYTIME)
        deployment.domainInfo.style = {
          margin: '2rem 0',
          padding: '10px',
          maxWidth: '640px',
        }
        notice = new Notice(deployment)
        const host = notice.build()

        expect(host.style.getPropertyValue('--dw-notice-margin')).toBe('2rem 0')
        expect(host.style.getPropertyValue('--dw-notice-padding')).toBe('10px')
        expect(host.style.getPropertyValue('--dw-notice-max-width')).toBe(
          '640px',
        )
      })

      it('sets nothing at all when the site has no overrides', () => {
        notice = new Notice(resolve(DAYTIME))
        expect(notice.build().getAttribute('style')).toBeNull()
      })

      it('ignores a value that is not a css length', () => {
        const deployment = resolve(DAYTIME)
        deployment.domainInfo.style = {
          margin: 'red; position: fixed',
          padding: 'url(https://example.com)',
        }
        notice = new Notice(deployment)
        const host = notice.build()

        expect(host.style.getPropertyValue('--dw-notice-margin')).toBe('')
        expect(host.style.getPropertyValue('--dw-notice-padding')).toBe('')
      })
    })

    describe('notes-only', () => {
      it('shows notes without any window or status', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const root = inside(notice.build())

        expect(root.querySelector('.name')?.textContent).toBe(
          'Notes only project',
        )
        expect(root.querySelector('.rows')).toBeNull()
        expect(root.querySelector('.pill')).toBeNull()
        expect(root.querySelector('.notes')?.textContent).toContain(
          'Frozen until Q3.',
        )
      })

      it('shows the notes immediately rather than behind a toggle', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const root = inside(notice.build())

        expect(root.querySelector('.details')).toHaveAttribute(
          'data-open',
          'true',
        )
        // Nothing to toggle: hiding the notes would leave an empty notice.
        expect(root.querySelector('.toggle')).toBeNull()
      })

      it('carries the notes tone', () => {
        notice = new Notice(resolve(NOTES_ONLY))
        const root = inside(notice.build())
        expect(root.querySelector('.notice')).toHaveAttribute(
          'data-status',
          'notes',
        )
      })
    })

    it('escapes a name containing markup', () => {
      const deployment = resolve(DAYTIME)
      deployment.name = '<img src=x onerror=alert(1)>'
      notice = new Notice(deployment)
      const root = inside(notice.build())

      expect(root.querySelector('img')).toBeNull()
      expect(root.querySelector('.name')?.textContent).not.toContain('<img')
    })

    it('does not emit a script tag from notes', () => {
      const deployment = resolve(DAYTIME)
      deployment.notes = '<script>alert(1)</script>'
      notice = new Notice(deployment)
      expect(inside(notice.build()).querySelector('script')).toBeNull()
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

      const clock = () => onPage().querySelector('.clock')?.textContent
      expect(clock()).toBe('12:00:00')

      // advanceTimersByTime moves the fake clock as well as firing the timer.
      vi.advanceTimersByTime(1000)
      expect(clock()).toBe('12:00:01')

      vi.advanceTimersByTime(1000)
      expect(clock()).toBe('12:00:02')
    })

    it('counts the window down as the clock moves', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T11:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      const countdown = () =>
        onPage().querySelector('.countdown')?.textContent
      expect(countdown()).toBe('Closes in 1h')

      vi.advanceTimersByTime(30 * 60 * 1000)
      expect(countdown()).toBe('Closes in 30m')

      // Past the close, and it turns round to the next opening.
      vi.advanceTimersByTime(31 * 60 * 1000)
      expect(countdown()).toBe('Opens in 15h 59m')
    })

    it('flips status and tone when the window closes', () => {
      // The fixture window is 09:00-17:00 Europe/London, which is 04:00-12:00
      // in the America/New_York timezone the tests are pinned to.
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T11:59:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      expect(onPage().querySelector('.notice')).toHaveAttribute(
        'data-status',
        'open',
      )

      vi.setSystemTime(new Date('2024-06-03T13:30:00'))
      vi.advanceTimersByTime(1000)

      expect(onPage().querySelector('.status-text')?.textContent).toBe(
        'Deployment window closed',
      )
      expect(onPage().querySelector('.notice')).toHaveAttribute(
        'data-status',
        'closed',
      )
      // Marked for the one animation that is not decoration: the moment the
      // window changed under you.
      expect(onPage().querySelector('.notice')).toHaveAttribute('data-flip')
    })

    it('marks nothing on a tick that changed nothing', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T11:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      vi.advanceTimersByTime(3000)

      expect(onPage().querySelector('.notice')).not.toHaveAttribute('data-flip')
    })

    it('does not let a crafted status string inject markup', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))
      vi.mocked(chrome.i18n.getMessage).mockReturnValue('<img src=x>')

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      vi.advanceTimersByTime(1000)

      expect(onPage().querySelector('.status-text img')).toBeNull()
      expect(onPage().querySelector('.status-text')?.textContent).toBe(
        '<img src=x>',
      )
    })
  })

  describe('icon updates', () => {
    it('sends the open icon while the window is open', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      expect(chromeMock().sentMessages).toEqual([{ icon: ICONS.open }])
    })

    it('sends the closed icon while the window is closed', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()

      expect(chromeMock().sentMessages).toEqual([{ icon: ICONS.closed }])
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

      const root = onPage()
      const toggle = root.querySelector<HTMLElement>('.toggle')!
      const details = root.querySelector<HTMLElement>('.details')!

      toggle.click()
      expect(details.dataset.open).toBe('true')
      expect(toggle.getAttribute('aria-expanded')).toBe('true')
      expect(toggle.textContent).toBe('Hide details')

      toggle.click()
      expect(details.dataset.open).toBe('false')
      expect(toggle.getAttribute('aria-expanded')).toBe('false')
      expect(toggle.textContent).toBe('Show details')
    })

    it('does not stack a second listener when re-inserted', () => {
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      // What a single page app does to us: the notice is torn out and put back.
      notice.element?.remove()
      notice.insert()

      const root = onPage()
      root.querySelector<HTMLElement>('.toggle')!.click()

      expect(root.querySelector<HTMLElement>('.details')?.dataset.open).toBe(
        'true',
      )
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

      const before = chromeMock().sentMessages.length
      vi.advanceTimersByTime(10_000)
      expect(chromeMock().sentMessages).toHaveLength(before)
    })
  })
})
