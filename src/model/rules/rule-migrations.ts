export function migrateRules(data: any) {
    // Take some raw rule data, exported from any version of the app since HTTP Mock was launched,
    // and convert it into raw modern rule data, ready to be deserialized.
    if (data.version === undefined) {
        // Right now all rule data is unversioned, but with this check we can safely start
        // versioning as soon as it's necessary
        data.rules = data.rules.map((rule: any) => {
            const { handler } = rule;
            if (handler.type === 'passthrough') {
                // Handle the targetHost -> forwarding object change from 0.18.1:
                if (handler.forwardToLocation && !handler.forwarding) {
                    handler.forwarding = { targetHost: handler.forwardToLocation, updateHostHeader: true };
                }
            }

            return rule;
        });
    }

    return data;
}