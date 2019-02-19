const _ = require('lodash');
const packageLock = require('../package-lock.json');

// This is run at build time. It transforms package-lock (a large file)
// into a tiny map of package -> specific version, which is useful info
// in a couple of places.
module.exports = function () {
    return {
        code: 'module.exports = ' +
            JSON.stringify(
                _(packageLock.dependencies)
                .pickBy((dep) => !dep.dev)
                .mapValues((dep) => dep.version)
                .valueOf()
            )
    };
}