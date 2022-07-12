import { observable } from 'mobx';

import {
    FailedTLSConnection,
    HttpExchange
} from '../../types';

export abstract class HTKEventBase {

    abstract get id(): string;

    @observable
    public searchIndex: string = '';

    @observable
    public pinned: boolean = false;

}