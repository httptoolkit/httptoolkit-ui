import * as path from 'path';
import merge from "webpack-merge";
import SentryPlugin from '@sentry/webpack-plugin';

import { InjectManifest } from 'workbox-webpack-plugin';
import * as ssri from "ssri";

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

    plugins: [
        new InjectManifest({
            swSrc: path.join(
                path.dirname(common.entry as string),
                'services',
                'update-worker.ts'
            ),
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
        ...(shouldPublishSentryRelease
        ? [
            new SentryPlugin({
                release: process.env.UI_VERSION,
                include: common!.output!.path!,
                validate: true
            })
        ]
        : [])
    ]
});
