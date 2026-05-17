import { expect } from 'chai';
import {
    buildArchiveFilename,
    buildRequestBaseName,
    buildSnippetZipPath,
    sanitizeFilename
} from '../../../src/util/export-filenames';

describe('export-filenames', () => {

    describe('sanitizeFilename', () => {

        it('replaces path separators and Windows-reserved characters', () => {
            expect(sanitizeFilename('a/b\\c:d*e?f"g<h>i|j'))
                .to.equal('a_b_c_d_e_f_g_h_i_j');
        });

        it('prefixes Windows-reserved device names', () => {
            expect(sanitizeFilename(' CON .txt'))
                .to.equal('_CON .txt');
            expect(sanitizeFilename('nul...'))
                .to.equal('_nul');
        });

        it('falls back for empty or traversal-only names', () => {
            expect(sanitizeFilename('')).to.equal('unnamed');
            expect(sanitizeFilename('..', 'request')).to.equal('request');
        });

    });

    describe('buildRequestBaseName', () => {

        it('builds a standard base name with hostname and path', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: 'GET',
                status: 200,
                url: 'https://api.github.com/repos'
            })).to.equal('01_GET_200_api.github.com__repos');
        });

        it('zero-pads based on total request count', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 200,
                method: 'GET',
                status: 200,
                url: ''
            })).to.equal('001_GET_200');
        });

        it('uppercases the method', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: 'post',
                status: 201,
                url: ''
            })).to.equal('01_POST_201');
        });

        it('omits unknown or invalid statuses', () => {
            expect(buildRequestBaseName({
                index: 7,
                total: 20,
                method: 'DELETE',
                status: null,
                url: ''
            })).to.equal('07_DELETE');
            expect(buildRequestBaseName({
                index: 8,
                total: 20,
                method: 'GET',
                status: 0,
                url: ''
            })).to.equal('08_GET');
        });

        it('handles large index numbers beyond padding', () => {
            expect(buildRequestBaseName({
                index: 9999,
                total: 20,
                method: 'PATCH',
                status: 204,
                url: ''
            })).to.equal('9999_PATCH_204');
        });

        it('uses REQ for empty method strings', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: '',
                status: 200,
                url: ''
            })).to.equal('01_REQ_200');
        });

        it('handles URL with port by dropping port', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: 'GET',
                status: 200,
                url: 'http://localhost:8080/api'
            })).to.equal('01_GET_200_localhost__api');
        });

        it('handles IP address URLs', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: 'GET',
                status: 200,
                url: 'http://192.168.1.1/test'
            })).to.equal('01_GET_200_192.168.1.1__test');
        });

        it('uses invalid URLs as sanitized path text', () => {
            expect(buildRequestBaseName({
                index: 1,
                total: 20,
                method: 'GET',
                status: 200,
                url: 'not-a-url'
            })).to.equal('01_GET_200_not-a-url');
        });

    });

    describe('buildSnippetZipPath', () => {

        it('builds a sanitized folder/file path', () => {
            expect(buildSnippetZipPath('Shell/Curl', '01_GET_200_api.github.com', '.sh'))
                .to.equal('Shell_Curl/01_GET_200_api.github.com.sh');
        });

    });

    describe('buildArchiveFilename', () => {

        it('starts with "HTTPToolkit_"', () => {
            expect(buildArchiveFilename()).to.match(/^HTTPToolkit_Export_/);
        });

        it('ends with ".zip"', () => {
            expect(buildArchiveFilename()).to.match(/\.zip$/);
        });

        it('contains date and time', () => {
            const name = buildArchiveFilename(new Date(2026, 4, 17, 12, 34));
            expect(name).to.equal('HTTPToolkit_Export_2026-05-17_12-34.zip');
        });

    });

});
