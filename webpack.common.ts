import path = require('path');
import HtmlWebpackPlugin = require('html-webpack-plugin');
import MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');
import { Configuration } from 'webpack';

const SRC_DIR = path.resolve(__dirname, 'src', 'app');
const OUTPUT_DIR = path.resolve(__dirname, 'dist', 'app');

export = <Configuration> {
    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: 'app.js'
    },

    resolve: {
        extensions: ['.js', '.ts', '.tsx']
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [{ loader: 'awesome-typescript-loader' }],
            include: [SRC_DIR]
        }, {
            test: /\.(woff2|png)$/,
            loader: 'file-loader'
        }, {
            test: /\.css$/,
            use: [ 'style-loader', 'css-loader' ]
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
                'json',
                'markdown',
                'xml',
                'yaml'
            ]
        })
    ],
};