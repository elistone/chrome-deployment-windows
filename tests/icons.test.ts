import { describe, expect, it } from 'vitest'

// @ts-expect-error - plain JS build script, no type declarations
import { GLYPHS as DRAWN, SIZES, svgFor } from '../scripts/icons.js'
import { GLYPHS, type GlyphName, glyphFor } from '../src/app/glyphs'

/**
 * Which icon state carries which mark. The icons are named for what the toolbar
 * shows; the interface names them for what they mean.
 */
const PAIRS: [string, GlyphName][] = [
  ['default', 'neutral'],
  ['success', 'open'],
  ['error', 'closed'],
]

describe('status glyphs', () => {
  describe('shared geometry', () => {
    // scripts/icons.js has to run as plain JavaScript outside the bundle, so it
    // cannot import src/app/glyphs.ts and keeps its own copy. The whole point
    // of the marks is that the one in the toolbar is the one in the notice, so
    // the two drifting apart would quietly undo it.
    it.each(PAIRS)('draws the same %s mark as the interface', (state, name) => {
      expect(DRAWN[state]).toEqual(GLYPHS[name])
    })

    it.each(PAIRS)('puts that mark in the %s icon', (state) => {
      const svg = svgFor(state)
      expect(svg).toContain(`d="${DRAWN[state].d}"`)
      expect(svg).toContain(`stroke-width="${DRAWN[state].width}"`)
      expect(svg).toContain('viewBox="0 0 128 128"')
    })

    it('draws every size Chrome is told about', () => {
      expect(SIZES).toEqual([16, 48, 128])
    })
  })

  describe('glyphFor', () => {
    it('gives each window state its own mark', () => {
      expect(glyphFor('open')).toBe('open')
      expect(glyphFor('closed')).toBe('closed')
    })

    it('falls back to the neutral mark for everything else', () => {
      // Notes-only and no-window-set are not states of a window, so neither
      // gets to borrow the answer to "can I deploy".
      expect(glyphFor('notes')).toBe('neutral')
      expect(glyphFor('unset')).toBe('neutral')
      expect(glyphFor('')).toBe('neutral')
    })
  })
})
