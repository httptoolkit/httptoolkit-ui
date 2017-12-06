import webpack = require('webpack');
import path = require('path');
import HtmlWebpackPlugin = require('html-webpack-plugin');
import { spawn } from 'child_process';

const SRC_DIR = path.resolve(__dirname, 'src', 'app');
const OUTPUT_DIR = path.resolve(__dirname, 'dist', 'app');

module.exports = {
    entry: path.join(SRC_DIR, 'index.tsx'),

    output: {
        path: OUTPUT_DIR,
        filename: 'app.js'
    },

    module: {
        rules: [{
            test: /\.tsx?$/,
            use: [{ loader: 'awesome-typescript-loader' }],
            include: [SRC_DIR]
        }, {
            test: /\.js$/,
            enforce: "pre",
            loader: "source-map-loader"
        }]
    },

    node: {
        process: true
    },

    plugins: [
        new HtmlWebpackPlugin({
            template: path.join(SRC_DIR, 'index.html')
        })
    ],

    devtool: 'cheap-source-map'
};