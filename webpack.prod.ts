import merge = require('webpack-merge');
import common = require('./webpack.common');

export = merge(common, {
  mode: 'production'
});