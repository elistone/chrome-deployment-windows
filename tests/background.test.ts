import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { chromeMock } from './helpers/chromeMock'

type Listener = (
  message: unknown,
  sender: chrome.runtime.MessageSender,
  sendResponse: (response: unknown) => void,
) => boolean

/**
 * Import the worker fresh and hand back the listener it registered, so each
 * test exercises a cold service worker start.
 */
async function loadWorker(): Promise<Listener> {
  vi.resetModules()
  await import('../src/app/background')
  const addListener = vi.mocked(chrome.runtime.onMessage.addListener)
  expect(addListener).toHaveBeenCalledTimes(1)
  return addListener.mock.calls[0][0] as unknown as Listener
}

const senderWithTab = { tab: { id: 7 } } as chrome.runtime.MessageSender

describe('background service worker', () => {
  let listener: Listener

  beforeEach(async () => {
    listener = await loadWorker()
  })

  it('registers a single onMessage listener', () => {
    expect(chrome.runtime.onMessage.addListener).toHaveBeenCalledTimes(1)
  })

  it('sets the icon for the sending tab', async () => {
    const sendResponse = vi.fn()
    const keepChannelOpen = listener(
      { icon: 'success' },
      senderWithTab,
      sendResponse,
    )

    // Must return true so the channel stays open for the async setIcon.
    expect(keepChannelOpen).toBe(true)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())

    // Every size, not just one for Chrome to scale down.
    expect(chromeMock().setIcons).toEqual([
      {
        path: {
          16: 'icons/success/icon16.png',
          32: 'icons/success/icon32.png',
          48: 'icons/success/icon48.png',
          128: 'icons/success/icon128.png',
        },
        tabId: 7,
      },
    ])
    expect(sendResponse).toHaveBeenCalledWith({ error: false })
  })

  it('rejects a message without an icon state', () => {
    const sendResponse = vi.fn()
    const result = listener({ somethingElse: true }, senderWithTab, sendResponse)

    expect(result).toBe(false)
    expect(sendResponse).toHaveBeenCalledWith({
      error: true,
      reason: 'unknown message',
    })
    expect(chromeMock().setIcons).toHaveLength(0)
  })

  it.each([null, undefined, 'string', 42])(
    'rejects non-object message %j',
    (message) => {
      const sendResponse = vi.fn()
      expect(listener(message, senderWithTab, sendResponse)).toBe(false)
      expect(sendResponse).toHaveBeenCalledWith({
        error: true,
        reason: 'unknown message',
      })
    },
  )

  it('rejects a message with no sender tab', () => {
    const sendResponse = vi.fn()
    const result = listener(
      { icon: 'error' },
      {} as chrome.runtime.MessageSender,
      sendResponse,
    )

    expect(result).toBe(false)
    expect(sendResponse).toHaveBeenCalledWith({
      error: true,
      reason: 'no sender tab',
    })
    expect(chromeMock().setIcons).toHaveLength(0)
  })

  it('reports a setIcon failure back to the caller', async () => {
    vi.mocked(chrome.action.setIcon).mockRejectedValue(new Error('tab gone'))
    const sendResponse = vi.fn()

    listener({ icon: 'error' }, senderWithTab, sendResponse)

    await vi.waitFor(() => expect(sendResponse).toHaveBeenCalled())
    expect(sendResponse).toHaveBeenCalledWith({
      error: true,
      reason: expect.stringContaining('tab gone'),
    })
  })
})

describe('shared config refresh', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () =>
          JSON.stringify({ domains: {}, sites: {}, deployments: {} }),
      })),
    )
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  /** Every listener the worker registers on a cold start. */
  async function loadListeners() {
    vi.resetModules()
    await import('../src/app/background')
    return {
      installed: vi.mocked(chrome.runtime.onInstalled.addListener).mock
        .calls[0][0] as () => void,
      startup: vi.mocked(chrome.runtime.onStartup.addListener).mock
        .calls[0][0] as () => void,
      alarm: vi.mocked(chrome.alarms.onAlarm.addListener).mock
        .calls[0][0] as (alarm: chrome.alarms.Alarm) => void,
    }
  }

  it('schedules a recurring refresh on install', async () => {
    const { installed } = await loadListeners()
    installed()

    await vi.waitFor(() =>
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        'refresh-remote-config',
        { periodInMinutes: 60 },
      ),
    )
  })

  it('schedules it again on browser startup', async () => {
    // An alarm can be lost to an update, so re-creating it is what repairs it.
    const { startup } = await loadListeners()
    startup()

    await vi.waitFor(() => expect(chrome.alarms.create).toHaveBeenCalled())
  })

  it('fetches when its own alarm fires', async () => {
    await chrome.storage.sync.set({ REMOTE_URL: 'https://example.com/a.json' })
    const { alarm } = await loadListeners()

    alarm({ name: 'refresh-remote-config' } as chrome.alarms.Alarm)

    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
  })

  it('ignores an alarm belonging to something else', async () => {
    await chrome.storage.sync.set({ REMOTE_URL: 'https://example.com/a.json' })
    const { alarm } = await loadListeners()

    alarm({ name: 'someone-elses-alarm' } as chrome.alarms.Alarm)

    await Promise.resolve()
    expect(fetch).not.toHaveBeenCalled()
  })
})
