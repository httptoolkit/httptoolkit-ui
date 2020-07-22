import { observable, runInAction, flow } from "mobx";

import { reportError } from "../../errors";
import { lazyObservablePromise } from "../../util/observable";

import { ProxyStore } from "../proxy-store";
import { AccountStore } from "../account/account-store";

import { getInterceptors, activateInterceptor } from "../../services/server-api";
import { serverVersion as serverVersionPromise } from '../../services/service-versions';
import { Interceptor, getInterceptOptions } from "./interceptors";

export class InterceptorStore {

    constructor(
        private proxyStore: ProxyStore,
        private accountStore: AccountStore
    ) {
        this.interceptors = getInterceptOptions([], accountStore);
    }

    readonly initialized = lazyObservablePromise(async () => {
        await Promise.all([
            this.proxyStore.initialized,
            this.accountStore.initialized
        ]);

        await this.refreshInterceptors();

        const refreshInterceptorInterval = setInterval(() =>
            this.refreshInterceptors()
        , 10000);

        window.addEventListener('beforeunload', () => {
            clearInterval(refreshInterceptorInterval);
        });

        console.log('Interceptor store initialized');
    });

    @observable interceptors: _.Dictionary<Interceptor>;

    async refreshInterceptors() {
        const serverInterceptors = await getInterceptors(this.proxyStore.serverPort);
        const serverVersion = await serverVersionPromise;

        runInAction(() => {
            this.interceptors = getInterceptOptions(serverInterceptors, this.accountStore, serverVersion);
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
            this.proxyStore.serverPort,
            options
        ).then(
            (metadata) => metadata || true
        ).catch((e) => {
            reportError(e);
            return false;
        });

        this.interceptors[interceptorId].inProgress = false;
        this.refreshInterceptors();

        return result;
    });
}