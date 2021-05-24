import merge from "webpack-merge";
import SentryPlugin from '@sentry/webpack-plugin';
import common from "./webpack.common";

const shouldPublishSentryRelease =
    process.env.SENTRY_AUTH_TOKEN && process.env.UI_VERSION;
console.log(shouldPublishSentryRelease
    ? "* Webpack will upload source map to Sentry *"
    : "Sentry source map upload disabled - no token set"
);

export default merge(common, {
    mode: "production",

    devtool: "source-map",

    // Automatically split into source/vendor bundle chunks.
    // Here because this breaks TS-node in the tests, not clear why.
    optimization: {
        splitChunks: {
            chunks: (chunk) => {
                // React monaco editor is 99.99% vendor code, so splitting it
                // just creates an absurdly tiny extra bundle.
                return chunk.name !== "react-monaco-editor";
            },
            cacheGroups: {
                zstd: {
                    test: /[\\/]node_modules[\\/]zstd-codec[\\/]/,
                    name: "zstd"
                }
            }
        }
    },

    plugins: shouldPublishSentryRelease
        ? [
            new SentryPlugin({
                release: process.env.UI_VERSION,
                include: common!.output!.path!,
                validate: true
            })
        ]
        : []
});
