import { observable } from 'mobx';

import {
    FailedTLSConnection,
    HttpExchange,
    WebSocketStream
} from '../../types';

export abstract class HTKEventBase {

    abstract get id(): string;

    // These can be overriden by subclasses to allow easy type narrowing:
    isHttp(): this is HttpExchange { return false; }
    isWebSocket(): this is WebSocketStream { return false; }
    isTLSFailure(): this is FailedTLSConnection { return false; }

    @observable
    public searchIndex: string = '';

    @observable
    public pinned: boolean = false;

}