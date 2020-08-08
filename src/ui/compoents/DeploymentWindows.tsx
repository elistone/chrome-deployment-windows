import * as React from "react"
import {Methods} from "../../app/components/Methods";

type Props = {
    domains: { [key: string]: string[] },
    deployments: {}
}

class DeploymentWindows extends React.Component<Props> {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = {}
    }

    /**
     * get domain titles for tables
     */
    allDomainTitles = () => {
        return Object.keys(this.props.domains).map(key => {
            return <th key={key}>{key} (url key)</th>
        });
    }

    /**
     * gets the extra domain information
     * @param site
     */
    getDomainInformation = (site) => {
        return Object.keys(this.props.domains).map(key => {
            const window = this.props.deployments[site];
            const hasKey = window.hasOwnProperty(key);

            if (hasKey && window[key]) {
                return <td key={key}>{window[key]}</td>
            }

            return <td key={key}>-</td>
        });
    }

    /**
     * gets a list of site deployments
     */
    siteDeployments = () => {
        return Object.keys(this.props.deployments).map(key => {
            const window = this.props.deployments[key];
            return <tr key={key}>
                <td>{window['name']}</td>
                <td>{window['time']['start']} - {window['time']['end']} ({window['time']['timezone']})</td>
                <td>{window['notes']}</td>
                {this.getDomainInformation(key)}
            </tr>
        });
    }

    /**
     * render method
     */
    render() {
        let noInformation = <p />
        if (Object.keys(this.props.deployments).length == 0) {
            noInformation = <p>{Methods.i18n('l10nNoInformationSet')}</p>;
        }
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
                        <th>{Methods.i18n('l10nNotes')}</th>
                        {this.allDomainTitles()}
                    </tr>
                    </thead>
                    <tbody>
                    {this.siteDeployments()}
                    </tbody>
                </table>
                {noInformation}
            </div>
        );
    }
}

export default DeploymentWindows;
