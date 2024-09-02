import { expect } from '../../../test-setup';

import { getContentType, getEditableContentType } from '../../../../src/model/events/content-types';

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
});