import { describe, expect, it } from 'vitest'

import {
  renderNotes,
  renderTrustedMarkdown,
} from '../src/app/components/Markdown'

/**
 * markdown-it is behind a dynamic import, so every one of these awaits the
 * chunk. The first test in the file pays for the load; the rest share it.
 */
describe('Markdown', () => {
  describe('renderNotes', () => {
    it('renders basic markdown', async () => {
      expect(await renderNotes('**bold**')).toContain('<strong>bold</strong>')
    })

    it('renders lists', async () => {
      const html = await renderNotes('- one\n- two')
      expect(html).toContain('<ul>')
      expect(html).toContain('<li>one</li>')
    })

    it('renders links', async () => {
      expect(await renderNotes('[docs](https://example.com)')).toContain(
        'href="https://example.com"',
      )
    })

    it('does not emit raw html supplied by the user', async () => {
      const html = await renderNotes('<script>alert(1)</script>')
      expect(html).not.toContain('<script>')
    })

    it('does not emit an event handler attribute from user input', async () => {
      const html = await renderNotes('<img src=x onerror="alert(1)">')
      expect(html).not.toMatch(/<img[^>]*onerror/i)
    })

    it('returns an empty string for empty input', async () => {
      expect(await renderNotes('')).toBe('')
      expect(await renderNotes(null)).toBe('')
      expect(await renderNotes(undefined)).toBe('')
    })
  })

  describe('renderTrustedMarkdown', () => {
    it('preserves quotes inside fenced code blocks', async () => {
      const html = await renderTrustedMarkdown(
        '```json\n{"a": 1}\n```',
      )
      // The escaped-then-rendered path would leave a literal &#34; here.
      expect(html).toContain('&quot;a&quot;')
      expect(html).not.toContain('&amp;#34;')
    })

    it('renders tables, which the how-to document relies on', async () => {
      const html = await renderTrustedMarkdown(
        'a | b\n--- | ---\n1 | 2',
      )
      expect(html).toContain('<table>')
      expect(html).toContain('<td>1</td>')
    })

    it('returns an empty string for empty input', async () => {
      expect(await renderTrustedMarkdown('')).toBe('')
    })
  })
})
