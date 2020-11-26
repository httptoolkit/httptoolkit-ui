import * as _ from 'lodash';

import { expect } from '../../../test-setup';

import {
    Filter,
    FilterSet,
    SelectableSearchFilterClasses, StringFilter
} from "../../../../src/model/filters/search-filters";
import {
    applySuggestionToFilters,
    applySuggestionToText,
    getSuggestions
} from "../../../../src/model/filters/filter-matching";
import { getExchangeData, getFailedTls } from '../../unit-test-helpers';
import { HttpExchange, SuccessfulExchange } from '../../../../src/model/http/exchange';
import { FailedTlsRequest } from '../../../../src/types';

// Given an exact input for a filter, creates the filter and returns it
function createFilter(input: string): Filter {
    const initialFilters: FilterSet = [new StringFilter(input)];

    const suggestions = getSuggestions(
        SelectableSearchFilterClasses,
        initialFilters[0].filter
    ).filter(s => s.matchType === 'full');

    expect(suggestions.length).to.equal(1);

    const updatedFilters = applySuggestionToFilters(initialFilters, suggestions[0]);

    expect(updatedFilters.length).to.equal(2);
    expect(updatedFilters[0].filter).to.equal("");

    return updatedFilters[1];
}

function getSuggestionDescriptions(input: string) {
    return getSuggestions(SelectableSearchFilterClasses, input)
        .map(s => s
            .filterClass
            .filterDescription(input, s.matchType === 'template')
        );
}

describe("Search filter model integration test:", () => {
    describe("Simple filter usage", () => {
        it("should suggest all filter names given no input", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "");

            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "method" },
                { index: 0, showAs: "hostname" },
                { index: 0, showAs: "path" },
                { index: 0, showAs: "query" },
                { index: 0, showAs: "status" },
                { index: 0, showAs: "header" },
                { index: 0, showAs: "completed" },
                { index: 0, showAs: "pending" },
                { index: 0, showAs: "aborted" },
                { index: 0, showAs: "errored" },
                { index: 0, showAs: "port" },
                { index: 0, showAs: "protocol" },
                { index: 0, showAs: "httpVersion" },
            ]);
        });

        it("can provide initial descriptions for all filters", () => {
            const descriptions = SelectableSearchFilterClasses.map((f) =>
                f.filterDescription("", false)
            );

            expect(descriptions).to.deep.equal([
                "Match requests with a given method",
                "Match requests sent to a given hostname",
                "Match requests sent to a given path",
                "Match requests with a given query string",
                "Match responses with a given status code",
                "Match exchanges by header",
                "Match requests that have received a response",
                "Match requests that are still waiting for a response",
                "Match requests that aborted before receiving a response",
                "Match requests that weren't transmitted successfully",
                "Match requests sent to a given port",
                "Match exchanges using either HTTP or HTTPS",
                "Match exchanges using a given version of HTTP"
            ]);
        });

        it("should suggest nothing given free text input", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "free text");

            expect(suggestions).to.deep.equal([]);
        });
    });

    describe("Status filters", () => {
        it("should suggest status operators once it's clear you want status", () => {
            const suggestions = getSuggestions(SelectableSearchFilterClasses, "sta");

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

            let suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            expect(suggestions.map(s =>
                _.pick(s, 'showAs', 'index'))
            ).to.deep.equal([
                { index: 6, showAs: ">{3-digit number}" }
            ]);

            // Append an equals, should jump to >= suggestions:
            input = "status>=";

            suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: ">={3-digit number}" }
            ]);
        });

        it("should suggest a status number once you pick an operator", () => {
            let input = "sta";

            let suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            input = applySuggestionToText(input, _.last(suggestions)!);

            expect(input).to.equal("status<")

            suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 6, showAs: "<{3-digit number}" }
            ]);
        });

        it("should suggest seen status numbers from context, if available", () => {
            let input = "sta";

            let suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            input = applySuggestionToText(input, _.last(suggestions)!);

            suggestions = getSuggestions(SelectableSearchFilterClasses, input, [
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

            let suggestions = getSuggestions(SelectableSearchFilterClasses, filters[0].filter);

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

            expect(description).to.equal("Match responses with a given status code");
        });

        it("should show a more specific description given a complete operator", () => {
            const input = "status>=";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal("Match responses with a status greater than or equal to a given value");
        });

        it("should show a basic description given a partial value", () => {
            const input = "status>4";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal("Match responses with a status greater than a given value");
        });

        it("should show a fully specific description given a full input", () => {
            const input = "status<=201";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "Match responses with a status less than or equal to 201"
            );
        });

        it("should show a fully specific description given a full input and exact value", () => {
            const input = "status=201";
            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "Match responses with status 201 (Created)"
            );
        });

        it("should show a full description given a created filter instance", () => {
            const filter = createFilter("status=201");

            expect(filter.filterDescription).to.equal(
                "Match responses with status 201 (Created)"
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
                ["method", "Match requests with a given method"],
                ["method=", "Match requests with a given method"],
                ["method!=", "Match requests not sent with a given method"],
                ["method=post", "Match POST requests"],
                ["method!=GET", "Match non-GET requests"]
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

            const suggestions = getSuggestions(SelectableSearchFilterClasses, "method=", exampleEvents);

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

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 9, showAs: 'http', matchType: 'full' }
            ]);
        });

        it("should only suggest https for =https", () => {
            const input = "protocol=https";

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input);

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

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input);

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

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input);

            expect(suggestions.map(
                s => _.pick(s, 'showAs', 'index', 'matchType'))
            ).to.deep.equal([
                { index: 6, showAs: '{query}', matchType: 'template' },
                { index: 6, showAs: '', matchType: 'full' },
            ]);
        });

        it("should show a more specific description given a partial operator", () => {
            const input = "query=";

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input);

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
                "Match requests with a given query string"
            );
            expect(emptyQueryDescription).to.equal(
                "Match requests with an empty query string"
            );
        });

        it("should show a full description given a full filter input", () => {
            const input = "query^=?abc";

            const description = getSuggestionDescriptions(input)[0];

            expect(description).to.equal(
                "Match requests with a query string starting with ?abc"
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

            let suggestions = getSuggestions(SelectableSearchFilterClasses, input);
            expect(suggestions.map(s => _.pick(s, 'showAs', 'index'))).to.deep.equal([
                { index: 0, showAs: "header[{header name}]" }
            ]);
        });

        it("should suggest seen header names using context", () => {
            let input = "header[";

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input, [
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
                { index: 6, showAs: "[{header name}" },
                { index: 6, showAs: "[another-header" },
                { index: 6, showAs: "[content-type" }
            ]);
        });

        it("should suggest seen input-matching header names from context", () => {
            let input = "header[cont";

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input, [
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
                { index: 7, showAs: "cont" },
                { index: 7, showAs: "content-type" }
            ]);
        });

        it("should suggest seen header values from context, if available", () => {
            let input = "header[content-type]=";

            const suggestions = getSuggestions(SelectableSearchFilterClasses, input, [
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
                ["header", "Match exchanges by header"],
                ["header[date", "Match exchanges with a 'date' header"],
                ["header[date]=",
                    "Match exchanges with a 'date' header equal to a given value"],
                ["header[date]*=json",
                    "Match exchanges with a 'date' header containing 'json'"]
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
});