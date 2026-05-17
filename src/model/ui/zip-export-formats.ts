/**
 * ZIP export format definitions, derived from `snippetExportOptions` (and
 * thereby from `HTTPSnippet.availableTargets()`) as the single source of
 * truth. This module only adds the ZIP-specific presentation details:
 * archive folder names, file extensions, and the default picker selection.
 */
import * as _ from 'lodash';
import * as HTTPSnippet from '@httptoolkit/httpsnippet';

import {
    SnippetOption,
    snippetExportOptions,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName
} from './export';

// Formats that are preselected in the picker by default:
const POPULAR_FORMAT_IDS: ReadonlySet<string> = new Set([
    'shell~~curl',
    'shell~~httpie',
    'javascript~~fetch',
    'node~~axios',
    'python~~requests',
    'java~~okhttp',
    'powershell~~webrequest'
]);

// Snippet file extension per target (e.g. python -> py), as reported by
// HTTPSnippet itself:
const TARGET_EXTENSIONS: ReadonlyMap<string, string> = new Map(
    HTTPSnippet.availableTargets().map(target => [
        target.key as string,
        target.extname.replace(/^\./, '') || 'txt'
    ])
);

export interface ZipExportFormat extends SnippetOption {
    /** Stable ID, identical to `getCodeSnippetFormatKey(option)`. */
    id: string;
    category: string;
    folderName: string;
    extension: string;
    label: string;
    popular: boolean;
}

function toZipExportFormat(option: SnippetOption, category: string): ZipExportFormat {
    const id = getCodeSnippetFormatKey(option);
    return {
        ...option,
        id,
        category,
        label: getCodeSnippetFormatName(option),
        folderName: `${option.target}-${option.client}`
            .toLowerCase()
            .replace(/[^a-z0-9._-]+/g, '-'),
        extension: TARGET_EXTENSIONS.get(option.target as string) ?? 'txt',
        popular: POPULAR_FORMAT_IDS.has(id)
    };
}

/**
 * All currently available export formats. Stable ordering: categories
 * alphabetically, within each category in HTTPSnippet order.
 */
export const ALL_ZIP_EXPORT_FORMATS: ReadonlyArray<ZipExportFormat> = _(snippetExportOptions)
    .toPairs()
    .flatMap(([category, options]) => options.map((o) => toZipExportFormat(o, category)))
    .value();

export const ZIP_EXPORT_FORMATS_BY_CATEGORY: Readonly<Record<string, ZipExportFormat[]>> =
    _.groupBy(ALL_ZIP_EXPORT_FORMATS, 'category');

export const ZIP_EXPORT_CATEGORIES: ReadonlyArray<string> =
    Object.keys(ZIP_EXPORT_FORMATS_BY_CATEGORY);

export const DEFAULT_SELECTED_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_ZIP_EXPORT_FORMATS.filter(f => f.popular).map(f => f.id)
);

export const ALL_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_ZIP_EXPORT_FORMATS.map(f => f.id)
);

export const FORMAT_BY_ID: ReadonlyMap<string, ZipExportFormat> = new Map(
    ALL_ZIP_EXPORT_FORMATS.map(f => [f.id, f])
);

/**
 * Resolves format IDs to format definitions. Unknown IDs are skipped, so
 * persisted selections survive HTTPSnippet target changes after updates.
 */
export function resolveFormats(ids: Iterable<string>): ZipExportFormat[] {
    const result: ZipExportFormat[] = [];
    for (const id of ids) {
        const fmt = FORMAT_BY_ID.get(id);
        if (fmt) result.push(fmt);
    }
    return result;
}
