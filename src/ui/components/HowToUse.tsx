import { Methods } from '../../app/components/Methods'
import howToUseMarkdown from '../../documents/HowToUse.md?raw'
import Modal from './common/Modal'
import { useMarkdown } from './common/useMarkdown'

/**
 * Renders the bundled how-to document.
 *
 * v1 relied on webpack's markdown-loader to convert this at build time; Vite's
 * `?raw` import keeps it as source and it is rendered here instead.
 */
export function HowToUse() {
  const html = useMarkdown(howToUseMarkdown, true)

  return (
    <div className="dw-prose dw-prose-doc">
      {html === null ? (
        <p className="dw-loading">{Methods.i18n('l10nLoading')}</p>
      ) : (
        <div dangerouslySetInnerHTML={{ __html: html }} />
      )}
    </div>
  )
}

/**
 * The same document as an overlay.
 *
 * It used to be a tab, which put reference material on the same footing as the
 * config itself. Now that every field carries its own hint the document is
 * background reading, so it lives behind a link in the header instead.
 */
export function HowToUseDialog({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title={Methods.i18n('l10nHowToUse')}
      description={Methods.i18n('l10nHowToUseSubtitle')}
      onClose={onClose}
      size="wide"
      footer={
        <button
          type="button"
          className="dw-button dw-button-primary"
          onClick={onClose}
        >
          {Methods.i18n('l10nClose')}
        </button>
      }
    >
      <HowToUse />
    </Modal>
  )
}

export default HowToUse
