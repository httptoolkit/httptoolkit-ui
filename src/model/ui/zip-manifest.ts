/**
 * Schema for the `manifest.json` located at the root of every ZIP export.
 *
 * Versioned (`version: 1`) so that consuming tools can reliably check
 * compatibility. Replaces the earlier proprietary `_metadata.json` approach.
 */

export const ZIP_EXPORT_MANIFEST_VERSION = 1;

export interface ZipExportFormatEntry {
    /** Stable ID (`target~~client`, e.g. `shell~~curl`). */
    id: string;
    /** Category name (e.g. `Shell`). */
    category: string;
    /** Folder name inside the ZIP archive. */
    folder: string;
    /** File extension of the generated snippets. */
    extension: string;
    /** Human-readable label. */
    label: string;
    /** HTTPSnippet `target` / `client`. */
    target: string;
    client: string;
}

export interface ZipExportEntryRecord {
    /** Filename in the respective format folder (without extension), e.g. `01_GET_example.com`. */
    file: string;
    /** HAR request method. */
    method: string;
    /** Request URL. */
    url: string;
    /** HAR response status (`null` if the request was aborted or failed). */
    status: number | null;
    /** Original event ID, if known. */
    eventId?: string;
}

export interface ZipExportErrorRecord {
    /** Base filename of the request in the ZIP (without extension). */
    file: string;
    /** Stable format ID (`target~~client`) for which snippet generation failed. */
    formatId: string;
    /** Human-readable label of the format (e.g. `Shell cURL`). */
    format?: string;
    /** Original index in the HAR entry array (for locating the entry in the log). */
    entryIndex: number;
    /** HTTP method of the request. */
    method: string;
    /** Request URL. */
    url: string;
    /** HTTP response status, if known. */
    status: number | null;
    /** Error message from the HTTPSnippet converter. */
    error: string;
}

export interface ZipExportManifest {
    version: typeof ZIP_EXPORT_MANIFEST_VERSION;
    /** ISO timestamp of generation. */
    generatedAt: string;
    /** Name of the tool that created the export. */
    tool: 'httptoolkit-ui';
    /** UI version that created the export (from `UI_VERSION`). */
    toolVersion: string;
    /** Number of requests in the export. */
    requestCount: number;
    /** List of included formats. */
    formats: ZipExportFormatEntry[];
    /** Per-request metadata (method, URL, status). */
    entries: ZipExportEntryRecord[];
    /**
     * Per-snippet errors for snippets that could not be generated (partial failure).
     * Empty if the export completed without errors.
     */
    errors: ZipExportErrorRecord[];
    /** Name of the HAR file included in the archive, if the HAR was bundled separately. */
 