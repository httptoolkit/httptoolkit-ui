require('ts-node/register');

const tmp = require('tmp');
tmp.setGracefulCleanup();

module.exports = function(config) {
    config.set({
        frameworks: ['mocha', 'chai'],
        files: [
            './**/*.spec.ts'
        ],
        mime: { 'text/x-typescript': ['ts'] },
        webpack: require('../../automation/webpack.test').default,
        webpackMiddleware: {
            stats: 'error-only'
        },
        preprocessors: {
            './**/*.ts': ['webpack', 'sourcemap'],
            '../../src/**/*.ts': ['webpack', 'sourcemap'],
        },
        reporters: ['mocha'],
        mochaReporter: {
            showDiff: true
        },
        port: 9876,
        logLevel: config.LOG_INFO,

        browsers: ['ChromeHeadless'],

        autoWatch: false,
        singleRun: true,
        concurrency: Infinity
    });
};