/**
 * Filename helpers for ZIP exports. No dependency on Node APIs - this runs
 * in the web worker as well as the main thread.
 */

// Path separators, Windows-reserved characters & control characters:
const RESERVED_CHARS = /[<>:"/\\|?*\u0000-\u001F]/g;
// Windows-reserved device names, bare or with an extension:
const RESERVED_NAMES = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
const MAX_NAME_LENGTH = 120;

/**
 * Sanitizes a single path segment name (not a multi-segment path) into a
 * conservative cross-platform-safe filename. Empty results (e.g. for
 * names of only dots/whitespace) return `fallback` instead.
 */
export function sanitizeFilename(raw: string, fallback: string = 'unnamed'): string {
    let name = raw
        .replace(RESERVED_CHARS, '_')
        .replace(/\s+/g, ' ')
        .slice(0, MAX_NAME_LENGTH)
        // Windows drops or ignores leading/trailing dots & whitespace, so we
        // strip them (which also catches '.' & '..' path traversal):
        .replace(/^[\s.]+|[\s.]+$/g, '');

    if (!name) return fallback;

    if (RESERVED_NAMES.test(name)) name = `_${name}`;

    return name;
}

/**
 * Builds a stable base filename for a request in the format
 * `NN_METHOD[_STATUS]_host_path`. The index is zero-padded to the total
 * count's width (minimum 2 digits) so that alphabetical sorting in file
 * managers matches chronological order.
 */
export function buildRequestBaseName(args: {
    index: number;
    total: number;
    method: string;
    url: string;
    status?: number | null;
}): string {
    const padWidth = Math.max(2, String(Math.max(0, args.total - 1)).length);
    const idxStr = String(args.index).padStart(padWidth, '0');

    let host = '';
    let path = '';
    try {
        const u = new URL(args.url);
        host = u.hostname;
        path = u.pathname;
    } catch {
        path = args.url;
    }

    const pathSegment = path.replace(/\//g, '_').slice(0, 40);
    const method = args.method ? args.method.toUpperCase() : 'REQ';

    // Only include valid HTTP statuses - not e.g. null for aborted requests:
    const statusSegment = typeof args.status === 'number' &&
        args.status >= 100 && args.status <= 599
            ? String(Math.trunc(args.status))
            : '';

    const raw = [idxStr, method, statusSegment, host, pathSegment].filter(Boolean).join('_');

    return sanitizeFilename(raw, `${idxStr}_request`);
}

/** Default filename for the archive itself. */
export function buildArchiveFilename(now: Date = new Date()): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
        + `_${pad(now.getHours())}-${pad(now.getMinutes())}`;
    return `HTTPToolkit_Export_${stamp}.zip`;
}
