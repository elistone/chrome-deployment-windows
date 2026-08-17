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

  describe('toMarkdown', () => {
    it('renders basic markdown', () => {
      expect(TextFormatter.toMarkdown('**bold**')).toContain('<strong>bold</strong>')
    })

    it('renders lists', () => {
      const html = TextFormatter.toMarkdown('- one\n- two')
      expect(html).toContain('<ul>')
      expect(html).toContain('<li>one</li>')
    })

    it('renders links', () => {
      expect(TextFormatter.toMarkdown('[docs](https://example.com)')).toContain(
        'href="https://example.com"',
      )
    })

    it('does not emit raw html supplied by the user', () => {
      const html = TextFormatter.toMarkdown('<script>alert(1)</script>')
      expect(html).not.toContain('<script>')
    })

    it('does not emit an event handler attribute from user input', () => {
      const html = TextFormatter.toMarkdown('<img src=x onerror="alert(1)">')
      expect(html).not.toMatch(/<img[^>]*onerror/i)
    })

    it('returns an empty string for empty input', () => {
      expect(TextFormatter.toMarkdown('')).toBe('')
      expect(TextFormatter.toMarkdown(null)).toBe('')
      expect(TextFormatter.toMarkdown(undefined)).toBe('')
    })
  })

  describe('renderTrustedMarkdown', () => {
    it('preserves quotes inside fenced code blocks', () => {
      const html = TextFormatter.renderTrustedMarkdown(
        '```json\n{"a": 1}\n```',
      )
      // The escaped-then-rendered path would leave a literal &#34; here.
      expect(html).toContain('&quot;a&quot;')
      expect(html).not.toContain('&amp;#34;')
    })

    it('renders tables, which the how-to document relies on', () => {
      const html = TextFormatter.renderTrustedMarkdown(
        'a | b\n--- | ---\n1 | 2',
      )
      expect(html).toContain('<table>')
      expect(html).toContain('<td>1</td>')
    })

    it('returns an empty string for empty input', () => {
      expect(TextFormatter.renderTrustedMarkdown('')).toBe('')
    })
  })
})
