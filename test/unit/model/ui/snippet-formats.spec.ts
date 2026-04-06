import { expect } from 'chai';
import {
    ZIP_ALL_FORMAT_KEY,
    SNIPPET_FORMATS,
    SNIPPET_FORMATS_FOR_ZIP,
    SNIPPET_FORMATS_FOR_CONTEXT_MENU,
    SnippetFormatDefinition
} from '../../../../src/model/ui/snippet-formats';

describe('snippet-formats', () => {

    describe('ZIP_ALL_FORMAT_KEY', () => {
        it('is a non-empty string', () => {
            expect(ZIP_ALL_FORMAT_KEY).to.be.a('string');
            expect(ZIP_ALL_FORMAT_KEY.length).to.be.greaterThan(0);
        });

        it('is not a valid httpsnippet target (sentinel)', () => {
            // Sentinel keys should not collide with real target_client IDs
            expect(ZIP_ALL_FORMAT_KEY).to.include('__');
        });
    });

    describe('SNIPPET_FORMATS', () => {
        it('contains at least 4 formats', () => {
            expect(SNIPPET_FORMATS.length).to.be.greaterThanOrEqual(4);
        });

        it('has unique IDs', () => {
            const ids = SNIPPET_FORMATS.map(f => f.id);
            expect(new Set(ids).size).to.equal(ids.length);
        });

        it('has unique folder names', () => {
            const folders = SNIPPET_FORMATS.map(f => f.folderName);
            expect(new Set(folders).size).to.equal(folders.length);
        });

        it('each format has all required fields', () => {
            SNIPPET_FORMATS.forEach((f: SnippetFormatDefinition) => {
                expect(f.id).to.be.a('string').and.not.empty;
                expect(f.folderName).to.be.a('string').and.not.empty;
                expect(f.extension).to.be.a('string').and.not.empty;
                expect(f.target).to.be.a('string').and.not.empty;
                expect(f.client).to.be.a('string').and.not.empty;
                expect(f.label).to.be.a('string').and.not.empty;
                expect(f.includeInContextMenu).to.be.a('boolean');
                expect(f.includeInZip).to.be.a('boolean');
            });
        });

        it('includes cURL format', () => {
            const curl = SNIPPET_FORMATS.find(f => f.id === 'shell_curl');
            expect(curl).to.exist;
            expect(curl!.target).to.equal('shell');
            expect(curl!.client).to.equal('curl');
        });

        it('includes Python Requests format', () => {
            const python = SNIPPET_FORMATS.find(f => f.id === 'python_requests');
            expect(python).to.exist;
            expect(python!.target).to.equal('python');
        });
    });

    describe('SNIPPET_FORMATS_FOR_ZIP', () => {
        it('only contains formats with includeInZip=true', () => {
            SNIPPET_FORMATS_FOR_ZIP.forEach(f => {
                expect(f.includeInZip).to.be.true;
            });
        });

        it('is a subset of SNIPPET_FORMATS', () => {
            const allIds = new Set(SNIPPET_FORMATS.map(f => f.id));
            SNIPPET_FORMATS_FOR_ZIP.forEach(f => {
                expect(allIds.has(f.id)).to.be.true;
            });
        });
    });

    describe('SNIPPET_FORMATS_FOR_CONTEXT_MENU', () => {
        it('only contains formats with includeInContextMenu=true', () => {
            SNIPPET_FORMATS_FOR_CONTEXT_MENU.forEach(f => {
                expect(f.includeInContextMenu).to.be.true;
            });
        });
    });

});
