/**
 * Derivation layer for ZIP export formats.
 *
 * **No second global registry.** The existence, types, and client info of
 * a snippet format are derived solely from `snippetExportOptions` in
 * `./export.ts`, which in turn uses `HTTPSnippet.availableTargets()` as
 * the single source of truth.
 *
 * This module only adds a small, UI-side overlay map for information that
 * HTTPSnippet itself does not provide:
 *   - `popular`    — pre-selected by default in the picker
 *   - `folderName` — stable, filesystem-friendly folder name
 *   - `extension`  — file extension for the generated snippets
 *
 * When a new target is added to HTTPSnippet it appears automatically with
 * safe defaults; the overlay map may be updated but does not have to be.
 * When a target is removed, its entry disappears automatically as well.
 */
import * as _ from 'lodash';

import {
    SnippetOption,
    snippetExportOptions,
    getCodeSnippetFormatKey,
    getCodeSnippetFormatName
} from './export';

/**
 * Overlay with UI-specific metadata per httpsnippet key (`target~~client`).
 *
 * `satisfies` ensures there are no typos in the entry field names and
 * that `popular` is actually `boolean`; the mapping type accepts arbitrary
 * keys so that a missing entry is not a type error (defaults apply).
 */
type FormatOverlay = {
    folderName: string;
    extension: string;
    popular?: boolean;
};

const FORMAT_OVERLAY = {
    // ── Shell ────────────────────────────────────────────────────────
    'shell~~curl':               { folderName: 'shell-curl',             extension: 'sh',    popular: true  },
    'shell~~httpie':             { folderName: 'shell-httpie',           extension: 'sh',    popular: true  },
    'shell~~wget':               { folderName: 'shell-wget',             extension: 'sh' },

    // ── JavaScript (Browser) ─────────────────────────────────────────
    'javascript~~fetch':         { folderName: 'js-fetch',               extension: 'js',    popular: true  },
    'javascript~~xhr':           { folderName: 'js-xhr',                 extension: 'js' },
    'javascript~~jquery':        { folderName: 'js-jquery',              extension: 'js' },
    'javascript~~axios':         { folderName: 'js-axios',               extension: 'js' },

    // ── Node.js ──────────────────────────────────────────────────────
    'node~~fetch':               { folderName: 'node-fetch',             extension: 'js' },
    'node~~axios':               { folderName: 'node-axios',             extension: 'js',    popular: true  },
    'node~~native':              { folderName: 'node-http',              extension: 'js' },
    'node~~request':             { folderName: 'node-request',           extension: 'js' },
    'node~~unirest':             { folderName: 'node-unirest',           extension: 'js' },

    // ── Python ───────────────────────────────────────────────────────
    'python~~requests':          { folderName: 'python-requests',        extension: 'py',    popular: true  },
    'python~~python3':           { folderName: 'python-http',            extension: 'py' },

    // ── Java ─────────────────────────────────────────────────────────
    'java~~okhttp':              { folderName: 'java-okhttp',            extension: 'java',  popular: true  },
    'java~~unirest':             { folderName: 'java-unirest',           extension: 'java' },
    'java~~asynchttp':           { folderName: 'java-asynchttp',         extension: 'java' },
    'java~~nethttp':             { folderName: 'java-nethttp',           extension: 'java' },

    // ── Kotlin ───────────────────────────────────────────────────────
    'kotlin~~okhttp':            { folderName: 'kotlin-okhttp',          extension: 'kt' },

    // ── C# ───────────────────────────────────────────────────────────
    'csharp~~restsharp':         { folderName: 'csharp-restsharp',       extension: 'cs' },
    'csharp~~httpclient':        { folderName: 'csharp-httpclient',      extension: 'cs' },

    // ── Go / PHP / Ruby / Rust / Swift / ObjC / C / R / OCaml / Clojure ─
    'go~~native':                { folderName: 'go-native',              extension: 'go' },
    'php~~curl':                 { folderName: 'php-curl',               extension: 'php' },
    'php~~http1':                { folderName: 'php-http1',              extension: 'php' },
    'php~~http2':                { folderName: 'php-http2',              extension: 'php' },
    'ruby~~native':              { folderName: 'ruby-native',            extension: 'rb' },
    'ruby~~faraday':             { folderName: 'ruby-faraday',           extension: 'rb' },
    'rust~~reqwest':             { folderName: 'rust-reqwest',           extension: 'rs' },
    'swift~~nsurlsession':       { folderName: 'swift-nsurlsession',     extension: 'swift' },
    'objc~~nsurlsession':        { folderName: 'objc-nsurlsession',      extension: 'm' },
    'c~~libcurl':                { folderName: 'c-libcurl',              extension: 'c' },
    'r~~httr':                   { folderName: 'r-httr',                 extension: 'r' },
    'ocaml~~cohttp':             { folderName: 'ocaml-cohttp',           extension: 'ml' },
    'clojure~~clj_http':         { folderName: 'clojure-clj_http',       extension: 'clj' },

    // ── PowerShell ───────────────────────────────────────────────────
    'powershell~~webrequest':    { folderName: 'powershell-webrequest',  extension: 'ps1',   popular: true  },
    'powershell~~restmethod':    { folderName: 'powershell-restmethod',  extension: 'ps1' },

    // ── HTTP ─────────────────────────────────────────────────────────
    'http~~1.1':                 { folderName: 'http-raw',               extension: 'txt' }
} satisfies Record<string, FormatOverlay>;

/**
 * Extended form of a `SnippetOption` with UI metadata.
 * `id` is identical to `getCodeSnippetFormatKey(option)` (stable string).
 */
export interface ZipExportFormat extends SnippetOption {
    id: string;
    category: string;
    folderName: string;
    extension: string;
    label: string;
    popular: boolean;
}

/** Safe defaults for new HTTPSnippet targets without an overlay entry. */
function deriveFolderName(option: SnippetOption): string {
    // Lowercase is consistent with all maintained overlay values and
    // matches the convention for filesystem folders in the archive.
    return `${option.target}-${option.client}`
        .toLowerCase()
        .replace(/[^a-z0-9._-]+/g, '-');
}
function deriveExtension(option: SnippetOption): string {
    // Intentionally conservative: when we have no information, use .txt.
    return 'txt';
}

/** Converts a `SnippetOption` + category into a `ZipExportFormat`. */
function toZipExportFormat(option: SnippetOption, category: string): ZipExportFormat {
    const id = getCodeSnippetFormatKey(option);
    const overlay = (FORMAT_OVERLAY as Record<string, FormatOverlay | undefined>)[id];
    return {
        ...option,
        id,
        category,
        label: getCodeSnippetFormatName(option),
        folderName: overlay?.folderName ?? deriveFolderName(option),
        extension: overlay?.extension ?? deriveExtension(option),
        popular: overlay?.popular ?? false
    };
}

/**
 * Complete list of all currently available export formats, derived from
 * `snippetExportOptions`. Stable ordering: categories alphabetically,
 * within a category the HTTPSnippet order.
 */
export const ALL_ZIP_EXPORT_FORMATS: ReadonlyArray<ZipExportFormat> = _(snippetExportOptions)
    .toPairs()
    .flatMap(([category, options]) => options.map((o) => toZipExportFormat(o, category)))
    .value();

/** Formats grouped by category, for UI rendering. */
export const ZIP_EXPORT_FORMATS_BY_CATEGORY: Readonly<Record<string, ZipExportFormat[]>> =
    _.groupBy(ALL_ZIP_EXPORT_FORMATS, 'category');

/** Categories in display order. */
export const ZIP_EXPORT_CATEGORIES: ReadonlyArray<string> =
    Object.keys(ZIP_EXPORT_FORMATS_BY_CATEGORY);

/** Default pre-selected IDs ("Popular"). */
export const DEFAULT_SELECTED_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_ZIP_EXPORT_FORMATS.filter(f => f.popular).map(f => f.id)
);

/** All IDs as a Set — useful for "Select all". */
export const ALL_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_ZIP_EXPORT_FORMATS.map(f => f.id)
);

/** Fast lookup by ID. */
export const FORMAT_BY_ID: ReadonlyMap<string, ZipExportFormat> = new Map(
    ALL_ZIP_EXPORT_FORMATS.map(f => [f.id, f])
);

/**
 * Resolves a set of IDs into format definitions.
 * Unknown IDs are silently skipped (robust against persisted IDs left
 * over from deleted HTTPSnippet targets after an update).
 */
export function resolveFormats(ids: Iterable<string>): ZipExportFormat[] {
    const result: ZipExportFormat[] = [];
    for (const id of ids) {
        const fmt = FORMAT_BY_ID.get(id);
        if (fmt) result.push(fmt);
    }
    return result;
}

/**
 * Filters persisted IDs down to currently valid ones. Useful when
 * hydrating the UI store: stale or broken IDs are discarded so the
 * picker always starts in a consistent state.
 */
export function sanitizeFormatIds(ids: Iterable<string>): string[] {
    const out: string[] = [];
    for (const id of ids) {
        if (typeof id === 'string' && FORMAT_BY_ID.has(id)) out.push(id);
    }
    return out;
}
                                                                                                                                                                                                                       