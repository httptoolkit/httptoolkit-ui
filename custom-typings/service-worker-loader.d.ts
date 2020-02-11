declare module "service-worker-loader!*" {
    interface RegistrationOptions {
        scope: string
    }

    export default function registerServiceWorker(
        options: RegistrationOptions
    ): Promise<ServiceWorkerRegistration>;
    export default function registerServiceWorker(
        mapScriptUrl: (url: string) => string,
        options: RegistrationOptions
    ): Promise<ServiceWorkerRegistration>;

    export const scriptUrl: string;

    export class ServiceWorkerNoSupportError extends Error {}
}