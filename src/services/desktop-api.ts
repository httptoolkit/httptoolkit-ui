import { desktopVersion } from "./service-versions";

type DesktopInjectedKey =
    | 'httpToolkitDesktopVersion'
    | 'httpToolkitForwardingDefault';

export async function getDesktopInjectedValue(key: DesktopInjectedKey): Promise<string> {
    // In the SW, it's tricky to check the desktop version, as we don't get it injected.
    // For now, just treat it as a different environment
    if (typeof window === 'undefined') return 'service-worker';

    if (key in window) {
        // If it's already been set, just return it
        return window[key as keyof Window];
    } else {
        return new Promise<string>((resolve) => {
            // If not, it might still be coming (there's race here), so listen out
            window.addEventListener('message', (message) => {
                if (message.data[key]) resolve(message.data[key]);
            });
        });
    }
    // Note that if we're running in a browser, not the desktop shell, this _never_ resolves.
}

declare global {
    interface Window {
        desktopApi?: DesktopApi;
    }
}

interface DesktopApi {
    waitUntilDesktopApiReady?: () => Promise<void>;

    getDesktopVersion?: () => string | undefined;
    getServerAuthToken?: () => string | undefined;
    getDeviceInfo?: () => {
        platform?: string;
        release?: string;
        runtimeArch?: string;
        realArch?: string;
    } | undefined;

    selectApplication?: () => Promise<string | undefined>;
    selectFilePath?: () => Promise<string | undefined>;
    selectSaveFilePath?: () => Promise<string | undefined>;

    openContextMenu?: (options: NativeContextMenuDefinition) => Promise<string | undefined>;
    restartApp?: () => Promise<void>;

    /**
     * Given a file object, returns its path. If the path isn't available (e.g. file
     * object constructed, not selected) then this returns null. If file isn't a
     * File at all, it throws.
     */
    getPathForFile?: (file: File) => string | null;
}

interface NativeContextMenuDefinition {
    position: { x: number; y: number };
    items: readonly NativeContextMenuItem[];
}

export type NativeContextMenuItem =
    | NativeContextMenuOption
    | NativeContextMenuSubmenu
    | { type: 'separator' };

interface NativeContextMenuOption {
    type: 'option';
    id: string;
    label: string;
    enabled?: boolean;
}

interface NativeContextMenuSubmenu {
    type: 'submenu';
    label: string;
    enabled?: boolean;
    items: readonly NativeContextMenuItem[];
}

// Quick fix to avoid this file crashing the update SW which doesn't have 'window' available, without
// also breaking old Electron that doesn't have globalThis:
const global = typeof globalThis !== 'undefined'
        ? globalThis as unknown as Window
    : typeof window !== 'undefined'
        ? window
    : {} as Window;

export const DesktopApi: DesktopApi = global.desktopApi ?? {};

export function canRestartApp(): boolean {
    return window.desktopApi?.restartApp !== undefined ||
        (desktopVersion.state === 'fulfilled' && !navigator.platform?.startsWith('Mac'));
}

export function restartApp(): void {
    if (DesktopApi.restartApp) {
        // Where possible (recent desktop release) we restart the whole app directly
        DesktopApi.restartApp();
    } else if (desktopVersion.state === 'fulfilled' && !navigator.platform?.startsWith('Mac')) {
        // If not, on Windows & Linux desktop we just close the window to kill this process
        window.close();
    } else {
        // On Mac, app exit is independent from window exit, so  on older desktop versions we can't
        // force a restart here, but hopefully this will lead the user to do so themselves:
        alert("Please fully quit the application to restart all internal components.");
        window.close();
    }
}
