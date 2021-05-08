export class ConfigStorage {
    /**
     * Get information from chrome storage
     * @param key
     */
    public async storageGet(key: string): Promise<object> {
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
    public async storageSet(key: string, value: object): Promise<string> {
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
    public storageClear() {
        chrome.storage.sync.clear();
    }

    /**
     * Extracts the value from data object
     * @param data
     */
    public extractValue(data: object): string {
        let output = null;
        if (typeof data === 'object' && data !== null) {
            output = data.hasOwnProperty('value') ? data['value'] : '';
        }
        return output;
    }
}