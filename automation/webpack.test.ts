const tmp = require('tmp');
tmp.setGracefulCleanup();

import commonConfig from './webpack.common';

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.output = {
    path: tmp.dirSync(),
}

export default commonConfig;