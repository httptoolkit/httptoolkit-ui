import { expect } from 'chai';
import {
    ZIP_ALL_FORMAT_KEY,
    ALL_SNIPPET_FORMATS,
    DEFAULT_SELECTED_FORMAT_IDS,
    ALL_FORMAT_IDS,
    FORMAT_CATEGORIES,
    FORMATS_BY_CATEGORY,
    FORMAT_BY_ID,
    resolveFormats,
    SnippetFormatDefinition
} from '../../../../src/model/ui/snippet-formats';

describe('snippet-formats', () => {

    describe('ZIP_ALL_FORMAT_KEY', () => {
        it('is a non-empty string', () => {
            expect(ZIP_ALL_FORMAT_KEY).to.be.a('string');
            expect(ZIP_ALL_FORMAT_KEY.length).to.be.greaterThan(0);
        });

        it('is not a valid httpsnippet target (sentinel)', () => {
            expect(ZIP_ALL_FORMAT_KEY).to.include('__');
        });
    });

    describe('ALL_SNIPPET_FORMATS', () => {
        it('contains at least 4 formats', () => {
            expect(ALL_SNIPPET_FORMATS.length).to.be.greaterThanOrEqual(4);
        });

        it('has unique IDs', () => {
            const ids = ALL_SNIPPET_FORMATS.map(f => f.id);
            expect(new Set(ids).size).to.equal(ids.length);
        });

        it('has unique folder names', () => {
            const folders = ALL_SNIPPET_FORMATS.map(f => f.folderName);
            expect(new Set(folders).size).to.equal(folders.length);
        });

        it('each format has all required fields', () => {
            ALL_SNIPPET_FORMATS.forEach((f: SnippetFormatDefinition) => {
                expect(f.id).to.be.a('string').and.not.empty;
                expect(f.folderName).to.be.a('string').and.not.empty;
                expect(f.extension).to.be.a('string').and.not.empty;
                expect(f.target).to.be.a('string').and.not.empty;
                expect(f.client).to.be.a('string').and.not.empty;
                expect(f.label).to.be.a('string').and.not.empty;
                expect(f.popular).to.be.a('boolean');
            });
        });

        it('includes cURL format', () => {
            const curl = ALL_SNIPPET_FORMATS.find(f => f.id === 'shell_curl');
            expect(curl).to.exist;
            expect(curl!.target).to.equal('shell');
            expect(curl!.client).to.equal('curl');
        });

        it('includes Python Requests format', () => {
            const python = ALL_SNIPPET_FORMATS.find(f => f.id === 'python_requests');
            expect(python).to.exist;
            expect(python!.target).to.equal('python');
        });
    });

    describe('DEFAULT_SELECTED_FORMAT_IDS', () => {
        it('only contains IDs of popular formats', () => {
            DEFAULT_SELECTED_FORMAT_IDS.forEach(id => {
                const fmt = FORMAT_BY_ID.get(id);
                expect(fmt).to.exist;
                expect(fmt!.popular).to.be.true;
            });
        });

        it('is a subset of ALL_FORMAT_IDS', () => {
            DEFAULT_SELECTED_FORMAT_IDS.forEach(id => {
                expect(ALL_FORMAT_IDS.has(id)).to.be.true;
            });
        });
    });

    describe('FORMAT_CATEGORIES', () => {
        it('contains at least 3 categories', () => {
            expect(FORMAT_CATEGORIES.length).to.be.greaterThanOrEqual(3);
        });

        it('includes Shell and JavaScript', () => {
            expect(FORMAT_CATEGORIES).to.include('Shell');
            expect(FORMAT_CATEGORIES).to.include('JavaScript');
        });
    });

    describe('FORMATS_BY_CATEGORY', () => {
        it('groups formats correctly', () => {
            for (const cat of FORMAT_CATEGORIES) {
                const formats = FORMATS_BY_CATEGORY[cat];
                expect(formats).to.be.an('array').and.not.empty;
                formats.forEach(f => expect(f.category).to.equal(cat));
            }
        });
    });

    describe('resolveFormats', () => {
        it('resolves known format IDs to definitions', () => {
            const result = resolveFormats(new Set(['shell_curl', 'python_requests']));
            expect(result.length).to.equal(2);
            expect(result.map(f => f.id)).to.include('shell_curl');
        });

        it('silently skips unknown IDs', () => {
            const result = resolveFormats(new Set(['shell_curl', 'nonexistent_format']));
            expect(result.length).to.equal(1);
        });
    });

});
