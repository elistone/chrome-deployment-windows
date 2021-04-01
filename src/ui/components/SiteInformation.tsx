import * as React from "react"
import {Methods} from "../../app/components/Methods";
import {TextFormatter} from "../../app/components/TextFormatter";

type Props = {
    domains: { [key: string]: string[] }
    details: {}
}

class SiteInformation extends React.Component<Props> {
    /**
     * on constructor
     * @param props
     */
    constructor(props) {
        super(props);
        this.state = {}
    }

    /**
     * gets a list of site options
     */
    siteOptions = () => {
        return Object.keys(this.props.domains).map(key => {
            const domainUrls = this.props.domains[key];

            const siteDetails = this.props.details[key];
            if (typeof siteDetails === "undefined" || siteDetails.length === 0) {
                return "";
            }
            const customClasses = siteDetails['classes'];
            const insertMethods = siteDetails['insert'];

            const urls = domainUrls.map((item, key) =>
                <li key={key}>{TextFormatter.stripTags(item)}</li>
            );

            const inserts = insertMethods.map((item, key) =>
                <li key={key}>{Methods.i18n('l10nPosition')}: <span
                    className="mono-text">{TextFormatter.stripTags(item.position)}</span> | {Methods.i18n('l10nElement')}: <span
                    className="mono-text">{TextFormatter.stripTags(item.class)}</span></li>
            );

            return <div key={TextFormatter.stripTags(key)} className="site-options-information">
                <h3 className="site-options-title">{TextFormatter.stripTags(key)}</h3>
                <div className="site-options-patterns">
                    <h4 className="site-options-subtitle">{Methods.i18n('l10nUrlPatterns')}</h4>
                    <ul className="site-options-list site-options-list-urls">
                        {urls}
                    </ul>
                </div>
                <div className="site-options-element-insert">
                    <h4 className="site-options-subtitle">{Methods.i18n('l10nInsertElements')}</h4>
                    <ul className="site-options-list site-options-list-elements">
                        {inserts}
                    </ul>
                </div>
                <div className="site-options-custom-classes">
                    <h4 className="site-options-subtitle">{Methods.i18n('l10nCustomClasses')}</h4>
                    <ul className="site-options-list site-options-list-classes">
                        <li className="custom-class custom-class-deploy">{TextFormatter.stripTags(customClasses['deploy'])}</li>
                        <li className="custom-class custom-class-no-deploy">{TextFormatter.stripTags(customClasses['no-deploy'])}</li>
                    </ul>
                </div>
            </div>;
        });
    }

    /**
     * render method
     */
    render() {
        const siteDetails = this.siteOptions();
        let displaySiteDetails = false;
        for (let i = 0; i < siteDetails.length; i++) {
            if(siteDetails[i] !== ""){
                displaySiteDetails = true;
            }
        }
        if (Object.keys(this.props.domains).length == 0) {
            displaySiteDetails = false;
        }
        return (
            <div className="content-wrapper content-site-information">
                <div className="flex-row">
                    <div className="flex-col">
                        <h2 className="page-title">{Methods.i18n('l10nSiteInformation')}</h2>
                        <h3 className="page-subtitle">{Methods.i18n('l10nSiteInformationSubtitle')}</h3>
                    </div>
                </div>
                <div className="site-options">
                    {displaySiteDetails && siteDetails}
                    {!displaySiteDetails && <div className="alert alert-warning alert-block text-center">{Methods.i18n('l10nNoSiteInformation')}</div>}
                </div>
            </div>
        );
    }
}

export default SiteInformation;
