import * as React from "react"
import * as ReactDOM from "react-dom"
import {Methods} from "../app/components/Methods";
import {TextFormatter} from "../app/components/TextFormatter";

import "../styles/popup.css"
import {DW} from "../app/components/DW";

class Popup extends React.Component {
    constructor(props) {
        super(props);
        this.state = {loaded: false, found: false, deploymentInfo: {}};
    }

    componentDidMount() {
        const setState = this.setState.bind(this);
        chrome.tabs.query({active: true, lastFocusedWindow: true}, tabs => {
            let url = tabs[0].url;
            const dw = new DW(url)
            dw.loadConfig().then(() => {
                dw.setup();
                const deploymentInfo = dw.getDeploymentInfo();

                if (Object.keys(deploymentInfo).length !== 0) {
                    setState({deploymentInfo: deploymentInfo, found: true});
                }
                setState({loaded: true});
            });
        });
    }

    popupTable = data => {
        const ogTime = data.timeObj['original'];
        const lcTime = data.timeObj['local'];
        const notesOnly = data['notes-only'] || false;

        let table = (<table>
            <tbody>
            <tr>
                <td>{Methods.i18n('l10nDeploymentWindow')}</td>
                <td>{TextFormatter.stripTags(ogTime['start'])} - {TextFormatter.stripTags(ogTime['end'])}<br/><small>({TextFormatter.stripTags(ogTime['timezone'])})</small></td>
            </tr>
            <tr>
                <td>{Methods.i18n('l10nYourTimezone')}</td>
                <td>{TextFormatter.stripTags(lcTime['start'])} - {TextFormatter.stripTags(lcTime['end'])}<br/><small>({TextFormatter.stripTags(lcTime['timezone'])})</small></td>
            </tr>
            <tr>
                <td>{Methods.i18n('l10nStatus')}</td>
                <td><span className="status">{TextFormatter.stripTags(data.status)}</span></td>
            </tr>
            </tbody>
        </table>);
        if(notesOnly){
            table = (<span></span>);
        }

        return (
            <div className={"popup-deployment-info " + (data.canDeploy ? "can-deploy " : "can-not-deploy ")}>
                <h1>{TextFormatter.stripTags(data.name)}</h1>
                {table}
                {!notesOnly && data.notes.length > 0 && <hr/>}
                {data.notes.length > 0 && <div className="notes-section">
                    <h2>{Methods.i18n('l10nNotes')}</h2>
                    <p dangerouslySetInnerHTML={{__html:TextFormatter.toMarkdown(data.notes)}} />
                </div>}
            </div>
        )
    }

    render() {
        // @ts-ignore
        const {loaded, found, deploymentInfo} = this.state;

        return (
            <div className="dw-popup">
                {loaded && found && this.popupTable(deploymentInfo)}
                {!loaded && !found && <div className="notice-message">{Methods.i18n('l10nLoading')}</div>}
                {loaded && !found && <div className="notice-message">{Methods.i18n('l10nNoInformation')}</div>}
            </div>
        )
    }
}

// --------------

ReactDOM.render(
    <Popup/>,
    document.getElementById('root')
)
