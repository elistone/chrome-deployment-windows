import { Component } from 'react'

import { TextFormatter } from '../../app/components/TextFormatter'
import howToUseMarkdown from '../../documents/HowToUse.md?raw'

/**
 * Renders the bundled how-to document.
 *
 * v1 relied on webpack's markdown-loader to convert this at build time; Vite's
 * `?raw` import keeps it as source and it is rendered here instead.
 */
export class HowToUse extends Component {
  override render() {
    return (
      <div className="content-wrapper content-how-to-use">
        <div
          dangerouslySetInnerHTML={{
            __html: TextFormatter.renderTrustedMarkdown(howToUseMarkdown),
          }}
        />
      </div>
    )
  }
}

export default HowToUse
