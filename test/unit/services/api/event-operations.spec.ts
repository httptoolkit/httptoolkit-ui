import { expect } from '../../../test-setup';

import { OperationRegistry } from '../../../../src/services/ui-api/api-registry';
import { registerEventOperations } from '../../../../src/services/ui-api/operations/event-operations';
import { getExchangeData } from '../../unit-test-helpers';
import { CollectedEvent } from '../../../../src/types';

describe('Event operations', () => {

    let registry: OperationRegistry;
    let events: CollectedEvent[];

    beforeEach(() => {
        events = [];
        registry = new OperationRegistry(() => true);
        const mockEventsStore = { clearInterceptedData: () => {} } as any;
        registerEventOperations(registry, mockEventsStore, () => events);
    });

    describe('events.list', () => {

        it('should return empty list when no events', async () => {
            const result = await registry.execute('events.list', {});
            expect(result.success).to.equal(true);
            expect(result.data).to.deep.equal({ total: 0, events: [] });
        });

        it('should return summaries for exchanges', async () => {
            events.push(getExchangeData({ method: 'GET', hostname: 'example.com' }));
            events.push(getExchangeData({ method: 'POST', hostname: 'api.test.com' }));

            const result = await registry.execute('events.list', {});
            expect(result.success).to.equal(true);
            expect((result.data as any).total).to.equal(2);
            expect((result.data as any).events).to.have.length(2);
            expect((result.data as any).events[0].method).to.equal('GET');
            expect((result.data as any).events[1].method).to.equal('POST');
        });

        it('should respect limit parameter', async () => {
            events.push(getExchangeData());
            events.push(getExchangeData());
            events.push(getExchangeData());

            const result = await registry.execute('events.list', { limit: 2 });
            expect((result.data as any).total).to.equal(3);
            expect((result.data as any).events).to.have.length(2);
        });

        it('should respect offset parameter', async () => {
            events.push(getExchangeData({ method: 'GET' }));
            events.push(getExchangeData({ method: 'POST' }));
            events.push(getExchangeData({ method: 'PUT' }));

            const result = await registry.execute('events.list', { offset: 1 });
            expect((result.data as any).total).to.equal(3);
            expect((result.data as any).events).to.have.length(2);
            expect((result.data as any).events[0].method).to.equal('POST');
        });

        it('should filter using the filter syntax', async () => {
            events.push(getExchangeData({ hostname: 'api.example.com', statusCode: 200 }));
            events.push(getExchangeData({ hostname: 'other.test.com', statusCode: 404 }));
            events.push(getExchangeData({ hostname: 'api.example.com', statusCode: 500 }));

            const result = await registry.execute('events.list', {
                filter: 'hostname$=example.com status=200'
            });
            expect(result.success).to.equal(true);
            expect((result.data as any).total).to.equal(1);
            expect((result.data as any).events[0].url).to.include('api.example.com');
            expect((result.data as any).events[0].status).to.equal(200);
        });
    });

    describe('events.get-outline', () => {

        it('should return NOT_FOUND error for unknown ID', async () => {
            const result = await registry.execute('events.get-outline', { id: 'nonexistent' });
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('NOT_FOUND');
        });

        it('should return INVALID_PARAMS when id is missing', async () => {
            const result = await registry.execute('events.get-outline', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('INVALID_PARAMS');
        });

        it('should return headers and body sizes', async () => {
            const exchange = getExchangeData({
                method: 'POST',
                requestHeaders: { 'content-type': 'application/json' },
                requestBody: '{"key":"value"}',
                statusCode: 200,
                responseHeaders: { 'x-custom': 'test' },
                responseBody: 'response content'
            });
            events.push(exchange);

            const result = await registry.execute('events.get-outline', { id: exchange.id });
            expect(result.success).to.equal(true);

            const data = result.data as any;
            expect(data.request.headers).to.have.property('content-type', 'application/json');
            expect(data.request.bodySize).to.be.greaterThan(0);
            expect(data.request).to.not.have.property('body');

            expect(data.response.statusCode).to.equal(200);
            expect(data.response.headers).to.have.property('x-custom', 'test');
            expect(data.response.bodySize).to.be.greaterThan(0);
            expect(data.response).to.not.have.property('body');
        });

        it('should handle an aborted response', async () => {
            const exchange = getExchangeData({ responseState: 'aborted' });
            events.push(exchange);

            const result = await registry.execute('events.get-outline', { id: exchange.id });
            expect(result.success).to.equal(true);
            expect((result.data as any).response).to.equal('aborted');
        });
    });

    describe('events.get-request-body', () => {

        it('should return NOT_FOUND error for unknown ID', async () => {
            const result = await registry.execute('events.get-request-body', { id: 'nonexistent' });
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('NOT_FOUND');
        });

        it('should return the full request body by default', async () => {
            const exchange = getExchangeData({ requestBody: 'full request body' });
            events.push(exchange);

            const result = await registry.execute('events.get-request-body', { id: exchange.id });
            expect(result.success).to.equal(true);

            const data = result.data as any;
            expect(data.body).to.equal('full request body');
            expect(data.totalSize).to.equal(17);
            expect(data.isTruncated).to.equal(false);
        });

        it('should respect maxLength', async () => {
            const exchange = getExchangeData({ requestBody: 'full request body' });
            events.push(exchange);

            const result = await registry.execute('events.get-request-body', {
                id: exchange.id,
                maxLength: 4
            });
            const data = result.data as any;
            expect(data.body).to.equal('full');
            expect(data.totalSize).to.equal(17);
            expect(data.isTruncated).to.equal(true);
        });
    });

    describe('events.get-response-body', () => {

        it('should return the full response body by default', async () => {
            const exchange = getExchangeData({ responseBody: 'response content' });
            events.push(exchange);

            const result = await registry.execute('events.get-response-body', { id: exchange.id });
            expect(result.success).to.equal(true);

            const data = result.data as any;
            expect(data.body).to.equal('response content');
            expect(data.totalSize).to.equal(16);
            expect(data.isTruncated).to.equal(false);
        });

        it('should respect offset and maxLength', async () => {
            const exchange = getExchangeData({ responseBody: 'response content' });
            events.push(exchange);

            const result = await registry.execute('events.get-response-body', {
                id: exchange.id,
                offset: 9,
                maxLength: 4
            });
            const data = result.data as any;
            expect(data.body).to.equal('cont');
            expect(data.isTruncated).to.equal(true);
        });

        it('should handle aborted response', async () => {
            const exchange = getExchangeData({ responseState: 'aborted' });
            events.push(exchange);

            const result = await registry.execute('events.get-response-body', { id: exchange.id });
            expect(result.success).to.equal(true);

            const data = result.data as any;
            expect(data.body).to.equal(undefined);
            expect(data.totalSize).to.equal(0);
        });

        it('should handle pending response', async () => {
            const exchange = getExchangeData({ responseState: 'pending' });
            events.push(exchange);

            const result = await registry.execute('events.get-response-body', { id: exchange.id });
            expect(result.success).to.equal(true);

            const data = result.data as any;
            expect(data.body).to.equal(undefined);
            expect(data.totalSize).to.equal(0);
        });
    });
});
