/**
 * Schema for the manifest.json included at the root of every ZIP export.
 * Versioned so consuming tools can check compatibility.
 */

export const ZIP_EXPORT_MANIFEST_VERSION = 1;

// Describes one selected export format, mirroring what was requested:
export interface ZipExportManifestFormat {
    /** Stable ID (`target~~client`, e.g. `shell~~curl`). */
    id: string;
    /** HTTPSnippet target & client. */
    target: string;
    client: string;
    /** Category name (e.g. `Shell`). */
    category: string;
    /** Human-readable label. */
    label: string;
    /** Folder name inside the ZIP archive. */
    folderName: string;
    /** File extension of the generated snippets. */
    extension: string;
}

export interface ZipExportEntryRecord {
    /** Filename in each format folder (without extension), e.g. `01_GET_example.com`. */
    file: string;
    method: string;
    url: string;
    /** Response status (`null` if the request was aborted or failed). */
    status: number | null;
}

// Per-snippet failure details, for snippets that couldn't be generated:
export interface ZipExportErrorRecord {
    /** Base filename of the request in the ZIP (without extension). */
    file: string;
    /** Stable format ID (`target~~client`) for which generation failed. */
    formatId: string;
    format?: string;
    /** Index in the HAR entry array, to locate the entry in requests.har. */
    entryIndex: number;
    method: string;
    url: string;
    status: number | null;
    error: string;
}

export interface ZipExportManifest {
    version: typeof ZIP_EXPORT_MANIFEST_VERSION;
    /** ISO timestamp of generation. */
    generatedAt: string;
    tool: 'httptoolkit-ui';
    toolVersion: string;
    requestCount: number;
    formats: ZipExportManifestFormat[];
    entries: ZipExportEntryRecord[];
    /** Per-snippet errors (partial failure). Empty for fully clean exports. */
    errors: ZipExportErrorRecord[];
}
