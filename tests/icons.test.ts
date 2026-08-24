import { describe, expect, it } from 'vitest'

// @ts-expect-error - plain JS build script, no type declarations
import { GLYPHS as DRAWN, SIZES, svgFor } from '../scripts/icons.js'
import { GLYPHS, type GlyphName, glyphFor } from '../src/app/glyphs'
import { ICON_SIZES, ICON_STATES, iconPaths, isIconState } from '../src/app/icons'

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

    // Same reason as the marks: the renderer and the runtime keep separate
    // lists, so a size added to one and not the other would be a manifest
    // pointing at a file nobody drew.
    it('draws every size the extension claims', () => {
      expect(SIZES).toEqual([...ICON_SIZES])
    })
  })

  describe('icon paths', () => {
    it.each(ICON_STATES)('names a file per size for %s', (state) => {
      expect(iconPaths(state)).toEqual({
        16: `icons/${state}/icon16.png`,
        32: `icons/${state}/icon32.png`,
        48: `icons/${state}/icon48.png`,
        128: `icons/${state}/icon128.png`,
      })
    })

    it('renders artwork for every state the runtime can ask for', () => {
      expect([...ICON_STATES].sort()).toEqual(Object.keys(DRAWN).sort())
    })

    // The worker expands whatever it is given into paths, so anything that is
    // not a known state has to be turned away before it gets there.
    it.each([null, undefined, 42, '', 'open', '../../etc/passwd'])(
      'refuses %j as a state',
      (value) => {
        expect(isIconState(value)).toBe(false)
      },
    )
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
