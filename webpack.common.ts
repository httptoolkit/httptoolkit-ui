import path = require('path');
import HtmlWebpackPlugin = require('html-webpack-plugin');
import { InjectManifest } from '@httptoolkit/workbox-webpack-plugin';
import * as Webpack from 'webpack';

// Webpack (but not tsc) gets upset about this, so let's opt out
// of proper typing entirely.
const MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const SRC_DIR = path.resolve(__dirname, 'src');
const OUTPUT_DIR = path.resolve(__dirname, 'dist');

export = <Webpack.Configuration> {
    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: 'app.js',
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
            test: /\.(woff2|png)$/,
            loader: 'file-loader'
        }, {
            test: /\.css$/,
            use: [ 'style-loader', 'css-loader' ]
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
        fs: 'empty'
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(SRC_DIR, 'index.html')
        }),
        new MonacoWebpackPlugin({
            languages: [
                'html',
                'css',
                'javascript',
                'typescript', // required for JS
                'json',
                'markdown',
                'xml',
                'yaml'
            ],
            features: [
                'bracketMatching',
                'caretOperations',
                'clipboard',
                'colorDetector',
                'find',
                'folding',
                'inspectTokens',
                'links',
                'smartSelect',
                'wordHighlighter'
            ]
        }),
        new Webpack.EnvironmentPlugin({
            'SENTRY_DSN': null
        }),
        new InjectManifest({
            swDest: 'update-worker.js',
            importWorkboxFrom: 'local'
        })
    ],
};