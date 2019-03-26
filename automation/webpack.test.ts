const tmp = require('tmp');
tmp.setGracefulCleanup();

import commonConfig from './webpack.common';

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.plugins = undefined;
commonConfig.output = {
    path: tmp.dirSync(),
};
commonConfig.stats = 'errors-only';

export default commonConfig;