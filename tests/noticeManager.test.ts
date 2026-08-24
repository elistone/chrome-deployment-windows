import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { Config } from '../src/app/config/Config'
import { NoticeManager } from '../src/app/components/NoticeManager'
import { renderGithubPage, testConfig } from './helpers/fixtures'

const DAYTIME = 'https://github.com/acme/daytime'
const NOTES_ONLY = 'https://github.com/acme/notes-only'
const UNKNOWN = 'https://github.com/acme/nothing-here'

/**
 * The manager reacts to mutations through a MutationObserver, which jsdom
 * delivers on a microtask, and then debounces. Waiting on both is what a test
 * has to do to see the result.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250))
}

function notice(): HTMLElement | null {
  return document.querySelector('.dw-notification')
}

/** The notice draws inside a shadow root, so its text is not in the page. */
function noticeText(): string {
  return notice()?.shadowRoot?.textContent ?? ''
}

describe('NoticeManager', () => {
  let manager: NoticeManager | null = null
  let url = DAYTIME

  beforeEach(async () => {
    await Config.save(testConfig())
    renderGithubPage()
    url = DAYTIME
  })

  afterEach(() => {
    manager?.stop()
    manager = null
    document.body.innerHTML = ''
  })

  async function start(): Promise<NoticeManager> {
    manager = new NoticeManager({
      currentUrl: () => url,
      root: document.body,
    })
    await manager.start()
    return manager
  }

  it('inserts the notice for the current url', async () => {
    await start()

    expect(notice()).not.toBeNull()
    expect(noticeText()).toContain('Daytime project')
  })

  it('inserts nothing when no deployment matches', async () => {
    url = UNKNOWN
    await start()

    expect(notice()).toBeNull()
  })

  it('puts the notice back when the page tears it out', async () => {
    await start()
    expect(notice()).not.toBeNull()

    // What a turbo frame swap does: the region holding the notice is replaced
    // wholesale, taking the notice with it.
    renderGithubPage()
    expect(notice()).toBeNull()

    await settle()

    expect(notice()).not.toBeNull()
    expect(noticeText()).toContain('Daytime project')
  })

  it('swaps the notice when an in-app navigation changes the project', async () => {
    await start()
    expect(noticeText()).toContain('Daytime project')

    url = NOTES_ONLY
    renderGithubPage()
    await settle()

    expect(noticeText()).toContain('Notes only project')
    expect(document.querySelectorAll('.dw-notification')).toHaveLength(1)
  })

  it('removes the notice when an in-app navigation leaves the project', async () => {
    await start()
    expect(notice()).not.toBeNull()

    url = UNKNOWN
    renderGithubPage()
    await settle()

    expect(notice()).toBeNull()
  })

  it('keeps the same notice across a navigation within one project', async () => {
    await start()
    const first = notice()

    url = `${DAYTIME}/pulls`
    renderGithubPage()
    await settle()

    expect(notice()).toBe(first)
  })

  it('re-checks on a history move', async () => {
    await start()

    url = UNKNOWN
    window.dispatchEvent(new PopStateEvent('popstate'))
    await settle()

    expect(notice()).toBeNull()
  })

  it('never leaves a second notice behind, however often it is nudged', async () => {
    await start()

    for (let index = 0; index < 5; index += 1) {
      renderGithubPage()
      await settle()
    }

    expect(document.querySelectorAll('.dw-notification')).toHaveLength(1)
  })

  it('moves to the preferred anchor once the page renders it', async () => {
    // Only the fallback anchor exists at first, which is what a content swap
    // caught mid-flight looks like.
    document.body.innerHTML =
      '<div id="page"><div class="repository-content">content</div></div>'
    await start()

    const placed = notice()
    expect(placed?.nextElementSibling?.className).toBe('repository-content')

    const page = document.getElementById('page')!
    const nav = document.createElement('div')
    nav.className = 'file-navigation'
    page.prepend(nav)
    await settle()

    // The same element, moved rather than duplicated.
    expect(notice()).toBe(placed)
    expect(document.querySelectorAll('.dw-notification')).toHaveLength(1)
    expect(notice()?.previousElementSibling?.className).toBe('file-navigation')
  })

  it('stops watching once stopped', async () => {
    const running = await start()
    running.stop()
    manager = null

    renderGithubPage()
    await settle()

    expect(notice()).toBeNull()
  })

  describe('following config changes', () => {
    it('picks up an edit made while the page is open', async () => {
      await start()
      expect(noticeText()).toContain('Daytime project')

      const config = testConfig()
      config.deployments.daytime.name = 'Renamed by the popup'
      await Config.save(config)
      await settle()

      // No navigation and no DOM change - only storage moved - so without the
      // storage listener this would still say the old name.
      expect(noticeText()).toContain('Renamed by the popup')
    })

    it('takes the notice away when its deployment is deleted', async () => {
      await start()
      expect(notice()).not.toBeNull()

      const config = testConfig()
      delete config.deployments.daytime
      await Config.save(config)
      await settle()

      expect(notice()).toBeNull()
    })

    it('puts a notice up when one starts matching', async () => {
      url = UNKNOWN
      await start()
      expect(notice()).toBeNull()

      const config = testConfig()
      config.deployments.added = {
        name: 'Newly added',
        github: 'acme/nothing-here',
        time: { start: '09:00', end: '17:00', timezone: 'Europe/London' },
      }
      await Config.save(config)
      await settle()

      expect(noticeText()).toContain('Newly added')
    })

    it('stops listening once it is stopped', async () => {
      const started = await start()
      started.stop()
      manager = null

      const config = testConfig()
      config.deployments.daytime.name = 'Should not appear'
      await Config.save(config)
      await settle()

      expect(document.querySelector('.dw-notification')).toBeNull()
    })
  })
})
