/**
 * Snippet format registry — single source of truth for all export formats.
 *
 * Contains ALL available HTTPSnippet targets/clients organized by language
 * category. The ZIP export pipeline, format picker UI, and batch toolbar
 * all consume this registry.
 */
import * as HTTPSnippet from '@httptoolkit/httpsnippet';

// ── Sentinel key for the "ZIP (Selected Formats)" meta-option ───────────────
export const ZIP_ALL_FORMAT_KEY = '__zip_all__' as const;

// ── Format definition used by the ZIP generation pipeline ────────────────────
export interface SnippetFormatDefinition {
    /** Unique ID, e.g. 'shell_curl' */
    id: string;
    /** Language category for grouping in the format picker */
    category: string;
    /** Folder name inside the ZIP archive */
    folderName: string;
    /** File extension for generated snippets */
    extension: string;
    /** httpsnippet target identifier */
    target: HTTPSnippet.Target;
    /** httpsnippet client identifier */
    client: HTTPSnippet.Client;
    /** Human-readable label */
    label: string;
    /** Whether this is a "popular" format (pre-checked in format picker) */
    popular: boolean;
}

/**
 * Complete registry of all HTTPSnippet-supported formats.
 * Organized by language category for clean grouping in the UI.
 */
export const ALL_SNIPPET_FORMATS: SnippetFormatDefinition[] = [
    // ── Shell ────────────────────────────────────────────────────────────
    {
        id: 'shell_curl', category: 'Shell', folderName: 'shell-curl',
        extension: 'sh', target: 'shell', client: 'curl',
        label: 'cURL', popular: true
    },
    {
        id: 'shell_httpie', category: 'Shell', folderName: 'shell-httpie',
        extension: 'sh', target: 'shell', client: 'httpie',
        label: 'HTTPie', popular: true
    },
    {
        id: 'shell_wget', category: 'Shell', folderName: 'shell-wget',
        extension: 'sh', target: 'shell', client: 'wget',
        label: 'Wget', popular: false
    },

    // ── JavaScript (Browser) ─────────────────────────────────────────────
    {
        id: 'javascript_fetch', category: 'JavaScript', folderName: 'js-fetch',
        extension: 'js', target: 'javascript', client: 'fetch',
        label: 'Fetch API', popular: true
    },
    {
        id: 'javascript_xhr', category: 'JavaScript', folderName: 'js-xhr',
        extension: 'js', target: 'javascript', client: 'xhr',
        label: 'XMLHttpRequest', popular: false
    },
    {
        id: 'javascript_jquery', category: 'JavaScript', folderName: 'js-jquery',
        extension: 'js', target: 'javascript', client: 'jquery',
        label: 'jQuery', popular: false
    },
    {
        id: 'javascript_axios', category: 'JavaScript', folderName: 'js-axios',
        extension: 'js', target: 'javascript', client: 'axios',
        label: 'Axios', popular: false
    },

    // ── Node.js ──────────────────────────────────────────────────────────
    {
        id: 'node_fetch', category: 'Node.js', folderName: 'node-fetch',
        extension: 'js', target: 'node', client: 'fetch',
        label: 'node-fetch', popular: false
    },
    {
        id: 'node_axios', category: 'Node.js', folderName: 'node-axios',
        extension: 'js', target: 'node', client: 'axios',
        label: 'Axios', popular: true
    },
    {
        id: 'node_native', category: 'Node.js', folderName: 'node-http',
        extension: 'js', target: 'node', client: 'native',
        label: 'HTTP module', popular: false
    },
    {
        id: 'node_request', category: 'Node.js', folderName: 'node-request',
        extension: 'js', target: 'node', client: 'request',
        label: 'Request', popular: false
    },
    {
        id: 'node_unirest', category: 'Node.js', folderName: 'node-unirest',
        extension: 'js', target: 'node', client: 'unirest',
        label: 'Unirest', popular: false
    },

    // ── Python ───────────────────────────────────────────────────────────
    {
        id: 'python_requests', category: 'Python', folderName: 'python-requests',
        extension: 'py', target: 'python', client: 'requests',
        label: 'Requests', popular: true
    },
    {
        id: 'python_python3', category: 'Python', folderName: 'python-http',
        extension: 'py', target: 'python', client: 'python3',
        label: 'http.client', popular: false
    },

    // ── Java ─────────────────────────────────────────────────────────────
    {
        id: 'java_okhttp', category: 'Java', folderName: 'java-okhttp',
        extension: 'java', target: 'java', client: 'okhttp',
        label: 'OkHttp', popular: true
    },
    {
        id: 'java_unirest', category: 'Java', folderName: 'java-unirest',
        extension: 'java', target: 'java', client: 'unirest',
        label: 'Unirest', popular: false
    },
    {
        id: 'java_asynchttp', category: 'Java', folderName: 'java-asynchttp',
        extension: 'java', target: 'java', client: 'asynchttp',
        label: 'AsyncHttp', popular: false
    },
    {
        id: 'java_nethttp', category: 'Java', folderName: 'java-nethttp',
        extension: 'java', target: 'java', client: 'nethttp',
        label: 'HttpClient', popular: false
    },

    // ── Kotlin ───────────────────────────────────────────────────────────
    {
        id: 'kotlin_okhttp', category: 'Kotlin', folderName: 'kotlin-okhttp',
        extension: 'kt', target: 'kotlin' as HTTPSnippet.Target, client: 'okhttp',
        label: 'OkHttp', popular: false
    },

    // ── C# ───────────────────────────────────────────────────────────────
    {
        id: 'csharp_restsharp', category: 'C#', folderName: 'csharp-restsharp',
        extension: 'cs', target: 'csharp', client: 'restsharp',
        label: 'RestSharp', popular: false
    },
    {
        id: 'csharp_httpclient', category: 'C#', folderName: 'csharp-httpclient',
        extension: 'cs', target: 'csharp', client: 'httpclient',
        label: 'HttpClient', popular: false
    },

    // ── Go ───────────────────────────────────────────────────────────────
    {
        id: 'go_native', category: 'Go', folderName: 'go-native',
        extension: 'go', target: 'go', client: 'native',
        label: 'net/http', popular: false
    },

    // ── PHP ──────────────────────────────────────────────────────────────
    {
        id: 'php_curl', category: 'PHP', folderName: 'php-curl',
        extension: 'php', target: 'php', client: 'curl',
        label: 'ext-cURL', popular: false
    },
    {
        id: 'php_http1', category: 'PHP', folderName: 'php-http1',
        extension: 'php', target: 'php', client: 'http1',
        label: 'HTTP v1', popular: false
    },
    {
        id: 'php_http2', category: 'PHP', folderName: 'php-http2',
        extension: 'php', target: 'php', client: 'http2',
        label: 'HTTP v2', popular: false
    },

    // ── Ruby ─────────────────────────────────────────────────────────────
    {
        id: 'ruby_native', category: 'Ruby', folderName: 'ruby-native',
        extension: 'rb', target: 'ruby', client: 'native',
        label: 'Net::HTTP', popular: false
    },
    {
        id: 'ruby_faraday', category: 'Ruby', folderName: 'ruby-faraday',
        extension: 'rb', target: 'ruby', client: 'faraday',
        label: 'Faraday', popular: false
    },

    // ── Rust ─────────────────────────────────────────────────────────────
    {
        id: 'rust_reqwest', category: 'Rust', folderName: 'rust-reqwest',
        extension: 'rs', target: 'rust' as HTTPSnippet.Target, client: 'reqwest',
        label: 'reqwest', popular: false
    },

    // ── Swift ────────────────────────────────────────────────────────────
    {
        id: 'swift_nsurlsession', category: 'Swift', folderName: 'swift-nsurlsession',
        extension: 'swift', target: 'swift', client: 'nsurlsession',
        label: 'URLSession', popular: false
    },

    // ── Objective-C ──────────────────────────────────────────────────────
    {
        id: 'objc_nsurlsession', category: 'Objective-C', folderName: 'objc-nsurlsession',
        extension: 'm', target: 'objc', client: 'nsurlsession',
        label: 'NSURLSession', popular: false
    },

    // ── C ────────────────────────────────────────────────────────────────
    {
        id: 'c_libcurl', category: 'C', folderName: 'c-libcurl',
        extension: 'c', target: 'c', client: 'libcurl',
        label: 'libcurl', popular: false
    },

    // ── R ────────────────────────────────────────────────────────────────
    {
        id: 'r_httr', category: 'R', folderName: 'r-httr',
        extension: 'r', target: 'r' as HTTPSnippet.Target, client: 'httr',
        label: 'httr', popular: false
    },

    // ── OCaml ────────────────────────────────────────────────────────────
    {
        id: 'ocaml_cohttp', category: 'OCaml', folderName: 'ocaml-cohttp',
        extension: 'ml', target: 'ocaml', client: 'cohttp',
        label: 'CoHTTP', popular: false
    },

    // ── Clojure ──────────────────────────────────────────────────────────
    {
        id: 'clojure_clj_http', category: 'Clojure', folderName: 'clojure-clj_http',
        extension: 'clj', target: 'clojure', client: 'clj_http',
        label: 'clj-http', popular: false
    },

    // ── Crystal ──────────────────────────────────────────────────────────
    // Note: Crystal target may not be available in all httpsnippet versions
    // {
    //     id: 'crystal_native', category: 'Crystal', folderName: 'crystal-native',
    //     extension: 'cr', target: 'crystal' as any, client: 'native' as any,
    //     label: 'HTTP::Client', popular: false
    // },

    // ── PowerShell ───────────────────────────────────────────────────────
    {
        id: 'powershell_webrequest', category: 'PowerShell', folderName: 'powershell-webrequest',
        extension: 'ps1', target: 'powershell', client: 'webrequest',
        label: 'Invoke-WebRequest', popular: true
    },
    {
        id: 'powershell_restmethod', category: 'PowerShell', folderName: 'powershell-restmethod',
        extension: 'ps1', target: 'powershell', client: 'restmethod',
        label: 'Invoke-RestMethod', popular: false
    },

    // ── HTTP ─────────────────────────────────────────────────────────────
    {
        id: 'http_1.1', category: 'HTTP', folderName: 'http-raw',
        extension: 'txt', target: 'http' as HTTPSnippet.Target, client: '1.1',
        label: 'Raw HTTP/1.1', popular: false
    },

    // ── Java (RestAssured) ───────────────────────────────────────────────
    // Available in some httpsnippet forks/versions:
    // {
    //     id: 'java_restclient', category: 'Java', folderName: 'java-restclient',
    //     extension: 'java', target: 'java', client: 'restclient' as any,
    //     label: 'RestClient', popular: false
    // },
];

/**
 * Extract unique categories in their original insertion order.
 */
export const FORMAT_CATEGORIES: string[] = [
    ...new Set(ALL_SNIPPET_FORMATS.map(f => f.category))
];

/**
 * Formats grouped by category for UI rendering.
 */
export const FORMATS_BY_CATEGORY: Record<string, SnippetFormatDefinition[]> =
    ALL_SNIPPET_FORMATS.reduce((acc, fmt) => {
        (acc[fmt.category] ??= []).push(fmt);
        return acc;
    }, {} as Record<string, SnippetFormatDefinition[]>);

/**
 * Default set of format IDs pre-selected in the format picker.
 * These are the "popular" formats that most developers use.
 */
export const DEFAULT_SELECTED_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_SNIPPET_FORMATS.filter(f => f.popular).map(f => f.id)
);

/** All format IDs as a set (for "select all") */
export const ALL_FORMAT_IDS: ReadonlySet<string> = new Set(
    ALL_SNIPPET_FORMATS.map(f => f.id)
);

/** Quick lookup by format ID */
export const FORMAT_BY_ID: ReadonlyMap<string, SnippetFormatDefinition> = new Map(
    ALL_SNIPPET_FORMATS.map(f => [f.id, f])
);

/**
 * Resolve a set of format IDs to their full definitions.
 * Silently skips unknown IDs.
 */
export function resolveFormats(ids: ReadonlySet<string>): SnippetFormatDefinition[] {
    return ALL_SNIPPET_FORMATS.filter(f => ids.has(f.id));
}
