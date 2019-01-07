require('ts-node/register');

const tmp = require('tmp');
tmp.setGracefulCleanup();

module.exports = function(config) {
    config.set({
        frameworks: ['mocha', 'chai'],
        files: [
            '../test/**/*.spec.ts'
        ],
        mime: { 'text/x-typescript': ['ts'] },
        webpack: require('./webpack.test').default,
        webpackMiddleware: {
            stats: 'error-only'
        },
        preprocessors: {
            '../src/**/*.ts': ['webpack', 'sourcemap'],
            '../test/**/*.ts': ['webpack', 'sourcemap']
        },
        reporters: ['progress'],
        port: 9876,
        logLevel: config.LOG_INFO,

        browsers: ['ChromeHeadless'],

        autoWatch: false,
        singleRun: true,
        concurrency: Infinity
    });
};