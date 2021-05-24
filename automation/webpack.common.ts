import * as path from 'path';
import * as Webpack from 'webpack';

import HtmlWebpackPlugin from 'html-webpack-plugin';
import GoogleFontsPlugin from 'google-fonts-plugin';
import CopyPlugin from 'copy-webpack-plugin';

import { InjectManifest } from 'workbox-webpack-plugin';
import * as ssri from "ssri";

// Webpack (but not tsc) gets upset about this, so let's opt out
// of proper typing entirely.
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const SRC_DIR = path.resolve(__dirname, '..', 'src');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'dist');

export default <Webpack.Configuration>{
    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: 'app.js',
        chunkFilename: '[name].bundle.js',
        // https://github.com/webpack-contrib/worker-loader/issues/142
        // Stops HMR breaking worker-loader
        globalObject: 'this'
    },

    resolve: {
        extensions: ['.js', '.ts', '.tsx']
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [{ loader: 'awesome-typescript-loader' }],
            exclude: /node_modules/
        }, {
            test: /\.(woff2|ttf|png|svg)$/,
            loader: 'file-loader'
        }, {
            test: /\.css$/,
            use: ['style-loader', 'css-loader']
        }, {
            test: /amiusing.html$/,
            use: 'raw-loader'
        }, {
            test: /node_modules[\\|/]typesafe-get/,
            use: { loader: 'umd-compat-loader' }
        }]
    },

    node: {
        process: true,
        fs: 'empty',
        net: 'empty',
        tls: 'empty'
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(SRC_DIR, 'index.html')
        }),
        new CopyPlugin([
            { from: 'node_modules/openapi-directory/api', to: 'api' }
        ]),
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
            filename: 'fonts.css'
        }),
        new Webpack.EnvironmentPlugin({
            'SENTRY_DSN': null,
            'GA_ID': null,
            'UI_VERSION': null
        }),
        new InjectManifest({
            swSrc: path.join(SRC_DIR, 'services', 'update-worker.ts'),
            exclude: ['google-fonts', /^api\//, 'update-worker.js', /.map$/],
            maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
            manifestTransforms: [
                (originalManifest: any, compilation: any) => {
                    // Add integrity info to every file, to ensure the cache can't be
                    // corrupted. We have seen this in practice, I think due to AWS outage
                    // issues? This helps protect against possible corruptions:
                    const manifest = originalManifest.map((entry: any) => {
                        const asset = compilation.getAsset(entry.url);
                        const assetSource = asset.source.source();
                        entry.integrity = ssri.fromData(
                            assetSource instanceof ArrayBuffer
                                ? Buffer.from(assetSource) // Wasm!
                                : assetSource
                        ).toString();
                        return entry;
                    });

                    // If any integrity checks fail during startup, precaching stops will
                    // stop there, and the SW won't be updated.

                    return { manifest };
                },
            ] as any
        }),
    ],
};