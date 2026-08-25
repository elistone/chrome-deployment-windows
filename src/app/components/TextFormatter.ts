/**
 * Turning arbitrary strings into something safe to put on a page.
 *
 * Deliberately free of dependencies: the content script needs all three of
 * these on every page it touches, and markdown rendering - which is not free -
 * lives in Markdown.ts behind a dynamic import.
 */
export class TextFormatter {
  /** Strip any tags from a string, then escape what is left. */
  static stripTags(text: string | null | undefined): string {
    return TextFormatter.sanitize(TextFormatter.toPlainText(text))
  }

  /**
   * Remove any markup, leaving the text.
   *
   * For React children, which escape themselves. Unlike {@link stripTags} this
   * leaves quotes and angle brackets alone, because the entities that one
   * produces are meant for innerHTML - put through a React text node they are
   * shown literally, and `[data-testid="main"]` reads back as
   * `[data-testid=&#34;main&#34;]`.
   */
  static toPlainText(text: string | null | undefined): string {
    if (text === null || text === undefined) {
      return ''
    }
    return String(text).replace(/(<([^>]+)>)/gi, '')
  }

  /** Escape the characters that could otherwise re-introduce markup. */
  static sanitize(text: string | null | undefined): string {
    if (text === null || text === undefined) {
      return ''
    }
    return String(text)
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/'/g, '&#39;')
      .replace(/"/g, '&#34;')
  }
}
