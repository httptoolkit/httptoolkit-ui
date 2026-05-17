/**
 * Orchestrates ZIP export from the UI: builds HAR, invokes the worker,
 * tracks progress, and triggers the download.
 *
 * DEBUG: Filter browser console with "[ZIP]" to see each step.
 */
import { action, observable, runInAction, toJS } from 'mobx';

const ZIP_DEBUG = false; // set true to enable debug output (filter browser console with "[ZIP]")
function zipLog(step: string, ...args: unknown[]) {
    if (!ZIP_DEBUG) return;
    console.log(
        `%c[ZIP] ${step}`,
        'color:#1e90ff;font-weight:bold',
        ...args
    );
}
function zipWarn(step: string, ...args: unknown[]) {
    if (!ZIP_DEBUG) return;
    console.warn(`%c[ZIP] ${step}`, 'color:#ff8c00;font-weight:bold', ...args);
}
function zipError(step: string, ...args: unknown[]) {
    if (!ZIP_DEBUG) return;
    console.error(`%c[ZIP] ${step}`, 'color:#ff4444;font-weight:bold', ...args);
}

import { CollectedEvent } from '../../types';
import * as harModel from '../http/har';
import { UI_VERSION } from '../../services/service-versions';
import { logError } from '../../errors';

import * as workerApi from '../../services/ui-worker-api';
import type { ZipExportFormatTriple } from '../../services/ui-worker';

import {
    resolveFormats,
    ZipExportFormat
} from './zip-export-formats';
import { buildArchiveFilename } from '../../util/export-filenames';

export type ZipExportState =
    | { kind: 'idle' }
    | { kind: 'preparing' }
    | {
        kind: 'running',
        percent: number,
        stage: string,
        currentRequest?: number,
        totalRequests?: number
    }
    | { kind: 'cancelled' }
    | { kind: 'error', message: string }
    | {
        kind: 'done',
        snippetSuccessCount: number,
        snippetErrorCount: number,
        downloadUrl: string,
        downloadName: string,
        downloadBytes: number,
        autoDownloadAttempted: boolean
    };

type ZipExportDependencies = {
    generateHar: typeof harModel.generateHar;
    exportAsZip: typeof workerApi.exportAsZip;
};

const DEFAULT_ZIP_EXPORT_DEPENDENCIES: ZipExportDependencies = {
    generateHar: harModel.generateHar,
    exportAsZip: workerApi.exportAsZip
};

export class ZipExportController {
    @observable state: ZipExportState = { kind: 'idle' };
    private abortController: AbortController | undefined;
    private activeRunId = 0;
    private activeDownloadUrl: string | undefined;

    constructor(
        private readonly deps: ZipExportDependencies = DEFAULT_ZIP_EXPORT_DEPENDENCIES
    ) {}

    get isBusy(): boolean {
        return this.state.kind === 'preparing' || this.state.kind === 'running';
    }

    private invalidateActiveRun(): number {
        this.activeRunId += 1;
        return this.activeRunId;
    }

    private isCurrentRun(runId: number, abortController?: AbortController): boolean {
        return this.activeRunId === runId &&
            (!abortController || this.abortController === abortController);
    }

    private abortActiveRun() {
        const activeController = this.abortController;
        this.abortController = undefined;

        if (activeController) {
            try { activeController.abort(); } catch { /* noop */ }
        }
    }

    /**
     * Revokes an existing blob URL if present. Must be called before a new
     * export starts and when the object is disposed.
     */
    private revokeActiveDownloadUrl() {
        if (!this.activeDownloadUrl) return;
        try { window.URL.revokeObjectURL(this.activeDownloadUrl); } catch { /* noop */ }
        this.activeDownloadUrl = undefined;
    }

    /**
     * Cleans up blob URLs. Should be called on dialog unmount to prevent
     * memory leaks.
     */
    @action.bound
    dispose() {
        this.invalidateActiveRun();
        this.abortActiveRun();
        this.revokeActiveDownloadUrl();
    }

    @action.bound
    cancel() {
        this.invalidateActiveRun();
        this.abortActiveRun();
        this.revokeActiveDownloadUrl();

        if (this.isBusy) {
            this.state = { kind: 'cancelled' };
        }
    }

    /**
     * Snapshot-based export: event and format input is copied up front so
     * later observable mutations cannot affect the in-flight run.
     *
     * Every invocation gets its own run id. Older async work is invalidated
     * before the new run starts, so stale completions cannot update UI state
     * or trigger downloads after cancel/retry/reset.
     */
    @action.bound
    async run(args: {
        events: ReadonlyArray<CollectedEvent>;
        formatIds: Iterable<string>;
        snippetBodySizeLimit?: number;
    }): Promise<void> {
        zipLog('run() started', {
            eventCount: args.events.length,
            formatIds: [...args.formatIds]
        });

        this.abortActiveRun();
        this.revokeActiveDownloadUrl();
        const runId = this.invalidateActiveRun();
        zipLog('runId assigned', runId);

        const eventsSnapshot = args.events.slice();
        zipLog('Step 1: events snapshot created', eventsSnapshot.length, 'events');

        const formatSnapshot: ZipExportFormat[] = resolveFormats(args.formatIds);
        zipLog('Step 2: formats resolved', formatSnapshot.map(f => f.id));

        if (formatSnapshot.length === 0) {
            zipWarn('Abort: no formats selected');
            if (this.isCurrentRun(runId)) {
                this.state = { kind: 'error', message: 'No formats selected.' };
            }
            return;
        }

        const runAbortController = new AbortController();
        this.abortController = runAbortController;
        this.state = { kind: 'preparing' };
        zipLog('Step 3: state -> preparing');

        try {
            zipLog('Step 4: generating HAR ...');
            const harObservable = await this.deps.generateHar(eventsSnapshot, { bodySizeLimit: Infinity });
            if (!this.isCurrentRun(runId, runAbortController)) {
                zipWarn('Run stale after generateHar - aborting');
                return;
            }

            const har = toJS(harObservable);
            zipLog('Step 5: HAR ready', har.log.entries.length, 'entries');

            if (!har.log.entries.length) {
                zipWarn('Abort: HAR has no entries');
                runInAction(() => {
                    if (this.isCurrentRun(runId, runAbortController)) {
                        this.state = {
                            kind: 'error',
                            message: 'No exportable HTTP requests selected.'
                        };
                    }
                });
                return;
            }

            const formats: ZipExportFormatTriple[] = formatSnapshot.map((f) => ({
                id: f.id,
                target: f.target as string,
                client: f.client as string,
                category: f.category,
                label: f.label,
                folderName: f.folderName,
                extension: f.extension
            }));
            zipLog('Step 6: ZipExportFormatTriple built', formats.map(f => f.id));

            runInAction(() => {
                if (!this.isCurrentRun(runId, runAbortController)) return;
                this.state = {
                    kind: 'running',
                    percent: 0,
                    stage: 'preparing',
                    totalRequests: har.log.entries.length
                };
            });
            zipLog('Step 7: state -> running (0%)');

            zipLog('Step 8: calling exportAsZip() worker ...');
            const response = await this.deps.exportAsZip({
                har,
                formats,
                toolVersion: UI_VERSION,
                signal: runAbortController.signal,
                snippetBodySizeLimit: args.snippetBodySizeLimit,
                onProgress: (p) => {
                    zipLog(`  Progress: ${p.percent}% | Stage: ${p.stage} | Request: ${p.currentRequest ?? '-'}/${p.totalRequests ?? '-'}`);
                    runInAction(() => {
                        if (!this.isCurrentRun(runId, runAbortController)) return;
                        if (this.state.kind === 'running' || this.state.kind === 'preparing') {
                            this.state = {
                                kind: 'running',
                                percent: p.percent,
                                stage: p.stage,
                                currentRequest: p.currentRequest,
                                totalRequests: p.totalRequests
                            };
                        }
                    });
                }
            });
            zipLog('Step 9: worker response received', {
                cancelled: response.cancelled,
                archiveBytes: response.archive?.byteLength,
                snippetSuccessCount: response.snippetSuccessCount,
                snippetErrorCount: response.snippetErrorCount
            });

            if (!this.isCurrentRun(runId, runAbortController)) {
                zipWarn('Run stale after worker - skipping download');
                return;
            }

            if (response.cancelled) {
                zipWarn('Step 10: worker reports cancelled');
                runInAction(() => {
                    if (this.isCurrentRun(runId, runAbortController)) {
                        this.state = { kind: 'cancelled' };
                    }
                });
                return;
            }

            const filename = buildArchiveFilename();
            zipLog('Step 10: preparing download', filename, response.archive.byteLength, 'bytes');

            // Always create blob + URL and keep it in state. This lets the UI
            // offer a visible fallback link if Chrome rejects the programmatic
            // download trigger due to missing user-gesture trust.
            const blob = new Blob([response.archive], { type: 'application/zip' });
            const url = window.URL.createObjectURL(blob);
            this.activeDownloadUrl = url;

            let autoDownloadAttempted = false;
            try {
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                a.rel = 'noopener';
                // Off-screen instead of display:none - more reliable as click target.
                a.style.position = 'fixed';
                a.style.top = '-9999px';
                a.style.left = '-9999px';
                a.style.opacity = '0';
                document.body.appendChild(a);

                // Chrome accepts a.click() as a download trigger (whitelisted)
                // as long as a user gesture is still active. dispatchEvent()
                // is only used as fallback if a.click() throws.
                let dispatched = false;
                try {
                    a.click();
                    dispatched = true;
                } catch (e) {
                    zipWarn('a.click() failed, trying dispatchEvent fallback', e);
                    try {
                        const clickEvent = new MouseEvent('click', {
                            view: window,
                            bubbles: true,
                            cancelable: true
                        });
                        dispatched = a.dispatchEvent(clickEvent);
                    } catch (e2) { zipWarn('dispatchEvent fallback also failed', e2); }
                }
                autoDownloadAttempted = true;
                zipLog('Step 10a: download trigger attempted', {
                    href: a.href,
                    download: a.download,
                    dispatched
                });

                // Remove anchor later. Do NOT revoke the blob URL here - we
                // keep it on the controller until a new run starts or dispose()
                // is called. This keeps the visible fallback link clickable.
                setTimeout(() => {
                    try { document.body.removeChild(a); } catch { /* noop */ }
                    zipLog('Step 10b: anchor removed (blob URL kept for fallback link)');
                }, 1000);
            } catch (downloadError) {
                zipError('Programmatic download trigger failed - fallback link remains available', downloadError);
                // No throw - the visible link in the 'done' state is sufficient.
            }

            runInAction(() => {
                if (!this.isCurrentRun(runId, runAbortController)) {
                    // Stale run: revoke URL immediately, do NOT touch own state.
                    try { window.URL.revokeObjectURL(url); } catch { /* noop */ }
                    if (this.activeDownloadUrl === url) this.activeDownloadUrl = undefined;
                    return;
                }
                this.state = {
                    kind: 'done',
                    snippetSuccessCount: response.snippetSuccessCount,
                    snippetErrorCount: response.snippetErrorCount,
                    downloadUrl: url,
                    downloadName: filename,
                    downloadBytes: response.archive.byteLength,
                    autoDownloadAttempted
                };
                zipLog('Step 11: DONE', {
                    snippetSuccessCount: response.snippetSuccessCount,
                    snippetErrorCount: response.snippetErrorCount,
                    autoDownloadAttempted
                });
            });
        } catch (e: any) {
            if (!this.isCurrentRun(runId, runAbortController)) return;

            if (e && e.name === 'AbortError') {
                zipWarn('Cancelled (AbortError)');
                runInAction(() => {
                    if (this.isCurrentRun(runId, runAbortController)) {
                        this.state = { kind: 'cancelled' };
                    }
                });
                return;
            }

            zipError('ZIP export error', e);
            logError(e);
            runInAction(() => {
                if (!this.isCurrentRun(runId, runAbortController)) return;
                this.state = {
                    kind: 'error',
                    message: e && e.message
                        ? String(e.message)
                        : 'Unknown error during ZIP export.'
                };
            });
        } finally {
            if (this.isCurrentRun(runId, runAbortController)) {
                this.abortController = undefined;
                zipLog('run() finally: abortController cleaned up');
            }
        }
    }

    @action.bound
    reset() {
        this.invalidateActiveRun();
        this.abortActiveRun();
        this.revokeActiveDownloadUrl();
        this.state = { kind: 'idle' };
    }
}
