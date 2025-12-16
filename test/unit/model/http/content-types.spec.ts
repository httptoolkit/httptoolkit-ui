import { expect } from '../../../test-setup';

import { getContentType, getEditableContentType, getCompatibleTypes } from '../../../../src/model/events/content-types';

describe('Content type parsing', () => {
    describe('getContentType', () => {
        it('should render application/json as JSON', () => {
            const ct = getContentType('application/json');
            expect(ct).to.equal('json');
        });

        it('should render text/json as JSON', () => {
            const ct = getContentType('text/json');
            expect(ct).to.equal('json');
        });

        it('should render application/vnd.npm.install-v1+json as JSON', () => {
            const ct = getContentType('application/vnd.npm.install-v1+json');
            expect(ct).to.equal('json');
        });

        it('should render application/xml as XML', () => {
            const ct = getContentType('application/xml');
            expect(ct).to.equal('xml');
        });

        it('should render application/xml+extra with charset as XML', () => {
            const ct = getContentType('application/xml+extra; charset=utf-8');
            expect(ct).to.equal('xml');
        });

        it('should render text/plain as text', () => {
            const ct = getContentType('text/plain');
            expect(ct).to.equal('text');
        });

        it('should render image/gif as image', () => {
            const ct = getContentType('image/gif');
            expect(ct).to.equal('image');
        });

        it('should render image/svg+xml as image', () => {
            const ct = getContentType('image/svg+xml');
            expect(ct).to.equal('image');
        });

        it('should render application/octet-stream as raw data', () => {
            const ct = getContentType('application/octet-stream');
            expect(ct).to.equal('raw');
        });

        it('should render application/grpc as protobuf grpc', () => {
            const ct = getContentType('application/grpc');
            expect(ct).to.equal('grpc-proto');
        });

        it('should render application/grpc+proto as protobuf grpc', () => {
            const ct = getContentType('application/grpc+proto');
            expect(ct).to.equal('grpc-proto');
        });

        it('should render application/grpc+protobuf as protobuf grpc', () => {
            const ct = getContentType('application/grpc+protobuf');
            expect(ct).to.equal('grpc-proto');
        });

        it('should render application/grpc-proto as protobuf grpc', () => {
            const ct = getContentType('application/grpc-proto');
            expect(ct).to.equal('grpc-proto');
        });

        it('should render application/grpc-protobuf as protobuf grpc', () => {
            const ct = getContentType('application/grpc-protobuf');
            expect(ct).to.equal('grpc-proto');
        });

        it('should render application/grpc+json as JSON', () => {
            const ct = getContentType('application/grpc+json');
            expect(ct).to.equal('json');
        });

        it('should return undefined for unknown content', () => {
            const ct = getContentType('application/unknownsomething');
            expect(ct).to.equal(undefined);
        });
    });

    describe('getEditableContentType', () => {
        it('should allow editing application/json as JSON', () => {
            const ct = getContentType('application/json');
            expect(ct).to.equal('json');
        });

        it('should not allow editing image/gif as an image', () => {
            const ct = getEditableContentType('image/gif');
            expect(ct).to.equal(undefined);
        });
    });

    describe('getCompatibleTypes', () => {
        it('should detect standard base64 text', () => {
            const cts = getCompatibleTypes('text', 'text/plain', Buffer.from('FWTkm2+ZvMo=', 'ascii'));
            expect(cts).to.deep.equal({
                preferredContentType: 'text',
                availableContentTypes: ['text', 'base64', 'raw']
            });
        });

        it('should detect URL-safe (without padding) base64 text', () => {
            const cts = getCompatibleTypes('text', 'text/plain', Buffer.from('FWTkm2-ZvMo', 'ascii'));
            expect(cts).to.deep.equal({
                preferredContentType: 'text',
                availableContentTypes: ['text', 'base64', 'raw']
            });
        });

        it('should work even if first character is not ASCII', () => {
            const cts = getCompatibleTypes('raw', 'application/octet-stream', Buffer.from('1f8d08', 'hex')); // GZIP magic bytes
            expect(cts).to.deep.equal({
                preferredContentType: 'raw',
                availableContentTypes: ['raw', 'text']
            });
        });

        it('should flag application/grpc as compatible with [grpc-proto,text,raw]', () => {
            const cts = getCompatibleTypes('grpc-proto', 'application/grpc', undefined);
            expect(cts).to.deep.equal({
                preferredContentType: 'grpc-proto',
                availableContentTypes: ['grpc-proto', 'text', 'raw']
            });
        });

        it('should flag application/grpc+proto as compatible with [grpc-proto,text,raw]', () => {
            const cts = getCompatibleTypes('grpc-proto', 'application/grpc+proto', undefined);
            expect(cts).to.deep.equal({
                preferredContentType: 'grpc-proto',
                availableContentTypes: ['grpc-proto', 'text', 'raw']
            });
        });

        it('should flag application/grpc+json as compatible with [grpc-proto,text,raw]', () => {
            const cts = getCompatibleTypes('json', 'application/grpc+json', undefined);
            expect(cts).to.deep.equal({
                preferredContentType: 'json',
                availableContentTypes: ['json', 'text', 'raw']
            });
        });

        it('should detect & override default for undeclared grpc+proto', () => {
            const cts = getCompatibleTypes('raw', 'application/octet-stream', Buffer.from('AAAAAAIIAQ==', 'base64'));
            expect(cts).to.deep.equal({
                preferredContentType: 'grpc-proto',
                availableContentTypes: ['raw', 'grpc-proto', 'text']
            });
        });

        it('should detect & override default for undeclared XML', () => {
            const cts = getCompatibleTypes('text', 'text/plain', Buffer.from('<hello></hello', 'ascii'));
            expect(cts).to.deep.equal({
                preferredContentType: 'xml',
                availableContentTypes: ['text', 'xml', 'html', 'raw']
            });
        });

        it('should detect & override default for undeclared JSON', () => {
            const cts = getCompatibleTypes('text', 'text/plain', Buffer.from('{"hello": "world"}', 'ascii'));
            expect(cts).to.deep.equal({
                preferredContentType: 'json',
                availableContentTypes: ['text', 'json', 'raw']
            });
        });

        it('should detect & override default for undeclared JSON records', () => {
            const cts = getCompatibleTypes('text', 'text/plain', Buffer.from('{"hello": "world"}\n[]\n', 'ascii'));
            expect(cts).to.deep.equal({
                preferredContentType: 'json-records',
                availableContentTypes: ['text', 'json-records', 'raw']
            });
        });
    });
});