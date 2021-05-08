export class ConfigValidate {
    /**
     * Validate top level keys
     * @private
     */
    private readonly _topLevelKeys = ['deployments', 'domains', 'sites'];

    /**
     * Full data object
     * @private
     */
    private readonly _data: object;

    /**
     * constructor
     * @param data
     */
    constructor(data) {
        this._data = data;
    }

    /**
     * Check the data strut checking it is correct.
     */
    public check(): Promise<any> {
        const _this = this;
        return new Promise(function (resolve, reject) {
            // confirm the top level keys are valid
            for (let topLevel in _this._data) {
                topLevel = topLevel.toLowerCase();
                if (_this._topLevelKeys.indexOf(topLevel) === -1) {
                    reject(`Top level key '${topLevel}' is not valid.`);
                }
            }

            // confirm the top level keys does not have too little keys
            const expectedCount = _this._topLevelKeys.length;
            const actualCount = Object.keys(_this._data).length;
            if (actualCount < expectedCount) {
                _this._topLevelKeys.forEach(function (item, index) {
                    if (!Object.keys(_this._data).includes(item)) {
                        reject(`There are too few keys found - you are missing '${item}'`);
                    }
                });
            }

            resolve(`Validated json structure`);
        });
    }
}