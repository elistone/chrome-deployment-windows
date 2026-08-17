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

  describe('updateText', () => {
    it('replaces the element text', () => {
      document.body.innerHTML = '<span class="t">old</span>'
      expect(Methods.updateText('new', 't')).toBe(true)
      expect(document.querySelector('.t')?.textContent).toBe('new')
    })

    it('does not interpret the value as html', () => {
      document.body.innerHTML = '<span class="t">old</span>'
      Methods.updateText('<b>bold</b>', 't')

      expect(document.querySelector('.t b')).toBeNull()
      expect(document.querySelector('.t')?.textContent).toBe('<b>bold</b>')
    })

    it('reports failure when the target is absent', () => {
      expect(Methods.updateText('new', 'missing')).toBe(false)
    })
  })

  describe('updateClassName', () => {
    it('replaces the class list wholesale', () => {
      document.body.innerHTML = '<div class="a b">x</div>'
      expect(Methods.updateClassName('c d', 'a')).toBe(true)
      expect(document.querySelector('div')?.className).toBe('c d')
    })

    it('reports failure when the target is absent', () => {
      expect(Methods.updateClassName('c', 'missing')).toBe(false)
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

    it('returns an empty string for an unknown key', () => {
      expect(Methods.i18n('nope')).toBe('')
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
