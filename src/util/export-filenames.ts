/**
 * Utilities for generating safe, consistent filenames for exports.
 *
 * Naming conventions follow HTTPToolkit's established patterns:
 *   - HAR single:  "{METHOD} {hostname}.har"
 *   - HAR batch:   "HTTPToolkit_export_{date}_{count}-requests.har"
 *   - ZIP archive: "HTTPToolkit_{date}_{count}-requests.zip"
 *   - Snippet:     "{index}_{METHOD}_{STATUS}_{hostname}.{ext}"
 */

const MAX_FILENAME_LENGTH = 100;

/**
 * Sanitizes a string for safe use in filenames.
 * Strips protocol, query strings, and invalid characters.
 */
function sanitize(raw: string, maxLen: number = 40): string {
    return raw
        .replace(/^https?:\/\//, '')    // Strip protocol
        .replace(/[?#].*$/, '')         // Strip query/fragment
        .replace(/\/+$/, '')            // Strip trailing slashes
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_') // Replace invalid FS chars
        .replace(/_+/g, '_')            // Collapse multiple underscores
        .slice(0, maxLen);
}

/**
 * Extracts a short, readable hostname from a URL.
 * Falls back to the first path segment if the hostname is generic.
 *
 * Examples:
 *   "https://api.example.com/v2/users?page=1" → "api.example.com"
 *   "https://10.0.0.1:8080/health"            → "10.0.0.1"
 */
function extractHost(url: string | undefined | null): string {
    if (!url) return '';
    try {
        const parsed = new URL(url);
        // Use hostname (without port) for readability
        return parsed.hostname || '';
    } catch {
        // Fallback: extract something meaningful from the raw string
        const match = url.match(/^https?:\/\/([^/:?#]+)/);
        return match ? match[1] : '';
    }
}

/**
 * Builds a filename for a single snippet inside the ZIP archive.
 *
 * Convention: `{index}_{METHOD}_{STATUS}_{hostname}.{ext}`
 * Examples:
 *   "001_GET_200_api.github.com.sh"
 *   "023_POST_201_httpbin.org.py"
 *   "007_DELETE_pending_localhost.js"
 *
 * The hostname gives the user immediate context about which request
 * each file represents, matching HTTPToolkit's existing HAR export
 * pattern of "{METHOD} {hostname}.har".
 */
export function buildZipFileName(
    index: number,
    method: string,
    status: number | null,
    extension: string,
    url?: string
): string {
    const padWidth = 3;
    const safeIndex = String(Math.max(1, Math.floor(index))).padStart(padWidth, '0');
    const safeMethod = (method || 'UNKNOWN').toUpperCase().replace(/[^A-Z]/g, '') || 'UNKNOWN';
    const safeStatus = status != null ? String(status) : 'pending';
    const safeExt = extension.replace(/[^a-zA-Z0-9]/g, '') || 'txt';

    const host = extractHost(url);
    const safeHost = host ? '_' + sanitize(host, 30) : '';

    const name = `${safeIndex}_${safeMethod}_${safeStatus}${safeHost}.${safeExt}`;

    // Ensure we don't exceed filesystem limits
    return name.length > MAX_FILENAME_LENGTH
        ? `${safeIndex}_${safeMethod}_${safeStatus}.${safeExt}`
        : name;
}

/**
 * Builds the archive filename for the downloaded ZIP.
 *
 * Convention: `HTTPToolkit_{date}_{count}-requests.zip`
 * Example:    "HTTPToolkit_2026-04-04_14-30_180-requests.zip"
 *
 * Follows HTTPToolkit's established batch HAR naming pattern:
 * "HTTPToolkit_export_{date}_{count}-requests.har"
 */
export function buildZipArchiveName(exchangeCount?: number): string {
    const now = new Date();
    const date = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, '0'),
        String(now.getDate()).padStart(2, '0')
    ].join('-');
    const time = [
        String(now.getHours()).padStart(2, '0'),
        String(now.getMinutes()).padStart(2, '0')
    ].join('-');

    const countPart = exchangeCount != null
        ? `_${exchangeCount}-requests`
        : '';

    return `HTTPToolkit_${date}_${time}${countPart}.zip`;
}
