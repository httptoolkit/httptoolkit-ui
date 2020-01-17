declare module "service-worker-loader!*" {
    export default function registerServiceWorker(options: {
        scope: string
    }): Promise<ServiceWorkerRegistration>;

    export const scriptUrl: string;

    export class ServiceWorkerNoSupportError extends Error {}
}