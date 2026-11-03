import { expect } from '../../../test-setup';
import * as sinon from 'sinon';

import { ZipExportController } from '../../../../src/model/ui/zip-export-service';
import { getBulkHarExportOptions } from '../../../../src/model/ui/export';

function getDeferred<T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;

    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

function makeHar() {
    return {
        log: {
            version: '1.2',
            creator: { name: 'httptoolkit-ui', version: 'test' },
            entries: [{}],
            _tlsErrors: []
        }
    } as any;
}

describe('ZipExportController', () => {
    let getHarExportOptionsStub: sinon.SinonStub<
        Parameters<typeof getBulkHarExportOptions>,
        ReturnType<typeof getBulkHarExportOptions>
    >;
    let generateHarStub: sinon.SinonStub;
    let exportAsZipStub: sinon.SinonStub;
    let saveFileStub: sinon.SinonStub;

    const makeController = () => new ZipExportController({
        getHarExportOptions: getHarExportOptionsStub,
        generateHar: generateHarStub as any,
        exportAsZip: exportAsZipStub as any,
        saveFile: saveFileStub as any
    });

    beforeEach(() => {
        getHarExportOptionsStub = sinon.stub<
            Parameters<typeof getBulkHarExportOptions>,
            ReturnType<typeof getBulkHarExportOptions>
        >().resolves({ droppedBodies: new Set() });
        generateHarStub = sinon.stub().resolves(makeHar());
        exportAsZipStub = sinon.stub();
        saveFileStub = sinon.stub();
    });

    it('downloads the archive and reports counts on success', async () => {
        exportAsZipStub.resolves({
            archive: new ArrayBuffer(8),
            snippetSuccessCount: 3,
            snippetErrorCount: 0,
            errors: []
        });

        const controller = makeController();
        await controller.run({
            events: [] as any,
            formatIds: ['shell~~curl'],
            includeHar: false
        });

        expect(saveFileStub.calledOnce).to.equal(true);
        expect(controller.state.kind).to.equal('done');
        if (controller.state.kind === 'done') {
            expect(controller.state.snippetSuccessCount).to.equal(3);
            expect(controller.state.snippetErrorCount).to.equal(0);
            expect(controller.state.downloadName).to.match(/\.zip$/);
            expect(controller.state.downloadBytes).to.equal(8);
        }
    });

    it('ignores stale completions from a previous run after a retry', async () => {
        const firstExport = getDeferred<any>();
        const secondExport = getDeferred<any>();
        exportAsZipStub.onFirstCall().returns(firstExport.promise);
        exportAsZipStub.returns(secondExport.promise);

        const controller = makeController();

        const firstRun = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl'],
            includeHar: false
        });
        await Promise.resolve();

        const secondRun = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl'],
            includeHar: false
        });
        await Promise.resolve();

        firstExport.resolve({
            archive: new ArrayBuffer(1),
            snippetSuccessCount: 1,
            snippetErrorCount: 0,
            errors: []
        });
        await firstRun;

        // The first (stale) result must not trigger a download:
        expect(saveFileStub.called).to.equal(false);
        expect(controller.state.kind).to.equal('running');

        secondExport.resolve({
            archive: new ArrayBuffer(2),
            snippetSuccessCount: 2,
            snippetErrorCount: 0,
            errors: []
        });
        await secondRun;

        expect(exportAsZipStub.callCount).to.equal(2);
        expect(saveFileStub.calledOnce).to.equal(true);
        expect(controller.state.kind).to.equal('done');
        if (controller.state.kind === 'done') {
            expect(controller.state.snippetSuccessCount).to.equal(2);
            expect(controller.state.downloadBytes).to.equal(2);
        }
    });

    it('dispose invalidates an in-flight run, so its completion is ignored', async () => {
        const exportDeferred = getDeferred<any>();
        exportAsZipStub.returns(exportDeferred.promise);

        const controller = makeController();
        const runPromise = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl'],
            includeHar: false
        });
        await Promise.resolve();

        controller.dispose();

        exportDeferred.resolve({
            archive: new ArrayBuffer(1),
            snippetSuccessCount: 1,
            snippetErrorCount: 0,
            errors: []
        });
        await runPromise;

        // No download, and no state change from the disposed run:
        expect(saveFileStub.called).to.equal(false);
        expect(controller.state.kind).to.equal('running');
    });

    it('reports worker failures as error state', async () => {
        exportAsZipStub.rejects(new Error('Worker exploded'));

        const controller = makeController();
        await controller.run({
            events: [] as any,
            formatIds: ['shell~~curl'],
            includeHar: false
        });

        expect(saveFileStub.called).to.equal(false);
        expect(controller.state.kind).to.equal('error');
        if (controller.state.kind === 'error') {
            expect(controller.state.message).to.equal('Worker exploded');
        }
    });

    describe('HAR size checks', () => {
        beforeEach(() => {
            exportAsZipStub.resolves({
                archive: new ArrayBuffer(8),
                snippetSuccessCount: 1,
                snippetErrorCount: 0,
                errors: []
            });
        });

        it('uses the checked HAR export options when including the HAR', async () => {
            const controller = makeController();
            await controller.run({ events: [], formatIds: [], includeHar: true });

            expect(getHarExportOptionsStub.calledOnce).to.equal(true);
            expect(generateHarStub.firstCall.args[1]).to.deep.equal({ droppedBodies: new Set() });
            expect(controller.state.kind).to.equal('done');
        });

        it('skips the size check & limits when not including the HAR', async () => {
            const controller = makeController();
            await controller.run({ events: [], formatIds: ['shell~~curl'], includeHar: false });

            expect(getHarExportOptionsStub.called).to.equal(false);
            expect(generateHarStub.firstCall.args[1]).to.deep.equal({});
        });

        it('exports nothing if the HAR export is cancelled', async () => {
            getHarExportOptionsStub.resolves(undefined);

            const controller = makeController();
            await controller.run({ events: [], formatIds: [], includeHar: true });

            expect(generateHarStub.called).to.equal(false);
            expect(exportAsZipStub.called).to.equal(false);
            expect(saveFileStub.called).to.equal(false);
            expect(controller.state.kind).to.equal('idle');
        });
    });
});
