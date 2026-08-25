import { describe, expect, it } from 'vitest'

import { TextFormatter } from '../src/app/components/TextFormatter'

describe('TextFormatter', () => {
  describe('sanitize', () => {
    it('escapes the characters that could reopen markup', () => {
      expect(TextFormatter.sanitize(`<>'"`)).toBe('&lt;&gt;&#39;&#34;')
    })

    it('leaves ordinary text alone', () => {
      expect(TextFormatter.sanitize('release 1.2 (beta)')).toBe('release 1.2 (beta)')
    })

    it.each([null, undefined])('returns an empty string for %s', (value) => {
      expect(TextFormatter.sanitize(value)).toBe('')
    })
  })

  describe('toPlainText', () => {
  it('removes markup', () => {
    expect(TextFormatter.toPlainText('<b>bold</b> text')).toBe('bold text')
  })

  it('leaves quotes and brackets alone, unlike stripTags', () => {
    // React escapes its own text nodes; entities here would be shown as typed.
    expect(TextFormatter.toPlainText('[data-testid="main"]')).toBe(
      '[data-testid="main"]',
    )
    expect(TextFormatter.toPlainText("Eli's project")).toBe("Eli's project")
  })

  it('handles null and undefined', () => {
    expect(TextFormatter.toPlainText(null)).toBe('')
    expect(TextFormatter.toPlainText(undefined)).toBe('')
  })
})

describe('stripTags', () => {
    it('removes tags and keeps their text content', () => {
      expect(TextFormatter.stripTags('<b>bold</b>')).toBe('bold')
    })

    it('neutralises a script tag entirely', () => {
      const result = TextFormatter.stripTags('<script>alert(1)</script>')
      expect(result).not.toContain('<script>')
      expect(result).toBe('alert(1)')
    })

    it('escapes a broken tag that survives stripping', () => {
      // The tag regex needs a closing '>', so an unterminated tag remains and
      // must still be escaped rather than passed through.
      expect(TextFormatter.stripTags('<img src=x onerror=alert(1)')).toBe(
        '&lt;img src=x onerror=alert(1)',
      )
    })

    it.each([null, undefined])('returns an empty string for %s', (value) => {
      expect(TextFormatter.stripTags(value)).toBe('')
    })
  })
})
