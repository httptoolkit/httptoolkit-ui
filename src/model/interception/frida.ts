export interface FridaHost {
    id: string;
    name: string;
    type: string;
    state:
        | 'unavailable'
        | 'setup-required'
        | 'launch-required'
        | 'available'
}

export interface FridaTarget {
    id: string;
    name: string;
}

export type FridaActivationOptions =
    | { action: 'setup', hostId: string }
    | { action: 'launch', hostId: string }
    | { action: 'intercept', hostId: string, targetId: string, enableSocks: boolean };