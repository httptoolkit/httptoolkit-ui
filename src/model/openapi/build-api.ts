import * as _ from 'lodash';

import { OpenAPIObject, PathItemObject } from 'openapi-directory';
import * as Ajv from 'ajv';
import deref from 'json-schema-deref-sync';

import { openApiSchema } from './openapi-schema';
import { ApiMetadata } from './openapi-types';

const filterSpec = new Ajv({
    removeAdditional: 'failing'
}).compile(openApiSchema);

function templateStringToRegexString(template: string): string {
    return template
        // Replace templates with wildcards
        .replace(/\{([^/}]+)}/g, '([^\/]*)')
        // Drop trailing slashes
        .replace(/\/$/, '');
}

export function buildApiMetadata(spec: OpenAPIObject): ApiMetadata {
    // This mutates the spec to drop unknown fields. Mainly useful to limit spec size. Stripe
    // particularly includes huge recursive refs in its x-expansion* extension fields.
    const isValid = filterSpec(spec);

    if (!isValid) {
        console.warn(
            'Errors filtering spec',
            JSON.stringify(filterSpec.errors, null, 2)
        );
        throw new Error('Failed to filter spec');
    }

    // Now it's relatively small & tidy, dereference everything.
    spec = deref(spec, { failOnMissing: true, });

    const serverRegexStrings = spec.servers!.map(s => templateStringToRegexString(s.url));
    // Build a single regex that matches any URL for these base servers
    const serverMatcher = new RegExp(`^(${serverRegexStrings.join('|')})`, 'i');

    const pathMatchers = new Map<RegExp, { pathData: PathItemObject, path: string }>();
    _(spec.paths).entries()
        // Sort from most templated to least templated, so more specific paths win
        .sortBy(([path]) => _.sumBy(path, (c: string) => c === '{' ? 1 : 0))
        .forEach(([path, pathData]) => {
            // Build a regex that matches this path on any of those base servers
            pathMatchers.set(
                new RegExp(serverMatcher.source + templateStringToRegexString(path) + '$', 'i'),
                { pathData: pathData, path: path }
            );
        });

    return {
        spec,
        serverMatcher,
        pathMatchers
    }
}
