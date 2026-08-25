import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/dom'

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

/**
 * Wait for the notes to be rendered.
 *
 * markdown-it is behind a dynamic import, so notes arrive a tick after whatever
 * asked for them - inserting a notes-only entry, or opening the details.
 */
async function notes(root: ShadowRoot): Promise<Element> {
  return waitFor(() => {
    const body = root.querySelector('.notes-body')
    if (!body?.innerHTML) {
      throw new Error('notes not rendered yet')
    }
    return body
  })
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

    it('keeps the notes shut, and unrendered, until they are asked for', () => {
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())

      expect(root.querySelector('.toggle')?.textContent).toBe('Show details')
      expect(root.querySelector('.details')).toHaveAttribute(
        'data-open',
        'false',
      )
      // Nothing has asked to see them, so the parser has not been fetched.
      expect(root.querySelector('.notes-body')?.innerHTML).toBe('')
    })

    it('renders notes as markdown once the details are opened', async () => {
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const root = onPage()

      root.querySelector<HTMLElement>('.toggle')?.click()

      // The markdown '**two**' inside the notes body, not the "Notes" heading.
      const body = await notes(root)
      expect(body.querySelector('strong')?.textContent).toBe('two')
      expect(root.querySelector('.details')).toHaveAttribute('data-open', 'true')
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
      it('shows notes without any window or status', async () => {
        notice = new Notice(resolve(NOTES_ONLY))
        notice.insert()
        const root = onPage()

        expect(root.querySelector('.name')?.textContent).toBe(
          'Notes only project',
        )
        expect(root.querySelector('.rows')).toBeNull()
        expect(root.querySelector('.pill')).toBeNull()
        // Nothing to click, so these are fetched and rendered on insert.
        expect((await notes(root)).textContent).toContain('Frozen until Q3.')
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

  describe('being someone else\'s guest', () => {
    it('is a region a screen reader can find and skip', () => {
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())
      const card = root.querySelector('.notice')

      // It arrives uninvited on a page, so it has to be something that can be
      // navigated to deliberately - and past.
      expect(card).toHaveAttribute('role', 'region')

      const labelledBy = card?.getAttribute('aria-labelledby')
      expect(labelledBy).toBeTruthy()
      expect(root.getElementById(labelledBy!)?.textContent).toBe(
        'Daytime project',
      )
    })

    it('announces the status politely rather than not at all', () => {
      notice = new Notice(resolve(DAYTIME))
      const root = inside(notice.build())

      expect(root.querySelector('.status-text')).toHaveAttribute(
        'role',
        'status',
      )
    })

    it('does not re-announce a status that has not changed', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const root = onPage()
      const status = root.querySelector('.status-text')!

      const mutations: MutationRecord[] = []
      const observer = new MutationObserver((records) => {
        mutations.push(...records)
      })
      observer.observe(status, { childList: true, characterData: true, subtree: true })

      // The clock ticks every second. Writing the same sentence back each time
      // would have a screen reader say "deployment window open" once a second,
      // all day, because it is a live region.
      notice.realTime()
      notice.realTime()
      notice.realTime()
      await Promise.resolve()

      expect(mutations).toHaveLength(0)
      expect(status.textContent).toBe('Deployment window open')

      observer.disconnect()
      vi.useRealTimers()
    })

    it('does announce when the window actually closes', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const root = onPage()
      const status = root.querySelector('.status-text')!
      expect(status.textContent).toBe('Deployment window open')

      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice.realTime()

      expect(status.textContent).toBe('Deployment window closed')
      vi.useRealTimers()
    })
  })

  describe('dismissing', () => {
    function dismissButton(root: ShadowRoot): HTMLElement {
      const button = root.querySelector<HTMLElement>('.close')
      if (!button) {
        throw new Error('the notice has no dismiss control')
      }
      return button
    }

    it('puts the notice away without taking it off the page', () => {
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const host = document.querySelector<HTMLElement>('.dw-notification')!

      dismissButton(onPage()).click()

      expect(notice.isDismissed()).toBe(true)
      expect(host.dataset.dismissed).toBe('')
      // Still there, still ticking - hiding it must not stop the toolbar icon
      // and the status from keeping up.
      expect(host.isConnected).toBe(true)
    })

    it('keeps updating the toolbar icon while it is hidden', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      dismissButton(onPage()).click()
      chromeMock().sentMessages.length = 0

      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice.realTime()

      expect(chromeMock().sentMessages).toEqual([{ icon: ICONS.closed }])
      vi.useRealTimers()
    })

    it('comes back when the window opens or closes', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const host = document.querySelector<HTMLElement>('.dw-notification')!
      dismissButton(onPage()).click()
      expect(host.dataset.dismissed).toBe('')

      // Whatever was true when it was waved away is not true any more.
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice.realTime()

      expect(notice.isDismissed()).toBe(false)
      expect(host.dataset.dismissed).toBeUndefined()
      vi.useRealTimers()
    })

    it('stays put while the status is unchanged', () => {
      vi.useFakeTimers()
      // Tests run in America/New_York, where the configured London window is
      // 04:00-12:00. Both of these times are inside it, so nothing changes.
      vi.setSystemTime(new Date('2024-06-03T10:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const host = document.querySelector<HTMLElement>('.dw-notification')!
      dismissButton(onPage()).click()

      vi.setSystemTime(new Date('2024-06-03T11:00:00'))
      notice.realTime()

      expect(host.dataset.dismissed).toBe('')
      expect(notice.isDismissed()).toBe(true)
      vi.useRealTimers()
    })

    it('folds the space up instead of dropping it', () => {
      vi.useFakeTimers()
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const host = document.querySelector<HTMLElement>('.dw-notification')!

      dismissButton(onPage()).click()

      // Mid-flight: still laid out, but on its way to nothing. Going straight
      // to display:none would take the card's height out from under the page
      // in one frame.
      expect(host.dataset.dismissing).toBe('')
      expect(host.style.height).toBe('0px')

      vi.advanceTimersByTime(300)

      // Landed: the inline height goes with the animation that needed it.
      expect(host.dataset.dismissing).toBeUndefined()
      expect(host.style.height).toBe('')
      expect(host.dataset.dismissed).toBe('')
      vi.useRealTimers()
    })

    it('does not leave the notice mid-animation when it comes back', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-06-03T12:00:00'))

      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      const host = document.querySelector<HTMLElement>('.dw-notification')!
      dismissButton(onPage()).click()

      // The window closes while the card is still folding away.
      vi.setSystemTime(new Date('2024-06-03T22:00:00'))
      notice.realTime()

      expect(host.dataset.dismissing).toBeUndefined()
      expect(host.dataset.dismissed).toBeUndefined()
      expect(host.style.height).toBe('')

      // And the timer that would have hidden it does not fire late.
      vi.advanceTimersByTime(300)
      expect(host.dataset.dismissed).toBeUndefined()
      vi.useRealTimers()
    })

    it('leaves no timer running once the notice is gone', () => {
      vi.useFakeTimers()
      notice = new Notice(resolve(DAYTIME))
      notice.insert()
      dismissButton(onPage()).click()

      notice.destroy()
      notice = null

      expect(vi.getTimerCount()).toBe(0)
      vi.useRealTimers()
    })

    it('says how long it will last, rather than leaving it to be guessed', () => {
      notice = new Notice(resolve(DAYTIME))
      const button = dismissButton(inside(notice.build()))

      expect(button).toHaveAttribute('aria-label', 'Hide this notice')
      expect(button.getAttribute('title')).toContain('until you reload')
    })

    it('is offered on a notes-only entry too', () => {
      notice = new Notice(resolve(NOTES_ONLY))
      expect(dismissButton(inside(notice.build()))).toBeTruthy()
    })
  })
})
