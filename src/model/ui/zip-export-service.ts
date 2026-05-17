/**
 * Orchestrates ZIP export from the UI: builds the HAR, invokes the worker,
 * tracks progress, and triggers the download.
 */
import { action, observable, runInAction, toJS } from 'mobx';

import { ViewableEvent } from '../../types';
import * as harModel from '../http/har';
import { UI_VERSION } from '../../services/service-versions';
import { logError } from '../../errors';
import { saveFile } from '../../util/ui';

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
        downloadName: string,
        downloadBytes: number
    };

type ZipExportDependencies = {
    generateHar: typeof harModel.generateHar;
    exportAsZip: typeof workerApi.exportAsZip;
    saveFile: typeof saveFile;
};

const DEFAULT_ZIP_EXPORT_DEPENDENCIES: ZipExportDependencies = {
    generateHar: harModel.generateHar,
    exportAsZip: workerApi.exportAsZip,
    saveFile
};

export class ZipExportController {
    @observable state: ZipExportState = { kind: 'idle' };
    private abortController: AbortController | undefined;
    private activeRunId = 0;

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

    @action.bound
    dispose() {
        this.invalidateActiveRun();
        this.abortActiveRun();
    }

    @action.bound
    cancel() {
        this.invalidateActiveRun();
        this.abortActiveRun();

        if (this.isBusy) {
            this.state = { kind: 'cancelled' };
        }
    }

    /**
     * Runs an export. Event & format input is snapshotted up front, and each
     * invocation gets its own run id, invalidating older runs, so stale async
     * completions can't update UI state after a cancel/retry/reset.
     */
    @action.bound
    async run(args: {
        events: ReadonlyArray<ViewableEvent>;
        formatIds: Iterable<string>;
    }): Promise<void> {
        this.abortActiveRun();
        const runId = this.invalidateActiveRun();

        const eventsSnapshot = args.events.slice();
        const formatSnapshot: ZipExportFormat[] = resolveFormats(args.formatIds);

        const runAbortController = new AbortController();
        this.abortController = runAbortController;
        this.state = { kind: 'preparing' };

        try {
            const harObservable = await this.deps.generateHar(eventsSnapshot, { bodySizeLimit: Infinity });
            if (!this.isCurrentRun(runId, runAbortController)) return;

            const har = toJS(harObservable);

            if (!har.log.entries.length) {
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

            runInAction(() => {
                if (!this.isCurrentRun(runId, runAbortController)) return;
                this.state = {
                    kind: 'running',
                    percent: 0,
                    stage: 'preparing',
                    totalRequests: har.log.entries.length
                };
            });

            const response = await this.deps.exportAsZip({
                har,
                formats,
                toolVersion: UI_VERSION,
                signal: runAbortController.signal,
                onProgress: (p) => {
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

            if (!this.isCurrentRun(runId, runAbortController)) return;

            if (response.cancelled) {
                runInAction(() => {
                    if (this.isCurrentRun(runId, runAbortController)) {
                        this.state = { kind: 'cancelled' };
                    }
                });
                return;
            }

            const filename = buildArchiveFilename();
            this.deps.saveFile(
                filename,
                'application/zip',
                Buffer.from(response.archive)
            );

            runInAction(() => {
                if (!this.isCurrentRun(runId, runAbortController)) return;
                this.state = {
                    kind: 'done',
                    snippetSuccessCount: response.snippetSuccessCount,
                    snippetErrorCount: response.snippetErrorCount,
                    downloadName: filename,
                    downloadBytes: response.archive.byteLength
                };
            });
        } catch (e: any) {
            if (!this.isCurrentRun(runId, runAbortController)) return;

            if (e && e.name === 'AbortError') {
                runInAction(() => {
                    if (this.isCurrentRun(runId, runAbortController)) {
                        this.state = { kind: 'cancelled' };
                    }
                });
                return;
            }

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
            }
        }
    }

    @action.bound
    reset() {
        this.invalidateActiveRun();
        this.abortActiveRun();
        this.state = { kind: 'idle' };
    }
}
