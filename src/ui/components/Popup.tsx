import { Component } from 'react'

import { DW } from '../../app/components/DW'
import { Methods } from '../../app/components/Methods'
import { TextFormatter } from '../../app/components/TextFormatter'
import type { ResolvedDeployment } from '../../app/config/types'

interface PopupState {
  loaded: boolean
  deployment: ResolvedDeployment | null
}

/**
 * The browser action popup. Resolves the active tab's URL against the config
 * and shows the same information the in-page notice does.
 */
export class Popup extends Component<Record<string, never>, PopupState> {
  private mounted = false

  override state: PopupState = { loaded: false, deployment: null }

  override async componentDidMount(): Promise<void> {
    this.mounted = true
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      })
      const dw = await DW.create(tab?.url ?? '')
      if (this.mounted) {
        this.setState({ loaded: true, deployment: dw.getDeploymentInfo() })
      }
    } catch {
      if (this.mounted) {
        this.setState({ loaded: true, deployment: null })
      }
    }
  }

  override componentWillUnmount(): void {
    this.mounted = false
  }

  private renderTable(data: ResolvedDeployment) {
    const { original, local } = data.timeObj
    const t = TextFormatter.stripTags

    return (
      <table>
        <tbody>
          <tr>
            <td>{Methods.i18n('l10nDeploymentWindow')}</td>
            <td>
              {t(original.start)} - {t(original.end)}
              <br />
              <small>({t(original.timezone)})</small>
            </td>
          </tr>
          <tr>
            <td>{Methods.i18n('l10nYourTimezone')}</td>
            <td>
              {t(local.start)} - {t(local.end)}
              <br />
              <small>({t(local.timezone)})</small>
            </td>
          </tr>
          <tr>
            <td>{Methods.i18n('l10nStatus')}</td>
            <td>
              <span className="status">{t(data.status)}</span>
            </td>
          </tr>
        </tbody>
      </table>
    )
  }

  private renderDeployment(data: ResolvedDeployment) {
    const hasNotes = data.notes.length > 0

    return (
      <div
        className={
          'popup-deployment-info ' +
          (data.canDeploy ? 'can-deploy' : 'can-not-deploy')
        }
      >
        <h1 className="popup-title">{TextFormatter.stripTags(data.name)}</h1>
        {!data.notesOnly && this.renderTable(data)}
        {!data.notesOnly && hasNotes && <hr />}
        {hasNotes && (
          <div className="notes-section">
            <h2>{Methods.i18n('l10nNotes')}</h2>
            <div
              dangerouslySetInnerHTML={{
                __html: TextFormatter.toMarkdown(data.notes),
              }}
            />
          </div>
        )}
      </div>
    )
  }

  override render() {
    const { loaded, deployment } = this.state

    return (
      <div className="dw-popup">
        {!loaded && (
          <div className="notice-message">{Methods.i18n('l10nLoading')}</div>
        )}
        {loaded && deployment && this.renderDeployment(deployment)}
        {loaded && !deployment && (
          <div className="notice-message">
            {Methods.i18n('l10nNoInformation')}
          </div>
        )}
      </div>
    )
  }
}

export default Popup
