import { Methods } from '../../app/components/Methods'
import { TextFormatter } from '../../app/components/TextFormatter'
import howToUseMarkdown from '../../documents/HowToUse.md?raw'
import Modal from './common/Modal'

/**
 * Renders the bundled how-to document.
 *
 * v1 relied on webpack's markdown-loader to convert this at build time; Vite's
 * `?raw` import keeps it as source and it is rendered here instead.
 */
export function HowToUse() {
  return (
    <div className="dw-prose dw-prose-doc">
      <div
        dangerouslySetInnerHTML={{
          __html: TextFormatter.renderTrustedMarkdown(howToUseMarkdown),
        }}
      />
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
