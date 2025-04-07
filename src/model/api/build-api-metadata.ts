import * as _ from 'lodash';
import * as querystring from 'querystring';

import { OpenAPIObject, PathItemObject } from 'openapi-directory';
import { MethodObject } from '@open-rpc/meta-schema';
import Ajv from 'ajv';

import { openApiSchema as openApiV30Schema } from './openapi-schema-3.0';
import { openApiSchema as openApiV31Schema } from './openapi-schema-3.1';
import { dereference } from '../../util/json-schema';
import { OpenRpcDocument, OpenRpcMetadata } from './jsonrpc';

export interface OpenApiMetadata {
    type: 'openapi';
    spec: OpenAPIObject;
    isBuiltInApi: boolean;
    serverMatcher: RegExp;
    requestMatchers: Map<OpenApiRequestMatcher, Path>;
}

interface OpenApiRequestMatcher {
    pathMatcher: RegExp;
    queryMatcher: querystring.ParsedUrlQuery;
}

interface Path {
    path: string;
    pathSpec: PathItemObject;
}

const filterV30Spec = new Ajv({
    // This is the main goal: strip out weird extensions
    removeAdditional: 'failing',

    // Otherwise, we're *only* doing basic validation, minor oddness is fine
    strict: false,
    validateFormats: false
}).compile(openApiV30Schema);

const filterV31Spec = new Ajv({
    strict: false,
    validateFormats: false,

    // v3.1 uses unevaluated, not additional, and removal isn't supported yet. See:
    // https://github.com/ajv-validator/ajv/issues/1346
    // For now, for 3.1 we _only_ validate, without any filtering. Fortunately there
    // aren't many 3.1 specs (only Adyen + Vercel) and none appear to have problems
    // that would make this necessary (unlike Stripe's expansion refs).
}).compile(openApiV31Schema);

const validateAndFilterSpec = (spec: OpenAPIObject) => {
    let filter = spec.openapi.startsWith('3.0')
            ? filterV30Spec
        : spec.openapi.startsWith('3.1')
            ? filterV31Spec
        : null;

    if (!filter) throw new Error(`Unrecognized OpenAPI version: ${spec.openapi}`);

    const result = filter(spec);
    if (result) return { success: true, result };
    else return { success: false, errors: filter.errors };
};

// Note that OpenAPI template strings are not the same as JSON template language templates,
// which use ${...} instead of {...}.
function openApiTemplateStringToRegexString(template: string): string {
    return template
        // Escape all regex chars *except* { }
        .replace(/[\^$\\.*+?()[\]|]/g, '\\$&')
        // Replace templates with wildcards
        .replace(/\{([^/}]+)}/g, '([^\/]*)')
        // Drop trailing slashes
        .replace(/\/$/, '');
}

export async function buildOpenApiMetadata(
    spec: OpenAPIObject,
    baseUrlOverrides?: string[]
): Promise<OpenApiMetadata> {
    const specId = `${
        spec.info['x-providerName'] || 'unknown'
    }/${
        spec.info['x-serviceName'] || 'unknown'
    }`;

    // This mutates the spec to drop unknown fields. Mainly useful to limit spec size. Stripe
    // particularly includes huge recursive refs in its x-expansion* extension fields.
    const specFilterResult = validateAndFilterSpec(spec);

    if (!specFilterResult.success) {
        console.warn(
            'Errors filtering spec',
            JSON.stringify(specFilterResult.errors, null, 2)
        );
        throw new Error(`Failed to filter spec: ${specId}`);
    }

    // Now it's relatively small & tidy, dereference everything.
    spec = dereference(spec);

    const serverUrlRegexSources = baseUrlOverrides && baseUrlOverrides.length
        // Look for one of the given base URLs, ignoring trailing slashes
        ? baseUrlOverrides.map(url => _.escapeRegExp(url).replace(/\/$/, ''))
        // Look for any URL of the base servers in the spec
        : spec.servers!.map(s => openApiTemplateStringToRegexString(s.url));

    // Build a regex that matches any of these at the start of a URL
    const serverMatcher = new RegExp(`^(${serverUrlRegexSources.join('|')})`, 'i');

    const requestMatchers = new Map<OpenApiRequestMatcher, Path>();
    _.entries(spec.paths)
        // Sort path & pathspec pairs to ensure that more specific paths are
        // always listed first, so that later on we can always use the first match
        // This should sort to, for example: /qwe#a&b, /qwe#a, /{param}#a, /{param}, /
        .sort(([pathA], [pathB]) => {
            const charPairs = _.zip(
                // For char comparison, normalize param names and drop fragments
                [...pathA.replace(/\{[^}]+\}/g, '{param}').split('#')[0]],
                [...pathB.replace(/\{[^}]+\}/g, '{param}').split('#')[0]]
            );

            for (let [charA, charB] of charPairs) {
                if (charA === charB) continue;

                // If one string has a param here and the other does not,
                // the non-param string should come first
                if (charB === '{') return -1; // A comes first
                if (charA === '{') return 1; // B comes first

                // If one string is a prefix of the other, it
                // should come last
                if (charB === undefined) return -1;
                if (charA === undefined) return 1;

                // Otherwise, fall back to the real string difference
                return (charA < charB) ? -1 : 1;
            }

            // The paths (ignoring param names & fragments) are equal.
            // Put the one with the most fragment params first
            const [pathAParamCount, pathBParamCount] = [pathA, pathB].map(p => {
                const fragment = p.split('#')[1];
                if (!fragment) return 0;
                else return 1 + _.sumBy(fragment, c => c === '&' ? 1 : 0);
            });

            if (pathAParamCount === pathBParamCount) return 0;
            else return pathAParamCount < pathBParamCount ? 1 : -1;
        })
        .forEach(([path, pathSpec]) => {
            const [realPath, pathFragment] = path.split('#');

            requestMatchers.set({
                // Build a regex that matches this path on any of those base servers
                pathMatcher: new RegExp(
                    serverMatcher.source + openApiTemplateStringToRegexString(realPath) + '/?$',
                    'i'
                ),
                // Some specs (AWS) also match requests by specific params
                queryMatcher: querystring.parse(pathFragment)
            }, {
                path: realPath,
                pathSpec: pathSpec
            });
        });

    return {
        type: 'openapi',
        spec,
        isBuiltInApi: spec.info['x-httptoolkit-builtin-api'] === true,
        serverMatcher,
        requestMatchers
    };
}

// Approximately transform a JSON template string into a regex string that will match
// values, using wildcards for each template. This is based on this draft RFC:
// https://datatracker.ietf.org/doc/draft-jonas-json-template-language/
// Only seems relevant to OpenRPC, doesn't seem widely used elsewhere.
function jsonTemplateStringToRegexString(template: string): string {
    return template
        // Escape all regex chars *except* $, {, }
        .replace(/[\^\\.*+?()[\]|]/g, '\\$&')
        // Replace templates with wildcards
        .replace(/\$\{([^/}]+)}/g, '([^\/]*)')
        // Drop trailing slashes
        .replace(/\/$/, '');
}

export function buildOpenRpcMetadata(spec: OpenRpcDocument, baseUrlOverrides?: string[]): OpenRpcMetadata {
    spec = dereference(spec);

    const serverUrlRegexSources = baseUrlOverrides && baseUrlOverrides.length
        // Look for one of the given base URLs, ignoring trailing slashes
        ? baseUrlOverrides.map(url => _.escapeRegExp(url).replace(/\/$/, ''))
        // Look for any URL of the base servers in the spec
        : spec.servers!.map(s => jsonTemplateStringToRegexString(s.url));

    // Build a regex that matches any of these at the start of a URL
    const serverMatcher = new RegExp(`^(${serverUrlRegexSources.join('|')})`, 'i');

    return {
        type: 'openrpc',
        spec,
        isBuiltInApi: spec.info['x-httptoolkit-builtin-api'] === true,
        serverMatcher,
        requestMatchers: _.keyBy(spec.methods, 'name') as _.Dictionary<MethodObject> // Dereferenced
    };
}