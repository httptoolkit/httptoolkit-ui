import * as _ from 'lodash';
import * as dedent from 'dedent';

import { isRuleGroup } from './rules-structure';
import { buildDefaultGroup } from './rule-definitions';

// Take some raw rule data, exported from any version of the app since HTTP Mock was launched,
// and convert it into raw modern rule data, ready to be deserialized.
export function migrateRules(data: any) {
    // Right now all rule data is unversioned, but with this check we can safely start
    // versioning as soon as it's necessary
    if (data.version === undefined) {
        if (data.rules) {
            data.id = 'root';
            data.title = "HTTP Toolkit Rules";
            data.isRoot = true;

            const [defaultRules, otherRules] = _.partition(data.rules, (r) => r.id.startsWith('default-'));

            if (defaultRules.length) {
                data.items = [
                    ...otherRules,
                    buildDefaultGroup(defaultRules)
                ];
            } else {
                data.items = otherRules;
            }
            delete data.rules;
        }

        data.items = data.items.map(migrateRuleItem);
    } else {
        alert(dedent`
            The imported rules are in a new & unsupported format.
            Please restart HTTP Toolkit to update.
        `);
        throw new Error(`Could not migrate rules from unknown version ${data.version}`);
    }

    return data;
}

function migrateRuleItem(item: any) {
    if (isRuleGroup(item)) {
        item.items = item.items.map(migrateRuleItem);
    } else {
        item = migrateRule(item);
    }

    return item;
}

function migrateRule(rule: any) {
    const { handler } = rule;

    if (handler.type === 'passthrough') {
        // Handle the targetHost -> forwarding object change from Mockttp 0.18.1:
        if (handler.forwardToLocation && !handler.forwarding) {
            handler.forwarding = { targetHost: handler.forwardToLocation, updateHostHeader: true };
        }
    }

    return rule;
}