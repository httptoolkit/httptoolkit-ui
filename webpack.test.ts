const tmp = require('tmp');
tmp.setGracefulCleanup();

import commonConfig = require('./webpack.common');

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.output = {
    path: tmp.dirSync(),
}

export = commonConfig;