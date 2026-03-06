import { Operation } from '../api-types';
import { ProxyStore } from '../../../model/proxy-store';

export function registerProxyOperations(
    registry: { register(op: Operation): void },
    proxyStore: ProxyStore
): void {
    registry.register(proxyGetConfigOperation(proxyStore));
}

function proxyGetConfigOperation(proxyStore: ProxyStore): Operation {
    return {
        definition: {
            name: 'proxy.get-config',
            description: 'Get the current proxy configuration: port, certificate path, ' +
                'certificate fingerprint, and external network addresses.',
            category: 'proxy',
            annotations: { readOnlyHint: true },
            inputSchema: {
                type: 'object',
                properties: {}
            },
            outputSchema: {
                type: 'object',
                properties: {
                    httpProxyPort: { type: 'number', description: 'The HTTP proxy port' },
                    certPath: { type: 'string', description: 'Path to the CA certificate file' },
                    certFingerprint: { type: 'string', description: 'SHA256 fingerprint of the CA certificate' },
                    externalNetworkAddresses: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'External IPv4 addresses of this machine'
                    }
                }
            }
        },
        handler: async () => {
            return {
                success: true,
                data: {
                    httpProxyPort: proxyStore.httpProxyPort,
                    certPath: proxyStore.certPath,
                    certFingerprint: proxyStore.certFingerprint,
                    externalNetworkAddresses: proxyStore.externalNetworkAddresses
                }
            };
        }
    };
}
