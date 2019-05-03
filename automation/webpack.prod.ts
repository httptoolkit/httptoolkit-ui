import * as merge from 'webpack-merge';
import common from './webpack.common';

export default merge(common, {
  mode: 'production',

  devtool: 'source-map',

  // Automatically split into source/vendor bundle chunks.
  // Here because this breaks TS-node in the tests, not clear why.
  optimization: {
    splitChunks: {
      chunks: (chunk) => {
          // React monaco editor is 99.99% vendor code, so splitting it
          // just creates an absurdly tiny extra bundle.
          return chunk.name !== 'react-monaco-editor';
      },
    },
  },
});