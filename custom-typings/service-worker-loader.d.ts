declare module "service-worker-loader!*" {
    export default function registerServiceWorker(options: {
        scope: string
    }): Promise<void>;

    export class ServiceWorkerNoSupportError extends Error {}
}