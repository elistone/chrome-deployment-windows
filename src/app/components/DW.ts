import match from "url-match-patterns";
import {Timezones} from "./Timezones";
import {Methods} from "./Methods";
import {Config} from "../config/Config";

export class DW {

    /**
     * hold access to the current domain key
     */
    protected domainKey: string;

    /**
     * current url
     */
    protected currentUrl: string;

    /**
     * the deployment info object
     */
    protected deploymentInfo: object;

    /**
     * config class
     */
    private config: Config;

    /**
     * loaded config data
     */
    private configData: object;


    /**
     * run checks on current domain or one passed in
     *
     * @param url
     */
    constructor(url = null) {
        this.currentUrl = url || window.location.href;
        this.domainKey = "";
        this.deploymentInfo = {};
        this.config = new Config()
    }

    /**
     * Load the config, returns a promise
     */
    public loadConfig(): Promise<object> {
        return this.config.loadConfig()
    }

    /**
     * continue setup (should be called after loading config)
     */
    public setup() {
        this.configData = this.config.getFullConfig();
        this.checkDomain();
        this.checkDeployments();
    }

    /**
     * returns the config
     */
    public getConfig(): object {
        return this.configData || {};
    }

    /**
     * returns the domain key found
     */
    public getDomainKey(): string {
        return this.domainKey || null;
    }


    /**
     * Get's the deployment information and adds in extra information that will be useful.
     * Such as access the the domain information and time converted to local.
     */
    public getDeploymentInfo(): object {
        let deploymentInfo = this.deploymentInfo;

        if (typeof deploymentInfo === "undefined" || (Object.keys(deploymentInfo).length === 0 && deploymentInfo.constructor === Object)) {
            return deploymentInfo;
        }

        const timeObj = this.getTime();
        const startTime = timeObj['local']['start'];
        const endTime = timeObj['local']['end'];
        const config = this.getConfig();

        deploymentInfo['domainKey'] = this.getDomainKey();
        deploymentInfo['timeObj'] = timeObj;
        deploymentInfo['status'] = this.getDeploymentStatus(startTime, endTime);
        deploymentInfo['canDeploy'] = this.canDeploy(startTime, endTime);
        // @ts-ignore
        deploymentInfo['domainInfo'] = config.sites[this.getDomainKey()];

        return deploymentInfo;
    }


    /**
     * Checks the set domain to see if the path contains any deployment information.
     * By default it will use the domain key that has been found.
     *
     * @param domainKey
     */
    public checkDeployments(domainKey = null): object {
        domainKey = domainKey || this.getDomainKey()
        const config = this.getConfig();

        if (domainKey && config['deployments']) {
            const configDeployments = config['deployments'];
            for (const site in configDeployments) {
                const info = configDeployments[site];
                if (info.hasOwnProperty(domainKey)) {
                    const path = info[domainKey];
                    if (this.currentUrl.includes(path)) {
                        this.deploymentInfo = info;
                        this.deploymentInfo = this.getDeploymentInfo();
                        return info;
                    }
                }
            }
        }

        return {};
    }

    /**
     * Pull out the time objs
     *
     * @param timeObj
     */
    protected getTime(timeObj = null) {
        const start = timeObj && timeObj['start'] ? timeObj['start'] : this.deploymentInfo['time']['start'];
        const end = timeObj && timeObj['end'] ? timeObj['end'] : this.deploymentInfo['time']['end'];
        const timezone = timeObj && timeObj['timezone'] ? timeObj['timezone'] : this.deploymentInfo['time']['timezone'];

        const startTime = new Timezones(start, timezone);
        const endTime = new Timezones(end, timezone);
        return {
            "original": {
                "start": startTime.toOriginalTime(),
                "end": endTime.toOriginalTime(),
                "timezone": endTime.getOriginalTimezone(),
            },
            "local": {
                "start": startTime.toLocalTime(),
                "end": endTime.toLocalTime(),
                "timezone": endTime.getLocalTimezone(),
            }
        }
    }

    /**
     * Checks the domains to see if we have a match
     * If it returns true that means this can display deployment windows
     */
    protected checkDomain(): boolean {
        const config = this.getConfig();
        // @ts-ignore
        const domains = config.domains;
        let found = false;

        for (let key in domains) {
            const patterns = domains[key];
            for (let i = 0; i < patterns.length; i++) {
                const pattern = patterns[i];
                const hasMatch = match(pattern, this.currentUrl);
                if (hasMatch) {
                    found = true
                    this.domainKey = key;
                }
            }
        }

        return found;
    }

    /**
     * Check if can be deployed
     *
     * @param startTime
     * @param endTime
     */
    public canDeploy(startTime = null, endTime = null) {
        const start = startTime || this.deploymentInfo['timeObj']['local']['start'];
        const end = endTime || this.deploymentInfo['timeObj']['local']['end'];
        return Timezones.isDeploymentWindow(start, end);
    }

    /**
     * Get deployment status text
     *
     * @param startTime
     * @param endTime
     */
    public getDeploymentStatus(startTime = null, endTime = null) {
        const start = startTime || this.deploymentInfo['timeObj']['local']['start'];
        const end = endTime || this.deploymentInfo['timeObj']['local']['end'];
        return this.canDeploy(start, end) ? Methods.i18n('l10nDeploymentOpen') : Methods.i18n('l10nDeploymentClosed');
    }
}
