import { observable, computed } from 'mobx';

import {
    FailedTLSConnection,
    HttpExchange,
    WebSocketStream
} from '../../types';

import { getEventCategory } from './categorization';

export abstract class HTKEventBase {

    abstract get id(): string;

    // These can be overriden by subclasses to allow easy type narrowing:
    isHttp(): this is HttpExchange { return false; }
    isWebSocket(): this is WebSocketStream { return false; }
    isTLSFailure(): this is FailedTLSConnection { return false; }

    @computed
    public get category() {
        return getEventCategory(this);
    }

    @observable
    public searchIndex: string = '';

    @observable
    public pinned: boolean = false;

}