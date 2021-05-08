import * as React from "react"
import * as ReactDOM from "react-dom"
import Tabs from "./components/Tabs";

import SiteInformation from "./components/SiteInformation";
import DeploymentWindows from "./components/DeploymentWindows";
import ImportExport from "./components/ImportExport";
import HowToUse from "./components/HowToUse";

import {Methods} from "../app/components/Methods";
import {Config} from "../app/config/Config";
import "../styles/options.scss"

class Options extends React.Component {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = {config: {}, loaded: false};
    }

    /**
     * on component mount load the config
     */
    componentDidMount() {
        const _that = this;
        const setState = this.setState.bind(this);
        const config = new Config()
        config.loadConfig().then(() => {
            _that.setConfig(config.getFullConfig());
            setState({loaded: true});
        })
    }

    /**
     * loaded message information
     * @param state
     */
    loadedMessage = (state) => {
        if (!state) {
            return <p>Loading...</p>
        }
        return <span></span>
    }

    setConfig = (config) => {
        this.setState({
            config
        });
    }

    /**
     * render method
     */
    render() {
        // @ts-ignore
        const {config, loaded} = this.state;

        return <div>
            <h1 className="options-title">{Methods.i18n('l10nDeploymentWindowsConfig')}</h1>
            <div className="main-container">
                <Tabs>
                    <span className="nav-title" data-icon="fa-tasks">{Methods.i18n('l10nSiteInformation')}</span>
                    <span>
                        {this.loadedMessage(loaded)}
                        {loaded && <SiteInformation domains={config.domains} details={config.sites}/>}
                    </span>
                    <span className="nav-title" data-icon="fa-rocket">{Methods.i18n('l10nDeploymentWindows')}</span>
                    <span>
                        {this.loadedMessage(loaded)}
                        {loaded && <DeploymentWindows domains={config.domains} deployments={config.deployments}/>}
                    </span>
                    <span className="nav-title" data-icon="fa-cog">{Methods.i18n('l10nImportExport')}</span>
                    <span>
                        {this.loadedMessage(loaded)}
                        {loaded && <ImportExport config={config} onChange={this.setConfig}/>}
                    </span>
                    <span className="nav-title" data-icon="fa-info-circle">{Methods.i18n('l10nHowToUse')}</span>
                    <span>
                        {this.loadedMessage(loaded)}
                        {loaded && <HowToUse/>}
                    </span>
                </Tabs>
            </div>
        </div>
    }
}

ReactDOM.render(
    <Options/>,
    document.getElementById('root')
)
