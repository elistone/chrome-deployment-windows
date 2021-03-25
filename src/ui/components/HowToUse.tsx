import * as React from "react"
import {Methods} from "../../app/components/Methods";

type Props = {}

class HowToUse extends React.Component<Props> {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = { }
    }

    /**
     * render method
     */
    render() {
        const howToUseMD = require('../../documents/HowToUse.md');

        return (
            <div className="content-wrapper content-site-information">
                <div className="flex-row">
                    <div className="flex-col">
                        <h2 className="page-title">{Methods.i18n('l10nHowToUse')}</h2>
                        <h3 className="page-subtitle">Help with the plugin.</h3>
                    </div>
                </div>
                <div dangerouslySetInnerHTML={{__html: howToUseMD}}/>
            </div>
        );
    }
}

export default HowToUse;
