import * as _ from 'lodash';
import * as traverse from 'traverse';
import * as Ajv from 'ajv';

import { joinAnd, truncate } from './index';

type Ref = { $ref: string };

function isRef(node: any): node is Ref {
    return typeof node === 'object' &&
        node !== null &&
        // $ref can be { type: ... } if it's a real $ref-named field, as in the github API
        typeof node['$ref'] === 'string';
}

function derefRef(root: any, node: Ref) {
    const ref = node.$ref;

    if (!ref.startsWith('#')) {
        throw new Error(`Cannot resolve external reference ${ref}`);
    }

    let refParts = ref.slice(1).split('/').filter(p => p.length);
    let refTarget: any = root;

    while (refParts.length) {
        const nextPart = refParts.shift() as any;
        refTarget = refTarget[nextPart];
        if (!refTarget) {
            throw new Error(`Could not follow ref ${ref}, failed at ${nextPart}`);
        }
    }

    return refTarget;
}
/**
 * Removes almost all $refs from the given JS object. Mutates the input,
 * and returns it as well, just for convenience.
 *
 * This doesn't worry about where $ref is legal - treats it as a reference when
 * found anywhere. That could go wrong in theory, but in practice it's unlikely,
 * and easy for now.
 *
 * If this causes problems later, we need to build an OpenAPI-specific deref,
 * which understands where in OpenAPIv3 a $ref is legal, and only uses those.
 * For now though, we ignore all that for drastic simplification.
 */
export function dereference<T extends object>(root: T): T {
    traverse.forEach(root, function (this: traverse.TraverseContext, node) {
        let wasRef = false;

        while (isRef(node)) {
            wasRef = true;
            node = derefRef(root, node);
        }

        // No need to traverse into refs:
        const stopHere = wasRef;
        this.update(node, stopHere);
    });
    return root;
}

export function formatAjvError(
    data: any,
    e: Ajv.ErrorObject,
    pathTransform: (path: string) => string = _.identity
) {
    return (pathTransform(e.dataPath) || 'Document') + ` (${
        truncate(
            JSON.stringify(
                e.dataPath.length
                    ? _.get(data, e.dataPath.slice(1))
                    : data
            )
        , 50)
    }) ${e.message!}${
        e.keyword === 'enum' ?
            ` (${joinAnd(
                (e.params as Ajv.EnumParams).allowedValues, ', ', ', or ')
            })` :
        ''
    }.`
}