import * as _ from 'lodash';
import * as zlib from 'zlib';

import { expect } from '../../../test-setup';

import {
    Filter,
    FilterSet,
    SelectableSearchFilterClasses as FilterClasses,
    StringFilter
} from "../../../../src/model/filters/search-filters";
import {
    applySuggestionToFilters,
    getFilterSuggestions
} from "../../../../src/model/filters/filter-matching";
import {
    applySuggestionToText
} from '../../../../src/model/filters/syntax-matching';

import { getExchangeData, getFailedTls } from '../../unit-test-helpers';
import { HttpExchange, SuccessfulExchange } from '../../../../src/model/http/exchange';
import { CollectedEvent, FailedTlsRequest } from '../../../../src/types';
import { delay } from '../../../../src/util/promise';
import { decodeBody } from '../../../../src/services/ui-worker-api';

// Given an exact input for a filter, creates the filter and returns it
function createFilter(input: string): Filter {
    const initialFilters: FilterSet = [new StringFilter(input)];

    const suggestions = getFilterSuggestions(
        FilterClasses,
        initialFilters[0].filter
    ).filter(s => s.matchType === 'full');

    expect(suggestions.length).to.equal(1);

    const updatedFilters = applySuggestionToFilters(initialFilters, suggestions[0]);

    expect(updatedFilters.length).to.equal(2);
    expect(updatedFilters[0].filter).to.equal("");

    return updatedFilters[1];
}

function getSuggestionDescriptions(input: string) {
    return getFilterSuggestions(FilterClasses, input)
        .map(s => s
            .filterClass
            .filterDescription(input, s.matchType === 'template')
        );
}

describe("Search filter model integration test:", () => {
    describe("Simple filter usage", () => {
        it("should suggest all filter names given no input", () => {
            const suggestions = getFilterSuggestions(FilterClasses, "");

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "method" },
                { index: 0, showAs: "hostname" },
                { index: 0, showAs: "path" },
                { index: 0, showAs: "query" },
                { index: 0, showAs: "status" },
                { index: 0, showAs: "header" },
                { index: 0, showAs: "body" },
                { index: 0, showAs: "bodySize" },
                { index: 0, showAs: "completed" },
                { index: 0, showAs: "pending" },
                { index: 0, showAs: "aborted" },
                { index: 0, showAs: "errored" },
                { index: 0, showAs: "category" },
                { index: 0, showAs: "port" },
                { index: 0, showAs: "protocol" },
                { index: 0, showAs: "httpVersion" },
                { index: 0, showAs: "not" },
                { index: 0, showAs: "or" }
            ]);
        });

        it("can provide initial descriptions for all filters", () => {
            const descriptions = FilterClasses.map((f) =>
                f.filterDescription("", false)
            );

            expect(descriptions).to.deep.equal([
                "requests with a given method",
                "requests sent to a given hostname",
                "requests sent to a given path",
                "requests with a given query string",
                "responses with a given status code",
                "exchanges by header",
                "exchanges by body content",
                "exchanges by body size",
                "requests that have received a response",
                "requests that are still waiting for a response",
                "requests that aborted before receiving a response",
                "requests that weren't transmitted successfully",
                "exchanges by their general category",
                "requests sent to a given port",
                "exchanges using either HTTP or HTTPS",
                "exchanges using a given version of HTTP",
                "exchanges that do not match a given condition",
                "exchanges that match any one of multiple conditions"
            ]);
        });

        it("should suggest nothing given free text input", () => {
            const suggestions = getFilterSuggestions(FilterClasses, "free text");

            expect(suggestions).to.deep.equal([]);
        });
    });

    describe("Status filters", () => {
        it("should suggest status operators once it's clear you want status", () => {
            const suggestions = getFilterSuggestions(FilterClasses, "sta");

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "status=" },
                { index: 0, showAs: "status!=" },
                { index: 0, showAs: "status>=" },
                { index: 0, showAs: "status>" },
                { index: 0, showAs: "status<=" },
                { index: 0, showAs: "status<" }
            ]);
        });

        it("should disambiguate status operators as they're entered", () => {
            let input = "status>";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s =>
                _.pick(s, 'showAs', 'index'))
            ).to.deep.equal([
                { index: 6, showAs: ">{3-digit number}" }
            ]);

            // Append an equals, should jump to >= suggestions:
            input = "status>=";

            suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: ">={3-digit number}" }
            ]);
        });

        it("should suggest a status number once you pick an operator", () => {
            let input = "sta";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            input = applySuggestionToText(input, _.last(suggestions)!);

            expect(input).to.equal("status<")

            suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: "<{3-digit number}" }
            ]);
        });

        it("should suggest seen status numbers from context, if available", () => {
            let input = "sta";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            input = applySuggestionToText(input, _.last(suggestions)!);

            suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ statusCode: 404 }),
            ]);

            expect(input).to.equal("status<")
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: "<{3-digit number}" },
                { index: 6, showAs: "<200" },
                { index: 6, showAs: "<404" },
            ]);
        });

        it("should complete a fully entered search filter", () => {
            let filters: FilterSet = [
                new StringFilter("status>=300")
            ];

            let suggestions = getFilterSuggestions(FilterClasses, filters[0].filter);

            expect(suggestions.length).to.equal(1);
            filters = applySuggestionToFilters(filters, suggestions[0])

            expect(filters.length).to.equal(2);
            expect(filters[0].filter).to.equal("");
            expect(filters[1].toString()).to.equal("Status >= 300");
        });

        it("should correctly filter for exact statuses", () => {
            const statusFilter = createFilter("status=404");

            const exampleEvents = [
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => statusFilter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(404);
        });

        it("should correctly filter for filter ranges", () => {
            const statusFilter = createFilter("status>=300");

            const exampleEvents = [
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 301 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => statusFilter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(404);
            expect((matchedEvents[1] as SuccessfulExchange).response.statusCode).to.equal(301);
        });

        it("should show a more specific description given a partial operator", () => {
            const input = "status!";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal("responses with a given status code");
        });

        it("should show a more specific description given a complete operator", () => {
            const input = "status>=";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal("responses with a status greater than or equal to a given value");
        });

        it("should show a basic description given a partial value", () => {
            const input = "status>4";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal("responses with a status greater than a given value");
        });

        it("should show a fully specific description given a full input", () => {
            const input = "status<=201";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "responses with a status less than or equal to 201"
            );
        });

        it("should show a fully specific description given a full input and exact value", () => {
            const input = "status=201";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "responses with status 201 (Created)"
            );
        });

        it("should show a full description given a created filter instance", () => {
            const filter = createFilter("status=201");

            expect(filter.filterDescription).to.equal(
                "responses with status 201 (Created)"
            );
        });
    });

    describe("Completed filters", () => {
        it("should correctly filter for completed responses", () => {
            const filter = createFilter("completed");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(200);
        });
    });

    describe("Pending filters", () => {
        it("should correctly filter for pending responses", () => {
            const filter = createFilter("pending");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as HttpExchange).response).to.equal(undefined);
        });
    });

    describe("Aborted filters", () => {
        it("should correctly filter for aborted responses", () => {
            const filter = createFilter("aborted");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as HttpExchange).response).to.equal('aborted');
        });
    });

    describe("Error filters", () => {
        it("should correctly filter for error responses", () => {
            const filter = createFilter("errored");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ statusCode: 500, responseTags: ["passthrough-error:ECONNRESET"] }),
                getFailedTls({ failureCause: 'cert-rejected' })
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(500);
            expect((matchedEvents[1] as FailedTlsRequest).failureCause).to.equal('cert-rejected');
        });
    });

    describe("Method filters", () => {
        it("should correctly filter for the given method", () => {
            const filter = createFilter("method=POST");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ method: 'POST', statusCode: 409 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).request.method).to.equal('POST');
        });

        it("should correctly filter against a given method", () => {
            const filter = createFilter("method!=POST");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ method: 'POST', statusCode: 409 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(
                matchedEvents.map(e => (e as SuccessfulExchange).request.method)
            ).to.deep.equal([
                "GET", "GET", "GET"
            ]);
        });

        it("should show descriptions for various suggestions", () => {
            [
                ["method", "requests with a given method"],
                ["method=", "requests with a given method"],
                ["method!=", "requests not sent with a given method"],
                ["method=post", "POST requests"],
                ["method!=GET", "non-GET requests"]
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });

        it("should suggest recently seen methods", () => {
            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ method: 'POST', statusCode: 409 }),
                getFailedTls()
            ];

            const suggestions = getFilterSuggestions(FilterClasses, "method=", exampleEvents);

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: '={method}' },
                { index: 6, showAs: '=GET' },
                { index: 6, showAs: '=POST' }
            ]);
        });
    });

    describe("HTTP version filters", () => {
        it("should correctly filter for the given version", () => {
            const filter = createFilter("httpVersion=2");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ httpVersion: '2.0' }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).httpVersion).to.equal(2);
        });
    });

    describe("Protocol filters", () => {
        it("should only suggest http for =http", () => {
            const input = "protocol=http";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 9, showAs: 'http', matchType: 'full' }
            ]);
        });

        it("should only suggest https for =https", () => {
            const input = "protocol=https";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 9, showAs: 'https', matchType: 'full' }
            ]);
        });

        it("should correctly filter for the given protocol", () => {
            const filter = createFilter("protocol=http");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ protocol: 'http:', statusCode: 301 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(301);
        });
    });

    describe("Hostname filters", () => {
        it("should correctly filter for a given exact hostname", () => {
            const filter = createFilter("hostname=httptoolkit.tech");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ hostname: 'httptoolkit.tech', statusCode: 200 }),
                getExchangeData({ hostname: 'httptoolkit.tech:8080', statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(200);
            expect((matchedEvents[1] as SuccessfulExchange).request.parsedUrl.port).to.equal('8080');
        });

        it("should correctly filter for a hostname part", () => {
            const filter = createFilter("hostname*=tech");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ hostname: 'httptoolkit.tech', statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(200);
        });

        it("should correctly filter for a hostname starting component", () => {
            const filter = createFilter("hostname^=google");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ hostname: 'google.com', statusCode: 200 }),
                getExchangeData({ hostname: 'google.es', statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('google.com');
            expect((matchedEvents[1] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('google.es');
        });

        it("should correctly filter for a hostname ending component", () => {
            const filter = createFilter("hostname$=com");

            const exampleEvents = [
                getExchangeData({ hostname: 'example.com:8080', statusCode: 404 }),
                getExchangeData({ hostname: 'google.com', statusCode: 200 }),
                getExchangeData({ hostname: 'google.es', statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('example.com');
            expect((matchedEvents[1] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('google.com');
        });

        it("should correctly filter for hostnames != to a given hostname", () => {
            const filter = createFilter("hostname!=google.com");

            const exampleEvents = [
                getExchangeData({ hostname: 'example.com', statusCode: 404 }),
                getExchangeData({ hostname: 'google.com', statusCode: 200 }),
                getExchangeData({ hostname: 'google.es', statusCode: 200 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('example.com');
            expect((matchedEvents[1] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('google.es');
        });
    });

    describe("Port filters", () => {
        it("should correctly filter for a given port", () => {
            const filter = createFilter("port=8080");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 404 }),
                getExchangeData({ hostname: 'httptoolkit.tech:8080' }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.hostname).to.equal('httptoolkit.tech');
        });

        it("should correctly filter for a implicit default port", () => {
            const filter = createFilter("port=80");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ protocol: 'https:', statusCode: 404 }),
                getExchangeData({ protocol: 'http:', statusCode: 301 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(301);
        });
    });

    describe("Path filters", () => {
        it("should correctly filter for a given path", () => {
            const filter = createFilter("path=/home");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ path: '/', statusCode: 200 }),
                getExchangeData({ path: '/home', statusCode: 200 }),
                getExchangeData({ path: '/home/missing', statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.pathname).to.equal('/home');
        });

        it("should correctly filter for a given path prefix", () => {
            const filter = createFilter("path^=/home");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ path: '/', statusCode: 200 }),
                getExchangeData({ path: '/home', query: '?id=1', statusCode: 200 }),
                getExchangeData({ path: '/home/missing', statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(2);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.pathname).to.equal('/home');
            expect((matchedEvents[1] as SuccessfulExchange).request.parsedUrl.pathname).to.equal('/home/missing');
        });
    });

    describe("Query filters", () => {
        it("should suggest operator options for 'quer'", () => {
            const input = "quer";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 0, showAs: 'query=', matchType: 'partial' },
                { index: 0, showAs: 'query!=', matchType: 'partial' },
                { index: 0, showAs: 'query*=', matchType: 'partial' },
                { index: 0, showAs: 'query^=', matchType: 'partial' },
                { index: 0, showAs: 'query$=', matchType: 'partial' }
            ]);
        });

        it("should suggest both template & empty queries for query=", () => {
            const input = "query=";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 6, showAs: '{query}', matchType: 'template' },
                { index: 6, showAs: '', matchType: 'full' },
            ]);
        });

        it("should show a more specific description given a partial operator", () => {
            const input = "query=";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            const [
                [templateSuggestion], [emptyQuerySuggestion]
            ] = _.partition(suggestions, { matchType: 'template' });

            const templateDescription = templateSuggestion
                .filterClass
                .filterDescription(input, templateSuggestion.matchType === 'template');

            const emptyQueryDescription = emptyQuerySuggestion
                .filterClass
                .filterDescription(input, emptyQuerySuggestion.matchType === 'template');

            expect(templateDescription).to.equal(
                "requests with a given query string"
            );
            expect(emptyQueryDescription).to.equal(
                "requests with an empty query string"
            );
        });

        it("should show a full description given a full filter input", () => {
            const input = "query^=?abc";

            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "requests with a query string starting with ?abc"
            );
        });

        it("should correctly filter for a given exact query", () => {
            const filter = createFilter("query=?a=b");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ path: '/home', query: '', statusCode: 200 }),
                getExchangeData({ path: '/user', query: '?a=b', statusCode: 302 }),
                getExchangeData({ path: '/user', query: '?id=123', statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(302);
        });

        it("should correctly filter for a blank query", () => {
            const filter = createFilter("query=");

            const exampleEvents = [
                getExchangeData({ path: '/home', query: '', statusCode: 200 }),
                getExchangeData({ path: '/user', query: '?a=b', statusCode: 302 }),
                getExchangeData({ path: '/user', query: '?id=123', statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).request.parsedUrl.pathname).to.equal('/home');
        });

        it("should correctly filter for a given query part", () => {
            const filter = createFilter("query*=id=1");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ path: '/home', query: '', statusCode: 200 }),
                getExchangeData({ path: '/user', query: '?a=b', statusCode: 302 }),
                getExchangeData({ path: '/user', query: '?a=b&id=1&since=123', statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));
            expect(matchedEvents.length).to.equal(1);
            expect((matchedEvents[0] as SuccessfulExchange).response.statusCode).to.equal(404);
        });
    });

    describe("Header filters", () => {
        it("should suggest header[...] in one step, once unambiguous", () => {
            let input = "head";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "header[{header name}]" }
            ]);
        });

        it("should suggest seen header names using context", () => {
            let input = "header[";

            const suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: {
                        'another-header': 'other values',
                        'Content-Type': 'application/xml'
                    }
                }),
                getExchangeData({
                    requestHeaders: { 'content-type': 'application/json' },
                    responseHeaders: { 'content-type': 'application/problem+json' },
                }),
            ]);

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 7, showAs: "{header name}]" },
                { index: 7, showAs: "another-header]" },
                { index: 7, showAs: "content-type]" }
            ]);
        });

        it("should suggest seen input-matching header names from context", () => {
            let input = "header[cont";

            const suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: {
                        'another-header': 'other values',
                        'cont': 'other-value',
                        'Content-Type': 'application/xml'
                    }
                }),
                getExchangeData({
                    requestHeaders: { 'content-type': 'application/json' },
                    responseHeaders: { 'content-type': 'application/problem+json' },
                }),
            ]);

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 7, showAs: "cont]" },
                { index: 7, showAs: "content-type]" }
            ]);
        });

        it("should not create a filter immediately from header name completion", () => {
            let input = "header[cont";

            const suggestions = getFilterSuggestions(FilterClasses, input);

            const filters = applySuggestionToFilters([
                new StringFilter(input),
            ], suggestions[0]);

            expect(filters.length).to.equal(1);
            expect(filters[0].filter).to.equal("header[cont]");
        });

        it("should suggest seen header values from context, if available", () => {
            let input = "header[content-type]=";

            const suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: {
                        'another-header': 'other values',
                        'Content-Type': 'application/xml'
                    }
                }),
                getExchangeData({
                    requestHeaders: { 'content-type': 'application/json' },
                    responseHeaders: { 'content-type': 'application/problem+json' },
                }),
            ]);

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 20, showAs: "={header value}" },
                { index: 20, showAs: "=application/xml" },
                { index: 20, showAs: "=application/json" },
                { index: 20, showAs: "=application/problem+json" },
            ]);
        });

        it("should show descriptions for various suggestions", () => {
            [
                ["header", "exchanges by header"],
                ["header[date]", "exchanges with a 'date' header"],
                ["header[date]=",
                    "exchanges with a 'date' header equal to a given value"],
                ["header[date]*=[json; charset=utf-8]",
                    "exchanges with a 'date' header containing 'json; charset=utf-8'"]
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });

        it("should correctly filter for the presence of a header", () => {
            const filter = createFilter("header[my-header]");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: { 'my-header': 'pending-req-with-header' }
                }),
                getExchangeData({
                    requestHeaders: { 'MY-HEADER': 'completed-req-with-header' }
                }),
                getExchangeData({
                    responseHeaders: { 'my-header': 'completed-res-with-header' }
                }),
                getExchangeData({ requestHeaders: { 'another-header': 'more header' } }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));

            const matchedHeaders = (matchedEvents as HttpExchange[]).map((event) => ({
                ...event.request.headers,
                ...(event.isSuccessfulExchange()
                    ? event.response.headers
                    : []
                )
            }));

            expect(matchedHeaders).to.deep.equal([
                { 'my-header': 'pending-req-with-header' },
                { 'MY-HEADER': 'completed-req-with-header' },
                { 'my-header': 'completed-res-with-header' }
            ]);
        });

        it("should correctly filter the value of a header", () => {
            const filter = createFilter("header[my-header]=abc");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({
                    requestHeaders: { 'my-header': 'wrong-value' }
                }),
                getExchangeData({
                    requestHeaders: { 'My-Header': ['abc', 'def'] }
                }),
                getExchangeData({
                    requestHeaders: { 'MY-HEADER': 'abc' }
                }),
                getExchangeData({
                    responseHeaders: { 'my-header': 'abc' }
                }),
                getExchangeData({ requestHeaders: { 'another-header': 'more header' } }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));

            const matchedHeaders = (matchedEvents as HttpExchange[]).map((event) => ({
                ...event.request.headers,
                ...(event.isSuccessfulExchange()
                    ? event.response.headers
                    : []
                )
            }));

            expect(matchedHeaders).to.deep.equal([
                { 'My-Header': ['abc', 'def'] },
                { 'MY-HEADER': 'abc' },
                { 'my-header': 'abc' }
            ]);
        });
    });

    describe("Body filters", () => {

        before(async function () {
            this.timeout(10000);
            // First worker request can be slow seemingly (~2s), not sure why, might be a
            // karma issue? Not noticeable in real use, and subsequent calls seem to be very
            // quick (~1ms) so it's not an issue in practice.
            await decodeBody(Buffer.from(zlib.gzipSync('Warmup content')), ['gzip']);

            // ^ Take from worker-decoding tests
        });

        const decodeBodies = async (events: CollectedEvent[]) => {
            events.forEach(e => {
                if (e instanceof HttpExchange) {
                    e.request.body.decoded;
                    if (e.isSuccessfulExchange()) e.response.body.decoded;
                }
            });
            await delay(1);
        };

        it("should correctly filter for a given substring", async () => {
            const filter = createFilter("body*=big");

            const exampleEvents = [
                getFailedTls(),
                getExchangeData({ requestBody: 'small', responseBody: 'small' }),
                getExchangeData({ requestBody: 'very-big', responseBody: 'very-big' }),
                getExchangeData({
                    responseState: 'aborted',
                    requestBody: 'big-aborted-request'
                }),
                getExchangeData({
                    responseState: 'pending',
                    requestBody: 'big-pending-request'
                }),
                getExchangeData({ requestBody: '', responseBody: 'very-big-response' })
            ];

            await decodeBodies(exampleEvents);

            const matchedEvents = exampleEvents.filter(e =>
                filter.matches(e)
            ) as HttpExchange[];

            expect(
                matchedEvents.map((e) =>
                    e.request.body.encoded.toString('utf8') +
                    (e.isSuccessfulExchange()
                        ? e.response.body.encoded.toString('utf8')
                        : ''
                    )
                )
            ).to.deep.equal([
                "very-bigvery-big",
                "big-aborted-request",
                "big-pending-request",
                "very-big-response"
            ]);
        });

        it("should wait for and use decoded bodies", async () => {
            const filter = createFilter("body^=hello");

            const exampleEvents = [
                getExchangeData({ // gzipped correct match
                    responseHeaders: { 'content-encoding': 'gzip' },
                    responseBody: zlib.gzipSync("hello world")
                }),
                getExchangeData({ // This decodes but won't match
                    responseHeaders: { 'content-encoding': 'gzip' },
                    responseBody: zlib.gzipSync("another body")
                }),
                getExchangeData({ // This will not decode
                    responseHeaders: { 'content-encoding': 'gibberish-encoding' },
                    responseBody: "gibberish"
                })
            ];

            let matchedEvents = exampleEvents.filter(e =>
                filter.matches(e)
            ) as HttpExchange[];

            expect(matchedEvents).to.deep.equal([]);

            await delay(100); // Wait for decode that filter will have triggered

            matchedEvents = exampleEvents.filter(e =>
                filter.matches(e)
            ) as HttpExchange[];

            expect(matchedEvents.map((e: any) =>
                e.response.body.decoded.toString()
            )).to.deep.equal([
                "hello world"
            ]);
        });

        it("should correctly format descriptions", () => {
            [
                ["body", "exchanges by body content"],
                ["body=", "exchanges with a body equal to a given value"],
                ["body!=abc", "exchanges with a body not equal to abc"],
                ["body*=qwe", "exchanges with a body containing qwe"],
                ["body$=x", "exchanges with a body ending with x"],
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });
    });

    describe("Body size filters", () => {
        it("should correctly filter for a given size", () => {
            const filter = createFilter("bodySize>10");

            const exampleEvents = [
                getFailedTls(),
                getExchangeData({ requestBody: 'small', responseBody: 'small' }), // === 10 bytes
                getExchangeData({ requestBody: 'very-big', responseBody: 'very-big' }),
                getExchangeData({
                    responseState: 'aborted',
                    requestBody: 'big-aborted-request'
                }),
                getExchangeData({
                    responseState: 'pending',
                    requestBody: 'big-pending-request'
                }),
                getExchangeData({ requestBody: '', responseBody: 'very-big-response' })
            ];

            const matchedEvents = exampleEvents.filter(e =>
                filter.matches(e)
            ) as HttpExchange[];

            expect(
                matchedEvents.map((e) =>
                    e.request.body.encoded.toString('utf8') +
                    (e.isSuccessfulExchange()
                        ? e.response.body.encoded.toString('utf8')
                        : ''
                    )
                )
            ).to.deep.equal([
                "very-bigvery-big",
                "big-aborted-request",
                "big-pending-request",
                "very-big-response"
            ]);
        });

        it("should correctly format sizes for descriptions", () => {
            [
                ["bodySize", "exchanges by body size"],
                ["bodySize=", "exchanges with a body equal to a given size"],
                ["bodySize!=100", "exchanges with a body not equal to 100 bytes"],
                ["bodySize>1200000", "exchanges with a body larger than 1.2 MB"],
                ["bodySize<10000", "exchanges with a body smaller than 10 kB"],
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });
    });

    describe("Or() filters", () => {
        it("should list all filters initially", () => {
            let input = "or(";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 3, showAs: "method" },
                { index: 3, showAs: "hostname" },
                { index: 3, showAs: "path" },
                { index: 3, showAs: "query" },
                { index: 3, showAs: "status" },
                { index: 3, showAs: "header" },
                { index: 3, showAs: "body" },
                { index: 3, showAs: "bodySize" },
                { index: 3, showAs: "completed" },
                { index: 3, showAs: "pending" },
                { index: 3, showAs: "aborted" },
                { index: 3, showAs: "errored" },
                { index: 3, showAs: "category" },
                { index: 3, showAs: "port" },
                { index: 3, showAs: "protocol" },
                { index: 3, showAs: "httpVersion" },
            ]);
        });

        it("should suggest completing the first filter", () => {
            let input = "or(comp";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 3, showAs: "completed", matchType: 'partial' }
            ]);
        });

        it("should suggest a delimiter after the first filter", () => {
            let input = "or(completed";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 12, showAs: ", {another condition})", matchType: 'template' }
            ]);
        });

        it("should suggest finishing a partial delimiter", () => {
            let input = "or(completed,";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 12, showAs: ", {another condition})", matchType: 'template' }
            ]);
        });

        it("should suggest all filters again for the second condition", () => {
            let input = "or(completed, ";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 14, showAs: "method" },
                { index: 14, showAs: "hostname" },
                { index: 14, showAs: "path" },
                { index: 14, showAs: "query" },
                { index: 14, showAs: "status" },
                { index: 14, showAs: "header" },
                { index: 14, showAs: "body" },
                { index: 14, showAs: "bodySize" },
                { index: 14, showAs: "completed)" },
                { index: 14, showAs: "pending)" },
                { index: 14, showAs: "aborted)" },
                { index: 14, showAs: "errored)" },
                { index: 14, showAs: "category" },
                { index: 14, showAs: "port" },
                { index: 14, showAs: "protocol" },
                { index: 14, showAs: "httpVersion" },
            ]);
        });

        it("should suggest finishing or completing a pair of conditions", () => {
            let input = "or(completed, err";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 14, showAs: "errored)", matchType: 'full' }
            ]);
        });

        it("should use context in suggestions", () => {
            let input = "or(header";

            let suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: {
                        'another-header': 'other values',
                        'Content-Type': 'application/xml'
                    }
                }),
            ]);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 3, showAs: "header[{header name}])" },
                { index: 3, showAs: "header[another-header]" },
                { index: 3, showAs: "header[content-type]" }
            ]);
        });

        it("should show descriptions for various suggestions", () => {
            [
                ["or(", "exchanges that match any one of multiple conditions"],
                ["or(error", "requests that weren't transmitted successfully, or ..."],
                ["or(errored,", "requests that weren't transmitted successfully, or ..."],
                ["or(errored, ", "requests that weren't transmitted successfully, or ..."],
                ["or(errored, method", "requests that weren't transmitted successfully, or requests with a given method"],
                ["or(errored, method=POST", "requests that weren't transmitted successfully, or POST requests"],
                ["or(errored, method=POST, ", "requests that weren't transmitted successfully, POST requests, or ..."],
                ["or(errored, method=POST)", "requests that weren't transmitted successfully, or POST requests"],
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });

        it("should correctly filter for multiple properties", () => {
            const filter = createFilter("or(header[my-header], status=404)");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: { 'my-header': 'pending-req-with-header' }
                }),
                getExchangeData({
                    responseHeaders: { 'MY-HEADER': 'completed-req-with-header' }
                }),
                getExchangeData({
                    statusCode: 200,
                    requestHeaders: { 'another-header': 'more header' }
                }),
                getExchangeData({
                    statusCode: 404
                }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));

            const matchedValues = (matchedEvents as HttpExchange[]).map((event) => ({
                status: (event as any).response?.statusCode,
                ...event.request.headers,
                ...(event.isSuccessfulExchange()
                    ? event.response.headers
                    : []
                )
            }));

            expect(matchedValues).to.deep.equal([
                { status: undefined, 'my-header': 'pending-req-with-header' },
                { status: 200, 'MY-HEADER': 'completed-req-with-header' },
                { status: 404 }
            ]);
        });
    });

    describe("Not() filters", () => {
        it("should list all filters initially", () => {
            let input = "not(";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 4, showAs: "method" },
                { index: 4, showAs: "hostname" },
                { index: 4, showAs: "path" },
                { index: 4, showAs: "query" },
                { index: 4, showAs: "status" },
                { index: 4, showAs: "header" },
                { index: 4, showAs: "body" },
                { index: 4, showAs: "bodySize" },
                { index: 4, showAs: "completed)" },
                { index: 4, showAs: "pending)" },
                { index: 4, showAs: "aborted)" },
                { index: 4, showAs: "errored)" },
                { index: 4, showAs: "category" },
                { index: 4, showAs: "port" },
                { index: 4, showAs: "protocol" },
                { index: 4, showAs: "httpVersion" },
            ]);
        });

        it("should suggest continuing a partial inner filter", () => {
            let input = "not(method";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 4, showAs: "method=", matchType: 'partial' },
                { index: 4, showAs: "method!=", matchType: 'partial' }
            ]);
        });

        it("should suggest fully completing a completable inner filter", () => {
            let input = "not(comp";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 4, showAs: "completed)", matchType: 'full' }
            ]);
        });

        it("should suggest completing a fully typed filter", () => {
            let input = "not(completed)";

            let suggestions = getFilterSuggestions(FilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index', 'matchType'))).to.deep.equal([
                { index: 4, showAs: "completed)", matchType: 'full' }
            ]);
        });

        it("should use context in suggestions", () => {
            let input = "not(header";

            let suggestions = getFilterSuggestions(FilterClasses, input, [
                getExchangeData({
                    responseState: 'pending',
                    requestHeaders: {
                        'another-header': 'other values',
                        'Content-Type': 'application/xml'
                    }
                }),
            ]);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 4, showAs: "header[{header name}])" },
                { index: 4, showAs: "header[another-header]" },
                { index: 4, showAs: "header[content-type]" }
            ]);
        });

        it("should show descriptions for various suggestions", () => {
            [
                ["not(", "exchanges that do not match a given condition"],
                ["not(error", "excluding requests that weren't transmitted successfully"],
                ["not(head", "excluding exchanges by header"],
                ["not(query^=?abc)", "excluding requests with a query string starting with ?abc"],
                ["not(method=POST)", "excluding POST requests"]
            ].forEach(([input, expectedOutput]) => {
                const description = getSuggestionDescriptions(input)[0];
                expect(description).to.equal(expectedOutput);
            });
        });

        it("should correctly filter for negated properties", () => {
            const filter = createFilter("not(status=200)");

            const exampleEvents = [
                getExchangeData({ responseState: 'aborted' }),
                getExchangeData({ responseState: 'pending' }),
                getExchangeData({ statusCode: 200 }),
                getExchangeData({ statusCode: 201 }),
                getExchangeData({ statusCode: 404 }),
                getFailedTls()
            ];

            const matchedEvents = exampleEvents.filter(e => filter.matches(e));

            const matchedValues = (matchedEvents as HttpExchange[]).map((event) => ({
                status: (event as any).response?.statusCode
            }));

            expect(matchedValues).to.deep.equal([
                { status: undefined },
                { status: undefined },
                { status: 201 },
                { status: 404 },
                { status: undefined }
            ]);
        });
    });
});