import webpack = require('webpack');
import path = require('path');
import HtmlWebpackPlugin = require('html-webpack-plugin');
import MonacoWebpackPlugin = require('monaco-editor-webpack-plugin');

const SRC_DIR = path.resolve(__dirname, 'src', 'app');
const OUTPUT_DIR = path.resolve(__dirname, 'dist', 'app');

module.exports = {
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
            test: /\.js$/,
            enforce: "pre",
            loader: "source-map-loader"
        }, {
            test: /\.woff2$/,
            loader: "file-loader"
        }, {
          test: /\.css$/,
          use: [ 'style-loader', 'css-loader' ]
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
        new MonacoWebpackPlugin(),
        new webpack.NamedModulesPlugin(),
        new webpack.HotModuleReplacementPlugin()
    ],

    devtool: 'cheap-source-map',

    devServer: {
        contentBase: OUTPUT_DIR,
        hot: true
    }
};