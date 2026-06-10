import { expect } from '../../../test-setup';
import * as sinon from 'sinon';

import { ZipExportController } from '../../../../src/model/ui/zip-export-service';

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
    let generateHarStub: sinon.SinonStub;
    let exportAsZipStub: sinon.SinonStub;
    let saveFileStub: sinon.SinonStub;

    const makeController = () => new ZipExportController({
        generateHar: generateHarStub as any,
        exportAsZip: exportAsZipStub as any,
        saveFile: saveFileStub as any
    });

    beforeEach(() => {
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
            formatIds: ['shell~~curl']
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
            formatIds: ['shell~~curl']
        });
        await Promise.resolve();

        const secondRun = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl']
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
            formatIds: ['shell~~curl']
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
            formatIds: ['shell~~curl']
        });

        expect(saveFileStub.called).to.equal(false);
        expect(controller.state.kind).to.equal('error');
        if (controller.state.kind === 'error') {
            expect(controller.state.message).to.equal('Worker exploded');
        }
    });
});
