import * as _ from 'lodash';
import * as querystring from 'querystring';

import { OpenAPIObject, PathItemObject } from 'openapi-directory';
import * as Ajv from 'ajv';

import { openApiSchema } from './openapi-schema';
import { dereference } from '../../util/json-schema';

interface Path {
    path: string;
    pathSpec: PathItemObject;
}

interface RequestMatcher {
    pathMatcher: RegExp;
    queryMatcher: querystring.ParsedUrlQuery;
}

export interface ApiMetadata {
    spec: OpenAPIObject;
    serverMatcher: RegExp;
    requestMatchers: Map<RequestMatcher, Path>;
}

const filterSpec = new Ajv({
    removeAdditional: 'failing'
}).compile(openApiSchema);

function templateStringToRegexString(template: string): string {
    return template
        // Escape all regex chars *except* { }
        .replace(/[\^$\\.*+?()[\]|]/g, '\\$&')
        // Replace templates with wildcards
        .replace(/\{([^/}]+)}/g, '([^\/]*)')
        // Drop trailing slashes
        .replace(/\/$/, '');
}

export async function buildApiMetadata(
    spec: OpenAPIObject,
    baseUrlOverrides?: string[]
): Promise<ApiMetadata> {
    const specId = `${
        spec.info['x-providerName'] || 'unknown'
    }/${
        spec.info['x-serviceName'] || 'unknown'
    }`;

    // This mutates the spec to drop unknown fields. Mainly useful to limit spec size. Stripe
    // particularly includes huge recursive refs in its x-expansion* extension fields.
    const isValid = filterSpec(spec);

    if (!isValid) {
        console.warn(
            'Errors filtering spec',
            JSON.stringify(filterSpec.errors, null, 2)
        );
        throw new Error(`Failed to filter spec: ${specId}`);
    }

    // Now it's relatively small & tidy, dereference everything.
    spec = <OpenAPIObject> dereference(spec);

    const serverUrlRegexSources = baseUrlOverrides && baseUrlOverrides.length
        // Look for one of the given base URLs, ignoring trailing slashes
        ? baseUrlOverrides.map(url => _.escapeRegExp(url).replace(/\/$/, ''))
        // Look for any URL of the base servers in the spec
        : spec.servers!.map(s => templateStringToRegexString(s.url));

    // Build a regex that matches any of these at the start of a URL
    const serverMatcher = new RegExp(`^(${serverUrlRegexSources.join('|')})`, 'i')

    const requestMatchers = new Map<RequestMatcher, Path>();
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
                    serverMatcher.source + templateStringToRegexString(realPath) + '/?$',
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
        spec,
        serverMatcher,
        requestMatchers
    };
}