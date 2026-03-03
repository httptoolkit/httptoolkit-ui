import { expect } from '../../../test-setup';
import { observable } from 'mobx';

import { getExchangeData } from '../../unit-test-helpers';
import {
    serializeExchangeSummary,
    serializeExchangeOutline,
    serializeBody
} from '../../../../src/services/ui-api/serialize';

describe('serializeExchangeSummary', () => {

    it('should return the correct shape for a completed exchange', () => {
        const exchange = getExchangeData({
            method: 'POST',
            hostname: 'api.example.com',
            path: '/users',
            statusCode: 201
        });

        const summary = serializeExchangeSummary(exchange);

        expect(summary.id).to.be.a('string');
        expect(summary.type).to.equal('http');
        expect(summary.method).to.equal('POST');
        expect(summary.url).to.include('api.example.com/users');
        expect(summary.status).to.equal(201);
        expect(summary.source).to.be.a('string');
        expect(summary.timestamp).to.be.a('number');
    });

    it('should handle a pending response (status is undefined)', () => {
        const exchange = getExchangeData({
            responseState: 'pending'
        });

        const summary = serializeExchangeSummary(exchange);
        expect(summary.status).to.equal(undefined);
    });

    it('should handle an aborted response', () => {
        const exchange = getExchangeData({
            responseState: 'aborted'
        });

        const summary = serializeExchangeSummary(exchange);
        expect(summary.status).to.equal('aborted');
    });
});

describe('serializeExchangeOutline', () => {

    it('should include headers and body sizes but not bodies', () => {
        const exchange = getExchangeData({
            method: 'POST',
            hostname: 'api.example.com',
            path: '/data',
            requestHeaders: { 'content-type': 'application/json' },
            requestBody: '{"key":"value"}',
            statusCode: 200,
            responseHeaders: { 'content-type': 'text/plain' },
            responseBody: 'OK'
        });

        const outline = serializeExchangeOutline(exchange);

        expect(outline.request.headers).to.have.property('content-type', 'application/json');
        expect(outline.request.bodySize).to.be.a('number');
        expect(outline.request.bodySize).to.be.greaterThan(0);
        expect(outline.request).to.not.have.property('body');

        const response = outline.response as any;
        expect(response.statusCode).to.equal(200);
        expect(response.headers).to.have.property('content-type', 'text/plain');
        expect(response.bodySize).to.be.a('number');
        expect(response.bodySize).to.be.greaterThan(0);
        expect(response).to.not.have.property('body');
    });

    it('should include timing and tags', () => {
        const exchange = getExchangeData({
            requestTags: ['httptoolkit:manually-sent-request']
        });

        const outline = serializeExchangeOutline(exchange);

        expect(outline.timing).to.be.an('object');
        expect(outline.tags).to.be.an('array');
    });

    it('should handle an aborted response', () => {
        const exchange = getExchangeData({ responseState: 'aborted' });
        const outline = serializeExchangeOutline(exchange);
        expect(outline.response).to.equal('aborted');
    });

    it('should handle a pending response', () => {
        const exchange = getExchangeData({ responseState: 'pending' });
        const outline = serializeExchangeOutline(exchange);
        expect(outline.response).to.equal(undefined);
    });

    it('should produce structuredClone-safe output with MobX observable fields', () => {
        const exchange = getExchangeData({
            method: 'POST',
            requestHeaders: { 'content-type': 'application/json' },
            requestBody: '{}',
            statusCode: 200,
            responseHeaders: { 'x-test': 'value' },
            responseBody: 'ok'
        });

        // Replace with MobX observables, matching the real HttpExchange decorators
        (exchange as any).tags = observable(['test-tag']);
        (exchange as any).timingEvents = observable({ startTime: Date.now(), startTimestamp: 0 });

        const outline = serializeExchangeOutline(exchange);

        // Must not throw — results cross the Electron contextBridge
        // which uses structured cloning (MobX observables can't be cloned)
        const cloned = structuredClone(outline);
        expect(cloned).to.deep.equal(outline);
    });
});

describe('serializeBody', () => {

    it('should return the full body when no limits are set', async () => {
        const exchange = getExchangeData({ responseBody: 'hello world' });
        const result = await serializeBody(exchange, 'response', {});

        expect(result.body).to.equal('hello world');
        expect(result.totalSize).to.equal(11);
        expect(result.isTruncated).to.equal(false);
    });

    it('should return the request body', async () => {
        const exchange = getExchangeData({ requestBody: 'request content' });
        const result = await serializeBody(exchange, 'request', {});

        expect(result.body).to.equal('request content');
        expect(result.totalSize).to.equal(15);
        expect(result.isTruncated).to.equal(false);
    });

    it('should truncate with maxLength', async () => {
        const exchange = getExchangeData({ responseBody: 'hello world' });
        const result = await serializeBody(exchange, 'response', { maxLength: 5 });

        expect(result.body).to.equal('hello');
        expect(result.totalSize).to.equal(11);
        expect(result.isTruncated).to.equal(true);
    });

    it('should apply offset', async () => {
        const exchange = getExchangeData({ responseBody: 'hello world' });
        const result = await serializeBody(exchange, 'response', { offset: 6 });

        expect(result.body).to.equal('world');
        expect(result.totalSize).to.equal(11);
        expect(result.isTruncated).to.equal(false);
    });

    it('should apply both offset and maxLength', async () => {
        const exchange = getExchangeData({ responseBody: 'hello world' });
        const result = await serializeBody(exchange, 'response', { offset: 2, maxLength: 5 });

        expect(result.body).to.equal('llo w');
        expect(result.totalSize).to.equal(11);
        expect(result.isTruncated).to.equal(true);
    });

    it('should return empty string when offset exceeds body size', async () => {
        const exchange = getExchangeData({ responseBody: 'short' });
        const result = await serializeBody(exchange, 'response', { offset: 100 });

        expect(result.body).to.equal('');
        expect(result.totalSize).to.equal(5);
        expect(result.isTruncated).to.equal(false);
    });

    it('should not be truncated when maxLength exceeds body size', async () => {
        const exchange = getExchangeData({ responseBody: 'short' });
        const result = await serializeBody(exchange, 'response', { maxLength: 1000 });

        expect(result.body).to.equal('short');
        expect(result.totalSize).to.equal(5);
        expect(result.isTruncated).to.equal(false);
    });

    it('should handle aborted response body', async () => {
        const exchange = getExchangeData({ responseState: 'aborted' });
        const result = await serializeBody(exchange, 'response', {});

        expect(result.body).to.equal(undefined);
        expect(result.totalSize).to.equal(0);
        expect(result.isTruncated).to.equal(false);
    });

    it('should handle pending response body', async () => {
        const exchange = getExchangeData({ responseState: 'pending' });
        const result = await serializeBody(exchange, 'response', {});

        expect(result.body).to.equal(undefined);
        expect(result.totalSize).to.equal(0);
        expect(result.isTruncated).to.equal(false);
    });

    it('should handle empty body', async () => {
        const exchange = getExchangeData({ responseBody: '' });
        const result = await serializeBody(exchange, 'response', {});

        expect(result.totalSize).to.equal(0);
        expect(result.isTruncated).to.equal(false);
    });
});
