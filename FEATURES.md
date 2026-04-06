# ZIP Export & Batch Selection — Feature Documentation

## Overview

This contribution implements two features requested by @pimterry:

- **Batch Export / Multi-Select** ([#76](https://github.com/httptoolkit/httptoolkit/issues/76)) — Select multiple HTTP exchanges via Ctrl+Click, Shift+Click, Ctrl+A and export them together
- **ZIP Export** ([#867](https://github.com/httptoolkit/httptoolkit/issues/867)) — Export code snippets in up to 37 formats as a ZIP archive

Both features originated from the [Ghost Collector discussion](https://github.com/httptoolkit/httptoolkit/issues/866#issuecomment-4060468086), where @pimterry suggested integrating bulk export directly into the app using `@httptoolkit/httpsnippet` and `fflate`, with heavy processing offloaded to a Web Worker.

## Architecture

```
User clicks "Export ZIP"
       │
       ▼
┌─────────────────────┐
│  UI Component        │  ZipDownloadPanel / SelectionToolbar / ExportAsZipButton
│  (Main Thread)       │  ── Format selection from UiStore (shared, persisted)
│                      │  ── Converts exchanges to HAR via generateHar()
│                      │  ── Calls generateZipInWorker()
└──────────┬──────────┘
           │ postMessage (HAR entries + format definitions)
           ▼
┌─────────────────────┐
│  Web Worker          │  ui-worker.ts → 'generateZip' case
│  (Background Thread) │  ── Iterates formats × entries
│                      │  ── Generates snippets via HTTPSnippet
│                      │  ── Reports progress every 5%
│                      │  ── Compresses with fflate (level 6)
│                      │  ── Transfers ArrayBuffer back (zero-copy)
└──────────┬──────────┘
           │ postMessage (ArrayBuffer + error counts)
           ▼
┌─────────────────────┐
│  Browser Download    │  downloadBlob() triggers save dialog
└─────────────────────┘
```

## Files Added

| File | Purpose |
|------|---------|
| `src/model/ui/snippet-formats.ts` | Central registry of all 37 HTTPSnippet formats with categories, extensions, labels |
| `src/model/ui/zip-metadata.ts` | Metadata builder for `_metadata.json` inside ZIP archives |
| `src/util/export-filenames.ts` | Safe filename generation following HTTPToolkit naming conventions |
| `src/util/download.ts` | Browser download utility (Blob → save dialog) |
| `src/components/view/zip-download-panel.tsx` | Format picker UI with checkboxes, category grouping, quick actions |
| `src/components/view/selection-toolbar.tsx` | Multi-select batch toolbar with HAR + ZIP export |
| `test/unit/util/export-filenames.spec.ts` | Unit tests for filename generation |
| `test/unit/model/ui/snippet-formats.spec.ts` | Unit tests for snippet format definitions |
| `automation/webpack.fast.ts` | Lean dev build config (no Monaco, no type-checking, ~60s) |
| `automation/webpack.test.ts` | Test-specific webpack config |
| `FEATURES.md` | This file — architecture documentation |

## Files Modified

| File | Changes |
|------|---------|
| `src/model/ui/ui-store.ts` | Added `_zipFormatIds` (persisted), `zipFormatIds` getter, `setZipFormatIds()` |
| `src/services/ui-worker.ts` | Added `generateZip` message handler with snippet generation + fflate compression |
| `src/services/ui-worker-api.ts` | Added `generateZipInWorker()` with 5-min timeout, progress callbacks, cleanup |
| `src/components/view/http/http-export-card.tsx` | Added "ZIP (Selected Formats)" option to export dropdown |
| `src/components/view/view-event-list-buttons.tsx` | Added `ExportAsZipButton` to footer |
| `src/components/view/view-event-list-footer.tsx` | Added `ExportAsZipButton` to footer bar |
| `src/components/view/view-event-list.tsx` | Multi-select highlighting, Ctrl+Click/Shift+Click handling, aria-selected |
| `src/components/view/view-page.tsx` | Integrated `SelectionToolbar` |
| `src/model/events/events-store.ts` | Added selection state (`selectedExchangeIds`, `selectExchange`, etc.) |
| `src/components/editor/base-editor.tsx` | Guard for `jsonDefaults` when Monaco JSON support not loaded |
| `src/util/ui.ts` | Added `isCmdCtrlPressed` utility |
| `automation/webpack.common.ts` | Added `vm: false` polyfill fallback |
| `package.json` | Added `fflate` dependency |
| `package-lock.json` | Lock file updated for `fflate` |
| `.gitignore` | Excluded local dev/test files |

## ZIP Archive Structure

```
HTTPToolkit_2026-04-06_14-30_180-requests.zip
├── shell-curl/
│   ├── 001_GET_200_api.github.com.sh
│   ├── 002_POST_201_httpbin.org.sh
│   └── ...
├── python-requests/
│   ├── 001_GET_200_api.github.com.py
│   └── ...
├── ... (37 format folders)
├── HTTPToolkit_180-requests_full-traffic.har   ← Complete traffic (requests + responses)
├── _metadata.json                              ← Export info, format list, content guide
└── _errors.json                                ← Only if any snippets failed
```

## Snippet Filename Convention

```
{index}_{METHOD}_{STATUS}_{hostname}.{ext}
  001     GET      200    api.github.com  .sh
```

Follows HTTPToolkit's existing HAR export pattern (`{METHOD} {hostname}.har`), extended with index and status for sortability.

## Supported Formats (37)

**Shell**: cURL, HTTPie, Wget
**JavaScript**: Fetch API, XMLHttpRequest, jQuery, Axios
**Node.js**: node-fetch, Axios, HTTP module, Request, Unirest
**Python**: Requests, http.client
**Java**: OkHttp, Unirest, AsyncHttp, HttpClient
**Kotlin**: OkHttp
**C#**: RestSharp, HttpClient
**Go**: net/http
**PHP**: ext-cURL, HTTP v1, HTTP v2
**Ruby**: Net::HTTP, Faraday
**Rust**: reqwest
**Swift**: URLSession
**Objective-C**: NSURLSession
**C**: libcurl
**R**: httr
**OCaml**: CoHTTP
**Clojure**: clj-http
**PowerShell**: Invoke-WebRequest, Invoke-RestMethod
**HTTP**: Raw HTTP/1.1

## Key Design Decisions

1. **fflate over JSZip** — As recommended by @pimterry. Faster and smaller bundle.

2. **Web Worker for all ZIP generation** — All snippet generation and compression runs off-thread. The UI shows a progress bar and never freezes, even with thousands of requests.

3. **Shared format selection via UiStore** — The user's format choices persist across sessions and are shared between the Export Card (single exchange), the batch SelectionToolbar, and the footer ExportAsZipButton.

4. **ZIP in dropdown, not in context menu** — Per @pimterry's guidance: "it's awkward UX to have a submenu where most items copy, but one item downloads an entire zip."

5. **Error resilience** — If a snippet fails (e.g., Clojure's clj_http with certain JSON arrays), the export continues. Failed snippets are logged in `_errors.json` with full context.

## Testing

Run unit tests via Karma (the project's existing test runner):
```bash
npm run test:unit
```

For fast development builds (no Monaco, no type-checking, ~60s):
```bash
npx env-cmd -f ./automation/ts-node.env.js npx webpack --config ./automation/webpack.fast.ts
```

## Known Limitations

- **Clojure clj_http**: Crashes on JSON array bodies (`[{...}]`). This is an upstream bug in `@httptoolkit/httpsnippet`, not in this code. The error is caught and documented in `_errors.json`.
- **Crystal**: Commented out — target not available in the current httpsnippet version.
