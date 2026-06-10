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
            cancelled: false,
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
            cancelled: false,
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
            expect(controller.state.snippetErrorCount).to.equal(0);
            expect(controller.state.downloadName).to.match(/\.zip$/);
            expect(controller.state.downloadBytes).to.equal(2);
        }
    });

    it('reset invalidates an in-flight run, so a later completion cannot mutate state', async () => {
        const exportDeferred = getDeferred<any>();
        exportAsZipStub.returns(exportDeferred.promise);

        const controller = makeController();
        const runPromise = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl']
        });
        await Promise.resolve();

        controller.reset();
        expect(controller.state.kind).to.equal('idle');

        exportDeferred.resolve({
            archive: new ArrayBuffer(1),
            cancelled: false,
            snippetSuccessCount: 1,
            snippetErrorCount: 0,
            errors: []
        });
        await runPromise;

        expect(controller.state.kind).to.equal('idle');
        expect(saveFileStub.called).to.equal(false);
    });

    it('dispose aborts mid-generation, and the eventual result is ignored', async () => {
        const exportDeferred = getDeferred<any>();
        exportAsZipStub.returns(exportDeferred.promise);

        const controller = makeController();
        const runPromise = controller.run({
            events: [] as any,
            formatIds: ['shell~~curl']
        });
        await Promise.resolve();

        const signal = exportAsZipStub.firstCall.args[0].signal as AbortSignal;
        expect(signal.aborted).to.equal(false);

        controller.dispose();
        expect(signal.aborted).to.equal(true);

        exportDeferred.resolve({
            archive: new ArrayBuffer(1),
            cancelled: false,
            snippetSuccessCount: 1,
            snippetErrorCount: 0,
            errors: []
        });
        await runPromise;

        expect(saveFileStub.called).to.equal(false);
    });
});
