import { Component } from 'react'

import { Methods } from '../../app/components/Methods'
import { TextFormatter } from '../../app/components/TextFormatter'
import type { SiteConfig } from '../../app/config/types'

interface SiteInformationProps {
  domains: Record<string, string[]>
  details: Record<string, SiteConfig>
}

/** Read-only summary of the domains and where the notice gets injected. */
export class SiteInformation extends Component<SiteInformationProps> {
  private renderSite(key: string) {
    const domainUrls = this.props.domains[key] ?? []
    const site = this.props.details[key]

    // A domain without a matching `sites` entry is valid config but has nothing
    // to show here, so skip it rather than crashing on undefined.
    if (!site) {
      return (
        <div key={key} className="site-options-information">
          <h3 className="site-options-title">{TextFormatter.stripTags(key)}</h3>
          <p>{Methods.i18n('l10nNoDomainInformationSet')}</p>
        </div>
      )
    }

    return (
      <div key={key} className="site-options-information">
        <h3 className="site-options-title">{TextFormatter.stripTags(key)}</h3>

        <h4 className="site-options-subtitle">
          {Methods.i18n('l10nUrlPatterns')}
        </h4>
        <ul className="site-options-list site-options-list-urls">
          {domainUrls.map((url, index) => (
            <li key={index}>{TextFormatter.stripTags(url)}</li>
          ))}
        </ul>

        <h4 className="site-options-subtitle">
          {Methods.i18n('l10nInsertElements')}
        </h4>
        <ul className="site-options-list site-options-list-elements">
          {(site.insert ?? []).map((item, index) => (
            <li key={index}>
              {Methods.i18n('l10nPosition')}:{' '}
              <span className="mono-text">
                {TextFormatter.stripTags(item.position)}
              </span>{' '}
              | {Methods.i18n('l10nElement')}:{' '}
              <span className="mono-text">
                {TextFormatter.stripTags(item.class)}
              </span>
            </li>
          ))}
        </ul>

        <h4 className="site-options-subtitle">
          {Methods.i18n('l10nCustomClasses')}
        </h4>
        <ul className="site-options-list site-options-list-classes">
          <li className="custom-class custom-class-deploy">
            {TextFormatter.stripTags(site.classes?.deploy)}
          </li>
          <li className="custom-class custom-class-no-deploy">
            {TextFormatter.stripTags(site.classes?.['no-deploy'])}
          </li>
        </ul>
      </div>
    )
  }

  override render() {
    const keys = Object.keys(this.props.domains ?? {})

    return (
      <div className="content-wrapper content-site-information">
        <div className="flex-row">
          <div className="flex-col">
            <h2>{Methods.i18n('l10nSiteInformation')}</h2>
          </div>
        </div>
        {keys.map((key) => this.renderSite(key))}
        {keys.length === 0 && <p>{Methods.i18n('l10nNoDomainInformationSet')}</p>}
      </div>
    )
  }
}

export default SiteInformation
