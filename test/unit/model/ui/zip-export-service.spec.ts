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

    beforeEach(() => {
        generateHarStub = sinon.stub().resolves(makeHar());
        exportAsZipStub = sinon.stub();

        if (!window.URL.createObjectURL) {
            (window.URL as any).createObjectURL = () => 'blob:test';
        }
        if (!window.URL.revokeObjectURL) {
            (window.URL as any).revokeObjectURL = () => {};
        }

        sinon.stub(window.URL, 'createObjectURL').returns('blob:test');
        sinon.stub(window.URL, 'revokeObjectURL').callsFake(() => {});
        sinon.stub(HTMLAnchorElement.prototype, 'click').callsFake(() => {});
    });

    afterEach(() => {
        sinon.restore();
    });

    it('ignores stale successful completions from a previous run after retry', async () => {
        const firstExport = getDeferred<any>();
        const secondExport = getDeferred<any>();
        exportAsZipStub.onFirstCall().returns(firstExport.promise);
        exportAsZipStub.returns(secondExport.promise);

        const controller = new ZipExportController({
            generateHar: generateHarStub as any,
            exportAsZip: exportAsZipStub as any
        });

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
            snippetErrorCount: 0
        });
        await firstRun;

        expect((window.URL.createObjectURL as sinon.SinonStub).called).to.equal(false);
        expect(controller.state.kind).to.equal('running');

        secondExport.resolve({
            archive: new ArrayBuffer(2),
            cancelled: false,
            snippetSuccessCount: 2,
            snippetErrorCount: 0
        });
        await secondRun;

        expect(exportAsZipStub.callCount).to.equal(2);
        expect((window.URL.createObjectURL as sinon.SinonStub).calledOnce).to.equal(true);
        expect(controller.state.kind).to.equal('done');
        if (controller.state.kind === 'done') {
            expect(controller.state.snippetSuccessCount).to.equal(2);
            expect(controller.state.snippetErrorCount).to.equal(0);
            expect(controller.state.downloadUrl).to.equal('blob:test');
            expect(controller.state.downloadName).to.match(/\.zip$/);
            expect(controller.state.downloadBytes).to.equal(2);
            expect(controller.state.autoDownloadAttempted).to.equal(true);
        }
    });

    it('reset invalidates an in-flight run so later completion cannot mutate state', async () => {
        const exportDeferred = getDeferred<any>();
        exportAsZipStub.returns(exportDeferred.promise);

        const controller = new ZipExportController({
            generateHar: generateHarStub as any,
            exportAsZip: exportAsZipStub as any
        });
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
            snippetErrorCount: 0
        });
        await runPromise;

        expect(controller.state.kind).to.equal('idle');
        expect((window.URL.createObjectU