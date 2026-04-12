import { expect } from 'chai';
import {
    buildZipFileName,
    buildZipArchiveName
} from '../../../src/util/export-filenames';

describe('export-filenames', () => {

    describe('buildZipFileName', () => {

        it('builds a standard filename with hostname', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh', 'https://api.github.com/repos'))
                .to.equal('001_GET_200_api.github.com.sh');
        });

        it('builds a filename without URL', () => {
            expect(buildZipFileName(3, 'POST', 201, 'py'))
                .to.equal('003_POST_201.py');
        });

        it('zero-pads the index to 3 digits', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh'))
                .to.equal('001_GET_200.sh');
            expect(buildZipFileName(42, 'POST', 201, 'py'))
                .to.equal('042_POST_201.py');
        });

        it('uppercases the method', () => {
            expect(buildZipFileName(1, 'get', 200, 'sh'))
                .to.equal('001_GET_200.sh');
        });

        it('strips non-alpha characters from method', () => {
            expect(buildZipFileName(1, 'M-SEARCH', 200, 'sh'))
                .to.equal('001_MSEARCH_200.sh');
        });

        it('uses "pending" for null status', () => {
            expect(buildZipFileName(7, 'DELETE', null, 'js'))
                .to.equal('007_DELETE_pending.js');
        });

        it('handles zero status code', () => {
            expect(buildZipFileName(1, 'GET', 0, 'sh'))
                .to.equal('001_GET_0.sh');
        });

        it('handles large index numbers beyond padding', () => {
            expect(buildZipFileName(9999, 'PATCH', 204, 'ps1'))
                .to.equal('9999_PATCH_204.ps1');
        });

        it('uses "UNKNOWN" for empty method string', () => {
            expect(buildZipFileName(1, '', 200, 'sh'))
                .to.equal('001_UNKNOWN_200.sh');
        });

        it('extracts hostname from URL and appends it', () => {
            expect(buildZipFileName(5, 'POST', 201, 'py', 'https://httpbin.org/post?q=1'))
                .to.equal('005_POST_201_httpbin.org.py');
        });

        it('handles URL with port by dropping port', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh', 'http://localhost:8080/api'))
                .to.equal('001_GET_200_localhost.sh');
        });

        it('handles IP address URLs', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh', 'http://192.168.1.1/test'))
                .to.equal('001_GET_200_192.168.1.1.sh');
        });

        it('omits hostname when URL is undefined', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh', undefined))
                .to.equal('001_GET_200.sh');
        });

        it('omits hostname when URL is invalid', () => {
            expect(buildZipFileName(1, 'GET', 200, 'sh', 'not-a-url'))
                .to.equal('001_GET_200.sh');
        });
    });

    describe('buildZipArchiveName', () => {

        it('starts with "HTTPToolkit_"', () => {
            expect(buildZipArchiveName()).to.match(/^HTTPToolkit_/);
        });

        it('ends with ".zip"', () => {
            expect(buildZipArchiveName()).to.match(/\.zip$/);
        });

        it('contains date and time', () => {
            const name = buildZipArchiveName();
            // Should match: HTTPToolkit_YYYY-MM-DD_HH-MM.zip
            expect(name).to.match(/^HTTPToolkit_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.zip$/);
        });

        it('includes exchange count when provided', () => {
            const name = buildZipArchiveName(42);
            expect(name).to.match(/^HTTPToolkit_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}_42-requests\.zip$/);
        });

        it('works without exchange count', () => {
            const name = buildZipArchiveName();
            expect(name).to.not.include('requests');
        });
    });

});
