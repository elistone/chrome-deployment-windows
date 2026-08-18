import { afterEach, describe, expect, it, vi } from 'vitest'

import { Methods } from '../src/app/components/Methods'
import { chromeMock } from './helpers/chromeMock'

describe('Methods', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  describe('findClass', () => {
    it('returns the first element with the class', () => {
      document.body.innerHTML = '<p class="x">one</p><p class="x">two</p>'
      expect(Methods.findClass('x')?.textContent).toBe('one')
    })

    it('returns null when nothing matches', () => {
      expect(Methods.findClass('missing')).toBeNull()
    })
  })

  describe('insertBefore / insertAfter', () => {
    it('inserts before the reference element', () => {
      document.body.innerHTML = '<div id="wrap"><p class="anchor">a</p></div>'
      const node = document.createElement('span')

      expect(Methods.insertBefore(node, 'anchor')).toBe(true)
      expect(document.querySelector('.anchor')?.previousElementSibling).toBe(node)
    })

    it('inserts after the reference element', () => {
      document.body.innerHTML = '<div id="wrap"><p class="anchor">a</p></div>'
      const node = document.createElement('span')

      expect(Methods.insertAfter(node, 'anchor')).toBe(true)
      expect(document.querySelector('.anchor')?.nextElementSibling).toBe(node)
    })

    it('reports failure when the reference is absent', () => {
      const node = document.createElement('span')
      expect(Methods.insertBefore(node, 'nope')).toBe(false)
      expect(Methods.insertAfter(node, 'nope')).toBe(false)
      expect(node.parentNode).toBeNull()
    })
  })

  describe('isHidden', () => {
    it('detects display none', () => {
      document.body.innerHTML = '<div id="e" style="display:none">x</div>'
      expect(Methods.isHidden(document.getElementById('e')!)).toBe(true)
    })

    it('detects visibility hidden', () => {
      document.body.innerHTML = '<div id="e" style="visibility:hidden">x</div>'
      expect(Methods.isHidden(document.getElementById('e')!)).toBe(true)
    })

    it('reports a visible element as visible', () => {
      document.body.innerHTML = '<div id="e">x</div>'
      expect(Methods.isHidden(document.getElementById('e')!)).toBe(false)
    })
  })

  describe('i18n', () => {
    it('returns the message for a known key', () => {
      expect(Methods.i18n('l10nStatus')).toBe('Status')
    })

    it('falls back to a readable version of an unknown key', () => {
      // Every label in the UI comes through here, so an empty string turns a
      // stale message catalogue into a page of blank controls. Approximate
      // wording is recoverable; nothing at all is not.
      expect(Methods.i18n('l10nAddSomething')).toBe('Add something')
      expect(Methods.i18n('l10nNoWindowSetHere')).toBe('No window set here')
    })

    it('returns the key itself when there is nothing to humanise', () => {
      expect(Methods.i18n('l10n')).toBe('l10n')
    })

    it('survives chrome.i18n throwing after an extension reload', () => {
      vi.mocked(chrome.i18n.getMessage).mockImplementation(() => {
        throw new Error('context invalidated')
      })
      expect(Methods.i18n('l10nStatus')).toBe('Translation lost, please reload.')
    })

    it('survives chrome being torn down entirely', () => {
      const original = globalThis.chrome
      // @ts-expect-error - deliberately removing the API the guard protects against
      delete globalThis.chrome
      try {
        expect(Methods.i18n('l10nStatus')).toBe('Translation lost, please reload.')
      } finally {
        globalThis.chrome = original
      }
    })
  })

  describe('updateIcon', () => {
    it('messages the service worker with the icon path', () => {
      Methods.updateIcon('icons/success/icon48.png')
      expect(chromeMock().sentMessages).toEqual([
        { newIconPath: 'icons/success/icon48.png' },
      ])
    })

    it('swallows a rejected sendMessage', async () => {
      vi.mocked(chrome.runtime.sendMessage).mockRejectedValue(
        new Error('worker asleep'),
      )
      expect(() => Methods.updateIcon('icons/error/icon48.png')).not.toThrow()
      await Promise.resolve()
    })

    it('survives chrome being torn down entirely', () => {
      const original = globalThis.chrome
      // @ts-expect-error - deliberately removing the API the guard protects against
      delete globalThis.chrome
      try {
        expect(() => Methods.updateIcon('icons/error/icon48.png')).not.toThrow()
      } finally {
        globalThis.chrome = original
      }
    })
  })
})
