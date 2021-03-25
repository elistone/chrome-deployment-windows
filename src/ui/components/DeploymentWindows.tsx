import * as React from "react"
import {Methods} from "../../app/components/Methods";
import {TextFormatter} from "../../app/components/TextFormatter";

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
                return <td key={TextFormatter.stripTags(key)}>{TextFormatter.stripTags(window[key])}</td>
            }

            return <td key={TextFormatter.stripTags(key)}>-</td>
        });
    }

    /**
     * gets a list of site deployments
     */
    siteDeployments = () => {
        return Object.keys(this.props.deployments).map(key => {
            const window = this.props.deployments[key];
            const caseSensitive = window['case-sensitive'] ? Methods.i18n('l10nTrue') : Methods.i18n('l10nFalse');
            const notesOnly = window['notes-only'] ? Methods.i18n('l10nTrue') : Methods.i18n('l10nFalse');
            const name = window['name'] ? window['name'] : Methods.i18n('l10nNoName');
            const notes = window['notes'] ? window['notes'] : Methods.i18n('l10nNoNotes');
            const timeStart =  window['time'] && window['time']['start'] ? window['time']['start'] : Methods.i18n('l10nNoTimeStart');
            const timeEnd =  window['time'] && window['time']['end'] ? window['time']['end'] :  Methods.i18n('l10nNoTimeEnd');
            const timeTimezone =  window['time'] && window['time']['timezone'] ? window['time']['timezone'] : Methods.i18n('l10nNoTimeTimezone');

            return <tr key={key}>
                <td>{TextFormatter.stripTags(name)}</td>
                <td>{TextFormatter.stripTags(timeStart)} - {TextFormatter.stripTags(timeEnd)} ({TextFormatter.stripTags(timeTimezone)})</td>
                <td>{notesOnly}</td>
                <td dangerouslySetInnerHTML={{__html: TextFormatter.toMarkdown(notes)}} />
                {this.getDomainInformation(key)}
                <td>{caseSensitive}</td>
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
                        <h2 className="page-title">{Methods.i18n('l10nDeploymentWindows')}</h2>
                        <h3 className="page-subtitle">The currently configured deployment windows.</h3>
                    </div>
                </div>
                <table className="table">
                    <thead>
                    <tr>
                        <th>{Methods.i18n('l10nName')}</th>
                        <th>{Methods.i18n('l10nDeploymentWindow')}</th>
                        <th>{Methods.i18n('l10nNotesOnly')}</th>
                        <th>{Methods.i18n('l10nNotes')}</th>
                        {this.allDomainTitles()}
                        <th>{Methods.i18n('l10nCaseSensitive')}</th>
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
