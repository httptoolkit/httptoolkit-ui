import * as _ from 'lodash';
import * as Webpack from 'webpack';

import * as tmp from 'tmp';
tmp.setGracefulCleanup();

import commonConfig from './webpack.common';

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.plugins = [
    new Webpack.ProvidePlugin({
        'process': 'process/browser.js',
        'Buffer': ['buffer', 'Buffer']
    }),
];
commonConfig.output = {
    path: tmp.dirSync().name,
};
commonConfig.stats = 'errors-only';

export default commonConfig;