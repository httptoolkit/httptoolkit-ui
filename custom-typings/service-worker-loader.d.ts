declare module "service-worker-loader!*" {
    export default function registerServiceWorker(options: {
        scope: string
    }): Promise<ServiceWorkerRegistration>;

    export class ServiceWorkerNoSupportError extends Error {}
}