import { observable, runInAction, action } from "mobx";

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
        const serverInterceptors = await getInterceptors(this.proxyStore.httpProxyPort);
        const serverVersion = await serverVersionPromise;

        runInAction(() => {
            const supportedInterceptors = getInterceptOptions(
                serverInterceptors,
                this.accountStore,
                serverVersion
            );

            // Quick patch for a bug in existing-chrome for server <= 1.1.2 which incorrectly
            // always reports existing Chrome as activable:
            if (
                !supportedInterceptors['fresh-chrome'].isActivable &&
                supportedInterceptors['existing-chrome'].isActivable
            ) {
                supportedInterceptors['existing-chrome'].isActivable = false;
            }

            this.interceptors = supportedInterceptors;
        });
    }

    @action.bound
    activateInterceptor = (interceptorId: string, options?: any): Promise<unknown | true> => {
        this.interceptors[interceptorId].inProgress = true;

        return activateInterceptor(
            interceptorId,
            this.proxyStore.httpProxyPort,
            options
        ).then(
            (metadata) => metadata || true
        ).finally(action(() => {
            this.interceptors[interceptorId].inProgress = false;
            this.refreshInterceptors();
        }));
    };
}