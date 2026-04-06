/**
 * Ultra-lean webpack config for rapid iteration.
 *
 * Compared to webpack.test.ts this saves ~2 GB RAM and ~8 minutes by:
 *   - mode: 'development'       → no minification, no tree-shaking
 *   - devtool: false             → no source maps
 *   - output.clean: false        → reuse existing assets in dist/
 *   - No CopyPlugin              → API JSONs already in dist/ from prior build
 *   - No ForkTsCheckerPlugin     → run `npx tsc --noEmit` separately if needed
 *   - No ForkTsCheckerNotifier
 *   - thread-loader: 1 worker    → minimal memory overhead
 *   - No MonacoWebpackPlugin     → reuse existing monaco chunks in dist/
 *
 * Usage (from project root):
 *   npx env-cmd -f ./automation/ts-node.env.js \
 *     npx webpack --config ./automation/webpack.fast.ts
 *
 * Prerequisites:
 *   dist/ must already contain a full build (from webpack.test.ts or CI).
 *   This config only recompiles TS/TSX source → JS chunks.
 */
import * as path from 'path';
import * as Webpack from 'webpack';
import HtmlWebpackPlugin from 'html-webpack-plugin';

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'dist');

const config: Webpack.Configuration = {
    mode: 'development',
    devtool: false,

    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: '[name].js',
        chunkFilename: '[name].bundle.js',
        // CRITICAL: do NOT clean dist — we want to keep existing assets
        // (API JSONs, monaco chunks, fonts, wasm) from the full build.
        clean: false
    },

    resolve: {
        extensions: ['.mjs', '.ts', '.tsx', '...'],
        fallback: {
            fs: false,
            net: false,
            tls: false,
            http: false,
            vm: false,
            assert: require.resolve('assert/'),
            crypto: require.resolve('crypto-browserify'),
            path: require.resolve('path-browserify'),
            process: require.resolve('process/browser'),
            querystring: require.resolve('querystring-es3'),
            stream: require.resolve('stream-browserify'),
            buffer: require.resolve('buffer/'),
            url: require.resolve('url/'),
            util: require.resolve('util/'),
            zlib: require.resolve('browserify-zlib')
        },
        alias: {
            mockrtc$: path.resolve(__dirname, '../node_modules/mockrtc/dist/main-browser.js')
        }
    },

    stats: {
        assets: false,
        children: false,
        chunks: false,
        entrypoints: false,
        modules: false
    },

    performance: { hints: false },

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [{
                loader: 'ts-loader',
                options: {
                    // Skip type checking entirely — we do that with tsc --noEmit
                    transpileOnly: true
                }
            }],
            exclude: /node_modules/
        }, {
            test: /\.(png|svg)$/,
            type: 'asset/resource'
        }, {
            test: /\.mjs$/,
            include: /node_modules/,
            type: "javascript/auto"
        }, {
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        }, {
            test: /amiusing.html$/,
            type: 'asset/source'
        }, {
            test: /node_modules[\\|/]typesafe-get/,
            use: { loader: 'umd-compat-loader' }
        }]
    },

    experiments: {
        asyncWebAssembly: true
    },

    optimization: {
        // Minimal splitting — keeps memory low
        splitChunks: false,
        runtimeChunk: false,
        minimize: false
    },

    plugins: [
        new Webpack.IgnorePlugin({
            resourceRegExp: /\/zstd-codec-binding.js$/,
            contextRegExp: /zstd-codec/
        }),
        new HtmlWebpackPlugin({
            template: path.join(SRC_DIR, 'index.html')
        }),
        // No CopyPlugin — API JSONs persist in dist/ from previous full build
        // No MonacoWebpackPlugin — reuses existing monaco chunks in dist/
        // No ForkTsCheckerWebpackPlugin — use `npx tsc --noEmit` separately
        new Webpack.ProvidePlugin({
            'process': 'process/browser.js',
            'Buffer': ['buffer', 'Buffer']
        }),
        new Webpack.EnvironmentPlugin({
            'SENTRY_DSN': null,
            'POSTHOG_KEY': null,
            'UI_VERSION': null,
            'ACCOUNTS_API': null,
        }),
        new Webpack.DefinePlugin({
            'process.env.DISABLE_UPDATES': 'true'
        })
    ]
};

export default config;
