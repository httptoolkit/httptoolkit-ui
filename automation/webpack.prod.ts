import * as path from 'path';
import merge from "webpack-merge";
import { RawSource } from 'webpack-sources';
import * as SentryPlugin from '@sentry/webpack-plugin';

import { InjectManifest } from 'workbox-webpack-plugin';
import * as ssri from "ssri";
import { BundleAnalyzerPlugin } from 'webpack-bundle-analyzer';
import CspHtmlWebpackPlugin from 'csp-html-webpack-plugin';

import common from "./webpack.common";

const shouldPublishSentryRelease =
    process.env.SENTRY_AUTH_TOKEN && process.env.UI_VERSION;
console.log(shouldPublishSentryRelease
    ? "* Webpack will upload source map to Sentry *"
    : "Sentry source map upload disabled - no token set"
);

const CSP_REPORT_URL = process.env.REPORT_URI && process.env.UI_VERSION
    ? `${process.env.REPORT_URI}&sentry_release=${process.env.UI_VERSION}`
    : false;
console.log(CSP_REPORT_URL
    ? "CSP reporting enabled"
    : `CSP reporting skipped (uri: ${process.env.REPORT_URI}. version: ${process.env.UI_VERSION})`
);

export default merge(common, {
    mode: "production",

    devtool: "source-map",

    // Automatically split into source/vendor bundle chunks.
    // Here because this breaks TS-node in the tests, not clear why.
    optimization: {
        chunkIds: 'named',
        splitChunks: {
            chunks: 'all',

            // Split out various extra chunks for libraries that we know to be large & either
            // rarely used or updated differently to other code in the frontend. The goal is to
            // avoid re-downloading large non-updated libs when often-updated libs change.
            // This is a bit suspect - definitely more art then science right now.
            cacheGroups: {
                // Zstd is rarely used, big-ish, always loaded async, and v rarely changed:
                zstd: {
                    test: /[\\/]node_modules[\\/]zstd-codec[\\/]/,
                    name: 'zstd'
                },

                // Monaco is loaded async, v large, and rarely changed:
                monaco: {
                    test: /[\\/]node_modules[\\/](monaco-editor|react-monaco-editor)[\\/]/,
                    name: 'monaco'
                },

                // APIs change on a completely independent schedule to anything else:
                apis: {
                    test: /[\\/]node_modules[\\/]openapi-directory[\\/]/,
                    name: 'apis'
                },

                // Mockttp is relatively frequently changed, so pulling it into
                // a separate chunk avoids churn elsewhere:
                mockttp: {
                    test: /[\\/]node_modules[\\/]mockttp[\\/]/,
                    name: 'mockttp'
                }
            }
        }
    },

    plugins: [
        new InjectManifest({
            swSrc: path.join(
                path.dirname(common.entry as string),
                'services',
                'ui-update-worker.ts'
            ),
            exclude: [
                'google-fonts',
                /^api\//,
                'ui-update-worker.js',
                /\.map$/,
                /\.caddyfile$/
            ],
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
            SentryPlugin.sentryWebpackPlugin({
                release: {
                    name: process.env.UI_VERSION!,
                    setCommits: {
                        auto: true,
                        ignoreEmpty: true,
                        ignoreMissing: true
                    }
                }
            })
        ]
        : []),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            excludeAssets: /api\/.*\.json/
        }),
        ...(CSP_REPORT_URL
            ? [
                new CspHtmlWebpackPlugin({
                    'base-uri': "'self'",
                    'default-src': "'none'",
                    'object-src': "'none'",
                    'frame-ancestors': "'none'",
                    'img-src': [
                        "'self'", 'data:', 'https://httptoolkit.com', 'https://secure.gravatar.com'
                    ],
                    'font-src': ["'self'"],
                    'style-src': ["'report-sample'", "'self'", "'unsafe-inline'"],
                    'frame-src': "https://login.httptoolkit.tech",
                    'script-src': [
                        "'report-sample'",
                        "'unsafe-eval'", // For both wasm & real eval() uses
                        "'self'",
                        'https://cdn.auth0.com/', 'https://cdn.eu.auth0.com/', 'https://secure.gravatar.com'
                    ],
                    'connect-src': [
                        "'self'", 'data:',
                        'http://127.0.0.1:45456', 'http://127.0.0.1:45457', 'ws://127.0.0.1:45456',
                        'https://*.httptoolkit.tech', 'https://*.sentry.io'
                    ],
                    'report-uri': CSP_REPORT_URL,
                    'report-to': 'csp-endpoint'
                }, {
                    enabled: true,
                    hashEnabled: {
                        'script-src': true,
                        'style-src': false
                    },
                    nonceEnabled: {
                        'script-src': false,
                        'style-src': false
                    },
                    // Output CSP into a Caddy config file, that's imported by Caddyfile
                    processFn: (
                        builtPolicy: any,
                        _htmlPluginData: any,
                        _obj: any,
                        compilation: any
                    ) => {
                        const header = `
                            header Content-Security-Policy-Report-Only "${builtPolicy}"
                            header Reporting-Endpoints \`csp-endpoint="${CSP_REPORT_URL}"\`
                        `;
                        compilation.emitAsset('csp.caddyfile', new RawSource(header));
                    }
                } as any)
            ]
        : [])
    ]
});