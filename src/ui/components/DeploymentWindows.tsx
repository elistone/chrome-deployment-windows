import { Component } from 'react'

import { Methods } from '../../app/components/Methods'
import { TextFormatter } from '../../app/components/TextFormatter'
import type { DeploymentConfig } from '../../app/config/types'

interface DeploymentWindowsProps {
  domains: Record<string, string[]>
  deployments: Record<string, DeploymentConfig>
}

/** Read-only table of every configured deployment window. */
export class DeploymentWindows extends Component<DeploymentWindowsProps> {
  private renderDomainCells(deploymentKey: string) {
    const deployment = this.props.deployments[deploymentKey]

    return Object.keys(this.props.domains ?? {}).map((domainKey) => {
      const value = deployment?.[domainKey]
      return (
        <td key={domainKey}>
          {typeof value === 'string' && value
            ? TextFormatter.stripTags(value)
            : '-'}
        </td>
      )
    })
  }

  private renderRow(key: string) {
    const deployment = this.props.deployments[key]
    const time = deployment.time

    const bool = (value: unknown) =>
      value === true ? Methods.i18n('l10nTrue') : Methods.i18n('l10nFalse')

    const name = deployment.name || Methods.i18n('l10nNoName')
    const notes = deployment.notes || Methods.i18n('l10nNoNotes')
    const start = time?.start || Methods.i18n('l10nNoTimeStart')
    const end = time?.end || Methods.i18n('l10nNoTimeEnd')
    const timezone = time?.timezone || Methods.i18n('l10nNoTimeTimezone')

    return (
      <tr key={key}>
        <td>{TextFormatter.stripTags(name)}</td>
        <td>
          {TextFormatter.stripTags(start)} - {TextFormatter.stripTags(end)} (
          {TextFormatter.stripTags(timezone)})
        </td>
        <td>{bool(deployment['notes-only'])}</td>
        <td
          dangerouslySetInnerHTML={{
            __html: TextFormatter.toMarkdown(notes),
          }}
        />
        {this.renderDomainCells(key)}
        <td>{bool(deployment['case-sensitive'])}</td>
      </tr>
    )
  }

  override render() {
    const keys = Object.keys(this.props.deployments ?? {})

    return (
      <div className="content-wrapper content-deployment-window">
        <div className="flex-row">
          <div className="flex-col">
            <h2>{Methods.i18n('l10nDeploymentWindows')}</h2>
          </div>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>{Methods.i18n('l10nName')}</th>
              <th>{Methods.i18n('l10nDeploymentWindow')}</th>
              <th>{Methods.i18n('l10nNotesOnly')}</th>
              <th>{Methods.i18n('l10nNotes')}</th>
              {Object.keys(this.props.domains ?? {}).map((key) => (
                <th key={key}>{key} (url key)</th>
              ))}
              <th>{Methods.i18n('l10nCaseSensitive')}</th>
            </tr>
          </thead>
          <tbody>{keys.map((key) => this.renderRow(key))}</tbody>
        </table>
        {keys.length === 0 && <p>{Methods.i18n('l10nNoInformationSet')}</p>}
      </div>
    )
  }
}

export default DeploymentWindows
