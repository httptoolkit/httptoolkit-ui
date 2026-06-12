/**
 * Orchestrates ZIP export from the UI: builds the HAR, invokes the worker,
 * and triggers the download.
 */
import { action, observable, runInAction, toJS } from 'mobx';

import { ViewableEvent } from '../../types';
import * as harModel from '../http/har';
import { UI_VERSION } from '../../services/service-versions';
import { logError } from '../../errors';
import { saveFile } from '../../util/ui';

import * as workerApi from '../../services/ui-worker-api';

import { buildArchiveFilename } from '../../util/export-filenames';

export type ZipExportState =
    | { kind: 'idle' }
    | { kind: 'running' }
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

    // Bumped by each run() and by dispose(), so that completions of
    // superseded runs can't trigger downloads or update UI state:
    private runVersion = 0;

    constructor(
        private readonly deps: ZipExportDependencies = DEFAULT_ZIP_EXPORT_DEPENDENCIES
    ) {}

    @action.bound
    dispose() {
        this.runVersion += 1;
    }

    @action.bound
    async run(args: {
        events: ReadonlyArray<ViewableEvent>;
        formatIds: Iterable<string>;
        includeHar: boolean;
    }): Promise<void> {
        const version = ++this.runVersion;

        const eventsSnapshot = args.events.slice();
        const formatIds = Array.from(args.formatIds);

        this.state = { kind: 'running' };

        try {
            const harObservable = await this.deps.generateHar(eventsSnapshot, { bodySizeLimit: Infinity });
            if (version !== this.runVersion) return;

            const har = toJS(harObservable);

            const response = await this.deps.exportAsZip({
                har,
                formatIds,
                includeHar: args.includeHar,
                httpToolkitVersion: UI_VERSION
            });
            if (version !== this.runVersion) return;

            if (response.snippetErrorCount > 0) {
                // Report snippet generation failures, but without the URLs,
                // which may contain sensitive user data:
                logError('Some snippets failed during ZIP export', {
                    failedCount: response.snippetErrorCount,
                    successCount: response.snippetSuccessCount,
                    errors: response.errors.slice(0, 10).map(e => ({
                        format: e.formatId,
                        error: e.error
                    }))
                });
            }

            const filename = buildArchiveFilename();
            this.deps.saveFile(
                filename,
                'application/zip',
                Buffer.from(response.archive)
            );

            runInAction(() => {
                this.state = {
                    kind: 'done',
                    snippetSuccessCount: response.snippetSuccessCount,
                    snippetErrorCount: response.snippetErrorCount,
                    downloadName: filename,
                    downloadBytes: response.archive.byteLength
                };
            });
        } catch (e: any) {
            if (version !== this.runVersion) return;

            logError(e);
            runInAction(() => {
                this.state = {
                    kind: 'error',
                    message: e && e.message
                        ? String(e.message)
                        : 'Unknown error during ZIP export.'
                };
            });
        }
    }
}
