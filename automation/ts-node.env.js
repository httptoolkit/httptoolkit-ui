module.exports = {
    TS_NODE_PROJECT: './automation/tsconfig.json',
    TS_NODE_FILES: true
};

// WebPack 4 and some other details require old OpenSSL providers when
// running in Node v17+:
if (process.version.match(/^v(\d+)/)[1] > 16) {
    module.exports['NODE_OPTIONS'] = '--openssl-legacy-provider';
}