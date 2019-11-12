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