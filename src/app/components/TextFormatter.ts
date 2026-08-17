import MarkdownIt from 'markdown-it'

// markdown-it is stateless for our purposes, so one instance is enough. v1 built
// a new parser on every single render.
const md = new MarkdownIt()

export class TextFormatter {
  /** Strip any tags from a string, then escape what is left. */
  static stripTags(text: string | null | undefined): string {
    if (text === null || text === undefined) {
      return ''
    }
    return TextFormatter.sanitize(String(text).replace(/(<([^>]+)>)/gi, ''))
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

  /**
   * Render user notes as markdown.
   *
   * Input is stripped and escaped first, so the only HTML in the output is what
   * markdown-it itself generates.
   */
  static toMarkdown(text: string | null | undefined): string {
    if (!text) {
      return ''
    }
    return md.render(TextFormatter.stripTags(text))
  }

  /**
   * Render markdown that ships with the extension (e.g. the how-to document).
   *
   * Unlike {@link toMarkdown} the source is NOT stripped or escaped first, so
   * fenced code blocks and tables survive intact. Only ever pass bundled
   * content here - never anything a user supplied.
   */
  static renderTrustedMarkdown(text: string | null | undefined): string {
    if (!text) {
      return ''
    }
    return md.render(String(text))
  }
}
