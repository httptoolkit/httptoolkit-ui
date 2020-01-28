import { observable, runInAction, flow } from "mobx";

import { reportError } from "../errors";
import { lazyObservablePromise } from "../util/observable";

import { ServerStore } from "./server-store";
import { AccountStore } from "./account/account-store";

import { getInterceptors, activateInterceptor } from "../services/server-api";
import { serverVersion as serverVersionPromise } from '../services/service-versions';
import { Interceptor, getInterceptOptions } from "./interceptors";

export class InterceptorStore {

    constructor(
        private serverStore: ServerStore,
        private accountStore: AccountStore
    ) {
        this.interceptors = getInterceptOptions([]);
    }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.serverStore.initialized,
            this.accountStore.initialized
        ]);

        await this.refreshInterceptors();

        const refreshInterceptorInterval = setInterval(() =>
            this.refreshInterceptors()
        , 10000);

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterceptorInterval);
        });
    });

    @observable interceptors: _.Dictionary<Interceptor>;

    async refreshInterceptors() {
        const serverInterceptors = await getInterceptors(this.serverStore.serverPort);
        const serverVersion = await serverVersionPromise;
        const { featureFlags } = this.accountStore;

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors, serverVersion, featureFlags);
        });
    }

    activateInterceptor = flow(function * (
        this: InterceptorStore,
        interceptorId: string,
        options?: any
    ) {
        this.interceptors[interceptorId].inProgress = true;
        const result: unknown = yield activateInterceptor(
            interceptorId,
            this.serverStore.serverPort,
            options
        ).then(
            (metadata) => metadata || true
        ).catch((e) => {
            reportError(e);
            return false;
        });

        this.interceptors[interceptorId].inProgress = false;
        yield this.refreshInterceptors();

        return result;
    });
}