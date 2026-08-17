import { Component } from 'react'

import { Methods } from '../../app/components/Methods'
import { Config, defaultConfig } from '../../app/config/Config'
import type { DeploymentWindowsConfig } from '../../app/config/types'

import Tabs from './Tabs'
import SiteInformation from './SiteInformation'
import DeploymentWindows from './DeploymentWindows'
import ImportExport from './ImportExport'
import HowToUse from './HowToUse'

interface OptionsState {
  config: DeploymentWindowsConfig
  loaded: boolean
}

/** The options page: four read/write views over the same config. */
export class Options extends Component<Record<string, never>, OptionsState> {
  private mounted = false

  override state: OptionsState = { config: defaultConfig(), loaded: false }

  override async componentDidMount(): Promise<void> {
    this.mounted = true
    try {
      const config = await Config.load()
      if (this.mounted) {
        this.setState({ config, loaded: true })
      }
    } catch {
      if (this.mounted) {
        this.setState({ loaded: true })
      }
    }
  }

  override componentWillUnmount(): void {
    this.mounted = false
  }

  private setConfig = (config: DeploymentWindowsConfig) => {
    this.setState({ config })
  }

  override render() {
    const { config, loaded } = this.state

    if (!loaded) {
      return (
        <div>
          <h1>{Methods.i18n('l10nDeploymentWindowsConfig')}</h1>
          <p>Loading...</p>
        </div>
      )
    }

    return (
      <div>
        <h1>{Methods.i18n('l10nDeploymentWindowsConfig')}</h1>
        <Tabs>
          {Methods.i18n('l10nSiteInformation')}
          <SiteInformation domains={config.domains} details={config.sites} />

          {Methods.i18n('l10nDeploymentWindows')}
          <DeploymentWindows
            domains={config.domains}
            deployments={config.deployments}
          />

          {Methods.i18n('l10nImportExport')}
          <ImportExport config={config} onChange={this.setConfig} />

          {Methods.i18n('l10nHowToUse')}
          <HowToUse />
        </Tabs>
      </div>
    )
  }
}

export default Options
