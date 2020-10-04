import {Timezones} from "./Timezones";
import {Methods} from "./Methods";
import {DW} from "./DW";

export class Notice {
    dw: DW;
    element: HTMLDivElement;
    inserted: boolean = false;
    infoFound: boolean = false;
    deploymentInfo: object
    realTimeTimer: NodeJS.Timeout;

    /**
     * create new notice
     */
    public constructor(dw) {
        this.dw = dw;
        this.deploymentInfo = this.dw.getDeploymentInfo();
        if (Object.keys(this.deploymentInfo).length !== 0) {
            this.infoFound = true;
        }
    }

    /**
     * build the notice information
     */
    public build() {
        const lcTime = this.deploymentInfo['timeObj']['local'];
        let notice = document.createElement('div');
        notice.innerHTML = this.getContent();
        notice.className = this.getDeploymentClass(lcTime['start'], lcTime['end']);
        notice.style.cssText = "margin-bottom: 1.25em;";
        this.element = notice;
    }

    /**
     * try to insert the notice into the DOM
     */
    public insert() {
        const _that = this;
        _that.inserted = false;
        const inserts = _that.deploymentInfo['domainInfo']['insert'];
        const alert = _that.element;

        // loops through the places to insert
        // if a place is found to insert into the DOM
        // no more will be added.
        inserts.forEach(function (item, index) {
            const className = item['class'];
            const position = item['position'];
            if (!_that.inserted) {
                switch (position) {
                    case "after":
                        _that.inserted = Methods.insertAfter(alert, className);
                        break;
                    case "before":
                        _that.inserted = Methods.insertBefore(alert, className);
                        break;
                }
            }
        });

        // if inserted
        // enable real time clock
        // and click events
        if (_that.inserted) {
            this.enableRealTime();
            this.enableToggleDetails();
        }
    }

    /**
     * Get the content / template for the notice
     */
    protected getContent() {
        const ogTime = this.deploymentInfo['timeObj']['original'];
        const lcTime = this.deploymentInfo['timeObj']['local'];
        const nameTxt = this.deploymentInfo['name'];
        const notesTxt = this.deploymentInfo['notes']

        const status = this.dw.getDeploymentStatus(lcTime['start'], lcTime['end']);

        const name = `<span class="dw-current-name"><strong>${nameTxt}</strong></span>`;

        const currentTime = `<span class="dw-current-time"><strong>${Methods.i18n('l10nCurrentTime')}:</strong> <span class="dw-current-time-text">${Timezones.getCurrentTime()}</span></span>`;
        const currentStatus = `<span class="dw-current-status"><strong>${Methods.i18n('l10nStatus')}:</strong> <span class="dw-current-status-text">${status}</span></span>`;

        const deploymentTime = `<span class="dw-deployment-time"><strong>${Methods.i18n('l10nDeploymentWindow')}:</strong> ${ogTime['start']} - ${ogTime['end']} <small>(${ogTime['timezone']})</small></span>`
        const localTime = `<span class="dw-local-time"><strong>${Methods.i18n('l10nYourTimezone')}:</strong> ${lcTime['start']} - ${lcTime['end']} <small>(${lcTime['timezone']})</small></span>`

        let showDetails = `<a href="#" id="dw-toggle-btn" class="dw-toggle">${Methods.i18n('l10nDetailsShow')}</a>`;
        let textDetails = `<div class="dw-details" style="display: none;"><strong>${Methods.i18n('l10nNotes')}</strong><br><span class="dw-notes">${notesTxt}</span></div>`;

        if (notesTxt.length === 0) {
            showDetails = '';
            textDetails = '';
        }

        const rowZero = `<div class='dw-notice-row dw-notice-row-0'>${name} ${showDetails}</div>`
        const rowOne = `<div class='dw-notice-row dw-notice-row-1'>${deploymentTime} ${currentTime}</div>`
        const rowTwo = `<div class='dw-notice-row dw-notice-row-2'>${localTime} ${currentStatus}</div>`
        const rowThree = `<div class='dw-notice-row dw-notice-row-3'>${textDetails}</div>`

        return rowZero + rowOne + rowTwo + rowThree;
    }

    /**
     * Update popup icon
     * TODO: This should be it's own class
     */
    protected updateIcon() {
        const lcTime = this.deploymentInfo['timeObj']['local'];
        const canDeploy = this.dw.canDeploy(lcTime['start'], lcTime['end']);
        let icon = "icons/error/icon48.png"
        if (canDeploy) {
            icon = "icons/success/icon48.png"
        }

        Methods.updateIcon(icon);
    }

    /**
     * Enable realtime updates
     * TODO: could add options to disable realtime
     */
    private enableRealTime() {
        const _that = this;
        _that.realTimeTimer = setInterval(function () {
            _that.realTime();
        }, 1000);
    }

    /**
     * Enable toggle button
     * TODO: could add options to disable toggle
     */
    private enableToggleDetails() {
        const elm = document.getElementById("dw-toggle-btn");
        if (typeof elm !== "undefined") {
            elm.addEventListener("click", this.toggleDetails);
        }
    }

    /**
     * Toggle event
     *
     * @param evt
     */
    private toggleDetails(evt) {
        evt.preventDefault();
        const target = evt.target;
        const details = Methods.findClass('dw-details');
        if (details) {
            const hidden = Methods.isHidden(details);
            if (hidden) {
                details.style.display = "block";
                target.innerHTML = Methods.i18n('l10nDetailsHide');
            } else {
                details.style.display = "none";
                target.innerHTML = Methods.i18n('l10nDetailsShow');
            }
        }
    }

    /**
     * Realtime event
     */
    private realTime() {
        const currentTime = Timezones.getCurrentTime();
        const lcTime = this.deploymentInfo['timeObj']['local'];
        const status = this.dw.getDeploymentStatus(lcTime['start'], lcTime['end']);
        const newClasses = this.getDeploymentClass(lcTime['start'], lcTime['end']);

        Methods.updateHtml(currentTime, 'dw-current-time-text');
        Methods.updateHtml(status, 'dw-current-status-text');
        Methods.updateClassName(newClasses, 'dw-notification');

        this.updateIcon();
    }

    /**
     * Finds the correct class for the notice
     *
     * @param startTime
     * @param endTime
     */
    private getDeploymentClass(startTime, endTime) {
        const deploymentClass = this.dw.canDeploy(startTime, endTime) ? this.deploymentInfo['domainInfo']['classes']['deploy'] : this.deploymentInfo['domainInfo']['classes']['no-deploy'];
        return "dw-notification  " + deploymentClass;
    }
}
