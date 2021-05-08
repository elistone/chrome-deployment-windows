import {ConfigStorage} from "./ConfigStorage";

export class ConfigGlobal extends ConfigStorage {

    /**
     * Config enabled status
     * @private
     */
    private _configGlobalEnabled: string;
    private _configGlobalEnabledKey: string = "CONFIG_GLOBAL_ENABLED";

    /**
     * The config url
     * @private
     */
    private _configUrl: string;
    private _configUrlKey: string = "CONFIG_URL";

    /**
     * Last sync time
     * @private
     */
    private _configLastSync: string;
    private _configLastSyncKey = "LAST_SYNC";

    /**
     * public method to load the config
     */
    public load(): Promise<(string | void)[]> {
        return this.loadInformation();
    }

    /**
     * Load the config information and assign to variables
     */
    protected loadInformation(): Promise<(string | void)[]> {
        // this.storageClear();
        const setStorage1 = this.storageGet(this._configGlobalEnabledKey).then(r => this._configGlobalEnabled = this.extractValue(r[this._configGlobalEnabledKey])).catch(e => console.error(e));
        const setStorage2 = this.storageGet(this._configUrlKey).then(r => this._configUrl = this.extractValue(r[this._configUrlKey])).catch(e => console.error(e));
        const setStorage3 = this.storageGet(this._configLastSyncKey).then(r => this._configLastSync = this.extractValue(r[this._configLastSyncKey])).catch(e => console.error(e));

        return Promise.all([setStorage1, setStorage2, setStorage3]);
    }

    /**
     * Get config enabled status.
     */
    public get enabled(): string {
        return this._configGlobalEnabled ?? 'false';
    }

    /**
     * Set config enabled status.
     * @param value
     */
    public set enabled(value: string) {
        this._configGlobalEnabled = value || "";
        this.storageSet(this._configGlobalEnabledKey, {value: this._configGlobalEnabled}).then(r => '').catch(e => console.error(e));
    }

    /**
     * Get config url.
     */
    public get url(): string {
        return this._configUrl ?? '';
    }

    /**
     * Set config url.
     * @param value
     */
    public set url(value: string) {
        this._configUrl = value || "";
        this.storageSet(this._configUrlKey, {value: this._configUrl}).then(r => '').catch(e => console.error(e));
    }

    /**
     * Get the last sync date/time.
     */
    public get lastSync(): string {
        return  this._configLastSync ?? 'Never';
    }

    /**
     * Set the last sync date/time.
     * @param value
     */
    public set lastSync(value: string) {
        this._configLastSync = value || "";
        this.storageSet(this._configLastSyncKey, {value: this._configLastSync}).then(r => '').catch(e => console.error(e));
    }

}