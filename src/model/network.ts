import * as ipaddr from 'ipaddr.js';
import { logError } from '../errors';

export function isValidPort(port: number): boolean {
    return port > 0 && port <= 65535;
}

export function isValidHost(host: string | undefined): boolean {
    return !!host?.match(/^[A-Za-z0-9\-.]+(:\d+)?$/);
}

export function isValidHostname(hostname: string | undefined): boolean {
    return !!hostname?.match(/^[A-Za-z0-9\-.]+$/);
}

function isIPv6(ip: ipaddr.IPv4 | ipaddr.IPv6): ip is ipaddr.IPv6 {
    return ip.kind() === 'ipv6';
}

const subnetDescriptionOverrides: _.Dictionary<string> = {
    'unspecified': 'unknown',
    'loopback': 'this machine',
    'private': 'a local network device',
    'uniqueLocal': 'a local network device',
    'unicast': '',
};

// Takes an IPv6 or IPv4 address, and makes it presentable
export function getReadableIP(ip: string) {
    let parsedIp: ipaddr.IPv4 | ipaddr.IPv6
    try {
        parsedIp = ipaddr.parse(ip);
    } catch (e) {
        logError('Failed to parse IP', { ip: ip });
        return ip;
    }

    if (isIPv6(parsedIp) && parsedIp.isIPv4MappedAddress()) {
        parsedIp = parsedIp.toIPv4Address();
    }

    const subnetType = parsedIp.range();
    const subnetDescription = (
        subnetType in subnetDescriptionOverrides
            ? subnetDescriptionOverrides[subnetType]
            : subnetType
    ).replace(/([A-Z])/g, ' $1') // camelCase to separate Words
    .toLowerCase() // Lowercase everything
    .replace(/^rfc/, 'see RFC ') // Highlight RFCs;

    return parsedIp.toNormalizedString() + (
        subnetDescription
            ? ` (${subnetDescription})`
            : ''
    );
}