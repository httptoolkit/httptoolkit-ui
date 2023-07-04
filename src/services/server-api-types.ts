import { NetworkInterfaceInfo } from 'os';
import { ProxySetting } from 'mockttp';

export interface ServerInterceptor {
    id: string;
    version: string;
    isActivable: boolean;
    isActive: boolean;
    metadata?: any;
}

export interface NetworkInterfaces {
    [index: string]: NetworkInterfaceInfo[];
}

export interface ServerConfig {
    certificatePath: string;
    certificateContent?: string;
    certificateFingerprint?: string;
    networkInterfaces: NetworkInterfaces;
    systemProxy: ProxySetting | undefined;
    dnsServers: string[];
    ruleParameterKeys: string[];
}