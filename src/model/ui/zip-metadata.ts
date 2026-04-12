/**
 * Metadata schema and builder for _metadata.json inside ZIP exports.
 */
import { UI_VERSION } from '../../services/service-versions';
import type { SnippetFormatDefinition } from './snippet-formats';

export interface ZipMetadata {
    /** ISO 8601 timestamp of the export */
    exportedAt: string;
    /** Number of HTTP exchanges included */
    exchangeCount: number;
    /** HTTP Toolkit UI version string */
    httptoolkitVersion: string;
    /** List of format folder names included in the archive */
    formats: string[];
    /** Explains the archive structure to users who open _metadata.json */
    contents: {
        snippetFolders: string;
        harFile: string;
    };
}

/**
 * Builds the metadata object for the ZIP archive.
 * This is serialized as `_metadata.json` at the root of the archive.
 */
export function buildZipMetadata(
    exchangeCount: number,
    formats: SnippetFormatDefinition[]
): ZipMetadata {
    return {
        exportedAt: new Date().toISOString(),
        exchangeCount,
        httptoolkitVersion: UI_VERSION,
        formats: formats.map(f => f.folderName),
        contents: {
            snippetFolders: 'Each folder contains code snippets to reproduce the requests (request only)',
            harFile: 'The .har file contains the full network traffic: requests AND responses with headers, bodies, and timings'
        }
    };
}
