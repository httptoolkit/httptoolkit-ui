import { NetworkInterfaceInfo } from 'os';
import { ProxySetting } from 'mockttp';
import { ErrorLike } from '../util/error';

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

export class ApiError extends Error {

    constructor(
        message: string,
        readonly operationName: string,
        readonly errorCode?: string | number,
        public apiError?: {
            message?: string,
            code?: string
        }
    ) {
        super(`API error during ${operationName}: ${message}`);
        if (apiError) {
            this.cause = new Error(apiError?.message ?? '[Unknown API error]');
            this.cause.code = apiError?.code ?? 'unknown';
            this.cause.stack = '(From server API)';
        }
    }

    private cause?: ErrorLike;

}

export class ActivationFailure extends Error {
    constructor(
        readonly interceptorId: string,
        readonly failureMessage: string,
        readonly errorCode?: string,
        readonly cause?: ErrorLike
    ) {
        super(`Failed to activate interceptor ${interceptorId}: ${failureMessage}`);
    }
}

export class ActivationNonSuccess extends Error {
    constructor(
        readonly interceptorId: string,
        readonly metadata: unknown
    ) {
        super(`Interceptor ${interceptorId} activation ran unsuccessfully`);
    }
}