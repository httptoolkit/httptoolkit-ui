import webpack = require('webpack');
import path = require('path');

import merge = require('webpack-merge');
import common = require('./webpack.common');

export = merge(common, {
  mode: 'development',

  devtool: 'inline-source-map',

  devServer: {
      contentBase: common.output!.path!,
      hot: true
  },

  module: {
      rules: [
        {
            test: /\.js$/,
            enforce: 'pre',
            loader: 'source-map-loader',
            exclude: [
                path.join(__dirname, 'node_modules', 'monaco-editor'),
                path.join(__dirname, 'node_modules', 'subscriptions-transport-ws'),
                path.join(__dirname, '..', 'mockttp', 'subscriptions-transport-ws')
            ]
        }
      ]
  },

  plugins: [
    new webpack.HotModuleReplacementPlugin()
  ]
});