import * as path from 'path';
import * as Webpack from 'webpack';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import GoogleFontsPlugin from '@beyonk/google-fonts-webpack-plugin';
import CopyPlugin from 'copy-webpack-plugin';
import ForkTsCheckerWebpackPlugin from 'fork-ts-checker-webpack-plugin';
import ForkTsCheckerNotifierWebpackPlugin from 'fork-ts-checker-notifier-webpack-plugin';

// Webpack (but not tsc) gets upset about this, so let's opt out
// of proper typing entirely.
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'dist');

export default <Webpack.Configuration>{
    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: '[name].js',
        chunkFilename: '[name].bundle.js',
        clean: true
    },

    resolve: {
        extensions: ['.mjs', '.ts', '.tsx', '...'],
        fallback: {
            fs: false,
            net: false,
            tls: false,
            http: false,

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

    performance: {
        hints: false
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [
                {
                    loader: 'thread-loader',
                    options: {
                        // Leave 1 cpu for the fork-ts-checker-webpack-plugin
                        workers: require('os').cpus().length - 1,

                        // Only use threads for the initial build. Most incremental
                        // builds don't want threads (because they're compiling only one file)
                        poolRespawn: false
                    },
                },
                {
                    loader: 'ts-loader',
                    options: {
                        // Note that this disables all checking - that's handled entirely by
                        // ForkTsCheckerWebpackPlugin.
                        happyPackMode: true
                    }
                }
            ],
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

    plugins: [
        new ForkTsCheckerWebpackPlugin({
            // We need to enable all checks, because happyPackMode for ts-loader (required to use
            // threads) disables 100% of checking, even for syntax errors.
            typescript: {
                diagnosticOptions: {
                    semantic: true,
                    syntactic: true
                }
            }
        }),
        new ForkTsCheckerNotifierWebpackPlugin(),
        new Webpack.IgnorePlugin({
            // Fallback, only used in wasm isn't supported. We just don't support zstd
            // if wasm isn't supported (i.e. if loaded custom in old old browsers).
            resourceRegExp: /\/zstd-codec-binding.js$/,
            contextRegExp: /zstd-codec/
        }),
        new HtmlWebpackPlugin({
            template: path.join(SRC_DIR, 'index.html')
        }),
        new CopyPlugin({
            patterns: [
                { from: 'node_modules/openapi-directory/api', to: 'api' },
                { from: './extra-apis', to: 'api' },
            ]
        }),
        new MonacoWebpackPlugin({
            languages: [
                'html',
                'css',
                'javascript',
                'typescript', // required for JS
                'json',
                'markdown',
                'shell',
                'xml',
                'yaml'
            ],
            features: [
                // These are the only features we explicitly include, but note that some others will be
                // included too, due to interdependencies in the features themselves.
                'bracketMatching',
                'caretOperations',
                'clipboard',
                'codelens',
                'find',
                'folding',
                'hover',
                'inspectTokens',
                'links',
                'smartSelect',
                'toggleTabFocusMode',
                'wordHighlighter',
                'wordOperations'
            ]
        }),
        new GoogleFontsPlugin({
            fonts: [
                { family: "Fira Mono" },
                { family: "Lato" }
            ],
            formats: ['woff2'], // Supported by Chrome, FF, Edge, Safari 12+
            filename: 'fonts.css',
            apiUrl: 'https://gwfh.mranftl.com/api/fonts'
        }),
        new Webpack.ProvidePlugin({
            'process': 'process/browser.js',
            'Buffer': ['buffer', 'Buffer']
        }),
        new Webpack.EnvironmentPlugin({
            'SENTRY_DSN': null,
            'POSTHOG_KEY': null,
            'UI_VERSION': null,
            'ACCOUNTS_API': null,
        })
    ],
};