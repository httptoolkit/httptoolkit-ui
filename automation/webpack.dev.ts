import * as path from "path";

import merge from 'webpack-merge';
import common from './webpack.common';

export default merge(common, {
    mode: 'development',

    devtool: 'eval-cheap-module-source-map' as any,

    devServer: {
        contentBase: common.output!.path!,
        host: '127.0.0.1',
        public: 'local.httptoolkit.tech:8080',
        historyApiFallback: true
    },

    module: {
        rules: [
            {
                test: /\.js$/,
                enforce: 'pre',
                loader: 'source-map-loader',
                exclude: [
                    path.join(__dirname, '..', 'node_modules', 'monaco-editor'),
                    path.join(__dirname, '..', 'node_modules', 'subscriptions-transport-ws'),
                    path.join(__dirname, '..', '..', 'mockttp', 'node_modules', 'subscriptions-transport-ws'),
                    path.join(__dirname, '..', 'node_modules', 'js-beautify')
                ]
            }
        ]
    }
});
