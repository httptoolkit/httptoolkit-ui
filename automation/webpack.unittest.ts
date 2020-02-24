import * as path from 'path';
import * as _ from 'lodash';
import * as tmp from 'tmp';
tmp.setGracefulCleanup();

import { RuleSetLoader, RuleSetRule } from 'webpack';
import commonConfig from './webpack.common';

commonConfig.mode = 'development';
commonConfig.entry = undefined;
commonConfig.plugins = undefined;
commonConfig.output = {
    path: tmp.dirSync().name,
};
commonConfig.stats = 'errors-only';

const tsRule = _.find(commonConfig.module!.rules,
    (rule: RuleSetRule) => _.isEqual(rule.test, /\.tsx?$/)
)!;

const loaders = tsRule.use as Array<RuleSetLoader>;
const awesomeLoader = _.find(loaders, { loader: 'awesome-typescript-loader' })!;
awesomeLoader.options = _.assign(awesomeLoader.options || {}, {
    configFileName: path.join(__dirname, '..', 'test', 'unit', 'tsconfig.json')
});

export default commonConfig;