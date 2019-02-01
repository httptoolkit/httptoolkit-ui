interface Clipboard {
    writeText(newClipText: string): Promise<void>;
}

interface NavigatorClipboard {
    // Only available in a secure context.
    readonly clipboard?: Clipboard;
}

interface Navigator extends NavigatorClipboard {}