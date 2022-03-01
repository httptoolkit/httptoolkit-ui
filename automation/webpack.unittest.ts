import * as _ from 'lodash';
import * as tmp from 'tmp';
tmp.setGracefulCleanup();

import commonConfig from './webpack.common';

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.plugins = undefined;
commonConfig.output = {
    path: tmp.dirSync().name,
};
commonConfig.stats = 'errors-only';

export default commonConfig;