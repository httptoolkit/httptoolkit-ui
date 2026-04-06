/**
 * Lightweight production-like webpack config for local testing.
 *
 * This produces a real production bundle (mode: 'production') but skips
 * all the heavy plugins that require external services or tokens:
 * - No Sentry source map upload
 * - No Workbox service worker injection
 * - No CSP Caddyfile generation
 * - No bundle analyzer
 *
 * Usage:
 *   npx env-cmd -f ./automation/ts-node.env.js ^
 *     node -r ts-node/register --max_old_space_size=4096 ^
 *     ./node_modules/.bin/webpack --config ./automation/webpack.test.ts
 */
import * as Webpack from 'webpack';
import merge from 'webpack-merge';
import common from './webpack.common';

export default merge(common, {
    mode: 'production',
    devtool: 'source-map',

    optimization: {
        chunkIds: 'named',
        splitChunks: {
            chunks: 'all',
            cacheGroups: {
                zstd: {
                    test: /[\\/]node_modules[\\/]zstd-codec[\\/]/,
                    name: 'zstd'
                },
                monaco: {
                    test: /[\\/]node_modules[\\/](monaco-editor|react-monaco-editor)[\\/]/,
                    name: 'monaco'
                },
                apis: {
                    test: /[\\/]node_modules[\\/]openapi-directory[\\/]/,
                    name: 'apis'
                },
                mockttp: {
                    test: /[\\/]node_modules[\\/]mockttp[\\/]/,
                    name: 'mockttp'
                }
            }
        }
    },

    plugins: [
        new Webpack.DefinePlugin({
            'process.env.DISABLE_UPDATES': 'true'
        })
    ]
});
