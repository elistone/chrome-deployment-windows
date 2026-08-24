import { beforeEach, describe, expect, it, vi } from 'vitest'

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
