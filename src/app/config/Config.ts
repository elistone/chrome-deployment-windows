
export class Config {

    /**
     * The domains object
     */
    private _domains: object;
    private _domainsKey: string = "DOMAINS";

    /**
     * The sites object
     */
    private _sites: object;
    private _sitesKey: string = "SITES";

    /**
     * The deployments object
     */
    private _deployments: object;
    private _deploymentsKey: string = "DEPLOYMENTS";

    /**
     * Get domains
     */
    public get domains(): object {
        return this._domains;
    }

    /**
     * Set domains
     * @param value
     */
    public set domains(value: object) {
        this._domains = value || {};
        this.storageSet(this._domainsKey, this._domains).then(r => '').catch(e => console.error(e));
    }

    /**
     * Get sites
     */
    public get sites(): object {
        return this._sites;
    }

    /**
     * Set sites
     * @param value
     */
    public set sites(value: object) {
        this._sites = value || {};
        this.storageSet(this._sitesKey, this._sites).then(r => '').catch(e => console.error(e));
    }

    /**
     * Get deployments
     */
    public get deployments(): object {
        return this._deployments;
    }

    /**
     * Set deployments
     * @param value
     */
    public set deployments(value: object) {
        this._deployments = value || {};
        this.storageSet(this._deploymentsKey, this._deployments).then(r => '').catch(e => console.error(e));
    }

    /**
     * Return the full config
     */
    public getFullConfig(): object {
        let output = {};
        let domains = this.domains;
        let sites = this.sites;
        let deployments = this.deployments;

        // if everything is empty we fall back to the default config
        if (Object.keys(domains).length === 0 && Object.keys(sites).length === 0 && Object.keys(deployments).length === 0) {
            const dConfig = this.defaultConfig();
            domains = dConfig['domains'];
            sites = dConfig['sites'];
            deployments = dConfig['deployments'];
        }

        output['deployments'] = deployments;
        output['domains'] = domains;
        output['sites'] = sites;

        return output;
    }

    /**
     * public method to load the config
     */
    public loadConfig(): Promise<(object | void)[]> {
        return this.loadConfigInformation();
    }

    /**
     * Load the config information and assign to variables
     */
    protected loadConfigInformation(): Promise<(object | void)[]> {
        // this.storageClear();
        const setStorage1 = this.storageGet(this._domainsKey).then(r => this.domains = r[this._domainsKey]).catch(e => console.error(e));
        const setStorage2 = this.storageGet(this._sitesKey).then(r => this.sites = r[this._sitesKey]).catch(e => console.error(e));
        const setStorage3 = this.storageGet(this._deploymentsKey).then(r => this.deployments = r[this._deploymentsKey]).catch(e => console.error(e));

        return Promise.all([setStorage1, setStorage2, setStorage3]);
    }

    /**
     * Get information from chrome storage
     * @param key
     */
    private async storageGet(key: string): Promise<object> {
        return new Promise<object>((resolve, reject) =>
            chrome.storage.sync.get(key, result =>
                chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve(result)
            )
        )
    }

    /**
     * Set information into chrome storage
     * @param key
     * @param value
     */
    private async storageSet(key: string, value: object): Promise<string> {
        let save = {};
        save[key] = value;

        return new Promise((resolve, reject) =>
            chrome.storage.sync.set(save, () =>
                chrome.runtime.lastError ? reject(Error(chrome.runtime.lastError.message)) : resolve()
            )
        )
    }

    /**
     * Clear storage
     */
    private storageClear() {
        chrome.storage.sync.clear();
    }

    /**
     * Default config
     * The fallback config if everything is empty
     */
    private defaultConfig() {
        return {
            "domains": {
                "github": [
                    "*://*.github.com/*"
                ],
                "jira": [
                    "*://*.atlassian.net/*"
                ]
            },
            "sites": {
                "github": {
                    "insert": [
                        {
                            "class": "file-navigation",
                            "position": "after"
                        },
                        {
                            "class": "repository-content",
                            "position": "before"
                        }
                    ],
                    "classes": {
                        "deploy": "flash flash-success",
                        "no-deploy": "flash flash-error"
                    }
                },
                "jira": {
                    "insert": [
                        {
                            "class": "mod-header",
                            "position": "before"
                        }
                    ],
                    "classes": {
                        "deploy": "aui-message aui-message-success",
                        "no-deploy": "aui-message aui-message-error"
                    }
                }
            },
            "deployments": {}
        }
    }

}
