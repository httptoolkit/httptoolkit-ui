const webpackConfig = require('../../automation/webpack.unittest').default;

module.exports = function(config) {
    config.set({
        frameworks: ['mocha', 'chai', 'webpack'],

        files: [
            './**/*.spec.ts',
            './**/*.spec.tsx',

            {
                // Required due to https://github.com/codymikol/karma-webpack/issues/450
                pattern: `${webpackConfig.output.path}/**/*`,
                watched: false,
                included: false
            }
        ],
        mime: { 'text/x-typescript': ['ts', 'tsx'] },
        webpack: webpackConfig,
        webpackMiddleware: {
            stats: 'errors-only'
        },
        preprocessors: {
            './**/*.ts': ['webpack', 'sourcemap'],
            './**/*.tsx': ['webpack', 'sourcemap'],
            '../../src/**/*.ts': ['webpack', 'sourcemap'],
            '../../src/**/*.tsx': ['webpack', 'sourcemap'],
        },
        reporters: ['mocha'],
        mochaReporter: {
            showDiff: true
        },
        port: 9876,
        logLevel: config.LOG_INFO,

        browsers: ['ChromeHeadlessNoSandbox'],
        customLaunchers: {
          ChromeHeadlessNoSandbox: {
            base: 'ChromeHeadless',
            flags: ['--no-sandbox']
          }
        },

        autoWatch: false,
        singleRun: true,
        concurrency: Infinity
    });
};