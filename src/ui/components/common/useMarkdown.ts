import { useEffect, useState } from 'react'

import {
  renderNotes,
  renderTrustedMarkdown,
} from '../../../app/components/Markdown'

/**
 * Rendered markdown, once the renderer has loaded.
 *
 * Returns null on the first pass rather than the unrendered source: showing
 * `**two**` for a frame and then correcting it is worse than showing nothing
 * for a frame. The import is of a chunk already inside the extension, so that
 * frame is the only one.
 *
 * `trusted` selects the renderer that does not strip and escape first. It is
 * only ever right for markdown that ships with the extension.
 */
export function useMarkdown(
  text: string | null | undefined,
  trusted = false,
): string | null {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const render = trusted ? renderTrustedMarkdown : renderNotes

    void render(text)
      .then((rendered) => {
        if (active) {
          setHtml(rendered)
        }
      })
      .catch(() => {
        // The chunk failing to load leaves the notes unrendered rather than
        // taking the surrounding panel down with them.
        if (active) {
          setHtml('')
        }
      })

    return () => {
      active = false
    }
  }, [text, trusted])

  return html
}

export default useMarkdown
