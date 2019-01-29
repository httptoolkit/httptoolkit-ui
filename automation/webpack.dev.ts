import * as path from 'path';

import * as merge from 'webpack-merge';
import common from './webpack.common';

export default merge(common, {
    mode: 'development',

    devtool: 'inline-source-map',

    devServer: {
        contentBase: common.output!.path!,
        public: 'local.httptoolkit.tech:8080'
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