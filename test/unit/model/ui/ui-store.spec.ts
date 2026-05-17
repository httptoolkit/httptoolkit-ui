import { expect } from '../../../test-setup';

import { UiStore } from '../../../../src/model/ui/ui-store';

describe('UiStore', () => {

    describe('ZIP export modal state', () => {

        it('stores a ZIP export request', () => {
            const uiStore = new UiStore({} as any);
            const events = [{ id: 'event-1' }] as any;

            uiStore.openZipExport(events, '1 request');

            expect(uiStore.zipExportRequest).to.deep.equal({
                events,
                titleSuffix: '1 request'
            });
        });

        it('clears a ZIP export request', () => {
            const uiStore = new UiStore({} as any);

            uiStore.openZipExport([{ id: 'event-1' }] as any);
            uiStore.closeZipExport();

            expect(uiStore.zipExportRequest).to.equal(undefined);
        });

        it('overwrites an existing ZIP export request', () => {
            const uiStore = new UiStore({} as any);
            const firstEvents = [{ id: 'event-1' }] as any;
            const secondEvents = [{ id: 'event-2' }, { id: 'event-3' }] as any;

            uiStore.openZipExport(firstEvents, '1 request');
            uiStore.openZipExport(secondEvents, '2 requests');

            expect(uiStore.zipExportRequest).to.deep.equal({
                events: secondEvents,
                titleSuffix: '2 requests'
            });
        });

    });

});
