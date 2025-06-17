import * as _ from 'lodash';
import * as dedent from 'dedent';

import { isRuleGroup } from './rules-structure';
import { buildDefaultGroupWrapper } from './rule-creation';

// Take some raw serialized rule data, exported from any version of the app since HTTP Mock was
// launched, and convert it into raw modern rule data, ready to be deserialized.
export function migrateRuleData(data: any) {
    if (!data) return data;

    // Right now all rule data is unversioned, but with this check we can safely
    // start versioning as soon as it's necessary
    if (data.version === undefined) {
        if (data.rules) {
            data.id = 'root';
            data.title = "HTTP Toolkit Rules";
            data.isRoot = true;

            const [defaultRules, otherRules] = _.partition(data.rules, (r) => r.id.startsWith('default-'));

            if (defaultRules.length) {
                data.items = [
                    ...otherRules,
                    buildDefaultGroupWrapper(defaultRules)
                ];
            } else {
                data.items = otherRules;
            }
            delete data.rules;
        }

        data.items = data.items.map(migrateRuleItem);
    } else {
        throw new Error(dedent`
            Could not migrate rules from unknown format (${data.version}).
            Please restart HTTP Toolkit to update.
        `);
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
    // Migrate rules from the HTTP-only days into a world with rules for other protocols:
    if (rule.type === undefined) rule.type = 'http';

    const { handler } = rule;

    if (handler?.type === 'passthrough') {
        // Handle the targetHost -> forwarding object change from Mockttp 0.18.1:
        if (handler.forwardToLocation && !handler.forwarding) {
            handler.forwarding = { targetHost: handler.forwardToLocation, updateHostHeader: true };
            delete handler.forwardToLocation;
        }

        // Handle the forwarding -> transformRequest change from Mockttp v4:
        if (handler.forwarding) {
            const { targetHost, updateHostHeader } = handler.forwarding;
            const locationParts = targetHost.split('://');
            const [protocol, host] = locationParts.length > 1
                ? locationParts
                : [undefined, locationParts[0]];

            handler.transformRequest = {
                ...handler.transformRequest,
                replaceHost: {
                    targetHost: host,
                    updateHostHeader: updateHostHeader ?? true
                },
                ...(protocol ? {
                    setProtocol: protocol
                } : {})
            }

            delete handler.forwarding;
        }
    }

    // Handle the handler -> steps[] change from Mockttp v4:
    if (handler) {
        rule.steps ??= [handler];
        delete rule.handler;
    }

    return rule;
}