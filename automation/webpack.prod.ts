import merge from "webpack-merge";
import SentryPlugin from '@sentry/webpack-plugin';
import common from "./webpack.common";

const shouldPublishSentryRelease =
    process.env.SENTRY_AUTH_TOKEN && process.env.COMMIT_REF;
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
        },
    },

    plugins: shouldPublishSentryRelease
        ? [
            new SentryPlugin({
                release: process.env.COMMIT_REF,
                include: common!.output!.path!,
                validate: true
            })
        ]
        : []
});
