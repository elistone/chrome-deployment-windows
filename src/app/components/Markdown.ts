import { TextFormatter } from './TextFormatter'

/**
 * Markdown rendering, loaded only when there is markdown to render.
 *
 * markdown-it is by some distance the largest thing this extension ships, and
 * the content script runs on every page you visit - most of which have no
 * deployment configured at all, and most of the rest have no notes. Importing
 * it statically meant every one of those pages paid for a parser that would
 * never be asked to parse anything.
 *
 * So it is behind a dynamic import, and every caller is async. The extension
 * pages could have kept a synchronous path - they are not injected anywhere -
 * but two APIs for one job is how they drift, and the popup benefits too: it
 * opens without waiting for a parser it only needs if the entry has notes.
 *
 * The promise is cached rather than the module, so concurrent callers during
 * the first load share one import rather than racing.
 */

interface Renderer {
  render(source: string): string
}

let loading: Promise<Renderer> | null = null

function renderer(): Promise<Renderer> {
  loading ??= import('markdown-it').then(
    (module) => new module.default() as Renderer,
  )
  return loading
}

/**
 * Render user-supplied notes.
 *
 * The source is stripped and escaped first, so the only HTML in the output is
 * what markdown-it itself generated.
 */
export async function renderNotes(
  text: string | null | undefined,
): Promise<string> {
  if (!text) {
    return ''
  }
  return (await renderer()).render(TextFormatter.stripTags(text))
}

/**
 * Render markdown that ships with the extension, e.g. the how-to document.
 *
 * Unlike {@link renderNotes} the source is NOT stripped or escaped first, so
 * fenced code blocks and tables survive intact. Only ever pass bundled content
 * here - never anything a user supplied.
 */
export async function renderTrustedMarkdown(
  text: string | null | undefined,
): Promise<string> {
  if (!text) {
    return ''
  }
  return (await renderer()).render(String(text))
}
