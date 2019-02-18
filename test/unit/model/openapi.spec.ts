import { expect, getExchange } from '../../test-setup';

import { getParameters, parseExchange, buildApiMetadata, getBody } from '../../../src/model/openapi';

import stripeSpec from 'openapi-directory/api/stripe.com.json';
import slackSpec from 'openapi-directory/api/slack.com.json';
const stripeApi = buildApiMetadata(stripeSpec);
const slackApi = buildApiMetadata(slackSpec);

describe('OpenAPI support', () => {
    describe('full exchange parsing', () => {

        it('should pull generic service info regardless of endpoint', () => {
            expect(
                parseExchange(
                    stripeApi,
                    getExchange({
                        hostname: 'api.stripe.com',
                        path: '/'
                    }),
                )
            ).to.deep.match({
                serviceTitle: 'Stripe',
                serviceLogoUrl: 'https://twitter.com/stripe/profile_image?size=original',
                operationName: { __html: '<p>GET /</p>' },
                operationDescription: {
                    __html:
                        '<p>The Stripe REST API. Please see <a href=\"https://stripe.com/docs/api\">' +
                        'https://stripe.com/docs/api</a> for more details.</p>',
                },
                operationDocsUrl: undefined,
                parameters: [],
                validationErrors: []
            });
        });

        it('should pull detailed operation info for matching operations', () => {
            expect(
                parseExchange(
                    stripeApi,
                    getExchange({
                        hostname: 'api.stripe.com',
                        path: '/v1/account',
                        query: '?account=abc'
                    }),
                )
            ).to.deep.match({
                serviceTitle: 'Stripe',
                serviceLogoUrl: 'https://twitter.com/stripe/profile_image?size=original',
                operationName: { __html: '<p>GetAccount</p>' },
                operationDescription: {
                    __html: '<p>Retrieves the details of the account.</p>'
                },
                operationDocsUrl: undefined,
                parameters: [{
                    "deprecated": false,
                    "description": {
                        __html: "<p>Specifies which fields in the response should be expanded.</p>"
                    },
                    "name": "expand",
                    "required": false,
                    "validationErrors": [],
                    "value": undefined
                }, {
                    "deprecated": false,
                    "description": {
                        __html:
                            "<p>The identifier of the account to retrieve. " +
                            "If none is provided, the account associated with the API key is returned.</p>"
                    },
                    "name": "account",
                    "required": false,
                    "validationErrors": [],
                    "value": 'abc'
                }],
                validationErrors: [],
            });
        });

        it('should report an error for deprecated operations', () => {
            expect(
                parseExchange(
                    stripeApi,
                    getExchange({
                        hostname: 'api.stripe.com',
                        path: '/v1/bitcoin/transactions',
                    }),
                )
            ).to.deep.match({
                serviceTitle: 'Stripe',
                serviceLogoUrl: 'https://twitter.com/stripe/profile_image?size=original',
                operationName: {
                    __html: '<p>GetBitcoinTransactions</p>'
                },
                operationDescription: {
                    __html: '<p>List bitcoin transacitons for a given receiver.</p>'
                },
                validationErrors: [`The 'GetBitcoinTransactions' operation is deprecated`]
            });
        });

        it('should include the response details', () => {
            expect(
                parseExchange(
                    slackApi,
                    getExchange({
                        hostname: 'slack.com',
                        path: '/api/bots.info',
                        statusCode: 200
                    }),
                )
            ).to.deep.match({
                responseDescription: { __html: '<p>When successful, returns bot info by bot ID.</p>' },
                validationErrors: []
            });
        });

        it('should fall back to default response details', () => {
            expect(
                parseExchange(
                    slackApi,
                    getExchange({
                        hostname: 'slack.com',
                        path: '/api/bots.info',
                        statusCode: 418
                    }),
                )
            ).to.deep.match({
                responseDescription: { __html: '<p>When no bot can be found, it returns an error.</p>' },
                validationErrors: []
            });
        });
    });

    describe('parameter parsing', () => {
        it('can parse query parameters', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            description: 'Timestamp in ISO 8601 format.',
                            in: 'query',
                            name: 'since',
                            schema: { 'type': 'string' }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: '?since=2018-09-1T12:00:00'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Timestamp in ISO 8601 format.</p>' },
                    name: 'since',
                    value: '2018-09-1T12:00:00',
                    validationErrors: []
                }
            ]);
        });

        it('returns undefined for missing query parameters', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            description: 'Timestamp in ISO 8601 format.',
                            in: 'query',
                            name: 'since',
                            schema: { 'type': 'string' }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: ''
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Timestamp in ISO 8601 format.</p>' },
                    name: 'since',
                    value: undefined,
                    validationErrors: []
                }
            ]);
        });

        it('returns arrays of multiple query parameters', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            description: '<p>Account id.</p>',
                            in: 'query',
                            name: 'id',
                            schema: { 'type': 'array' },
                            style: 'form',
                            explode: true
                        }],
                        responses: []
                    },
                    getExchange({
                        query: '?id=abc&id=def'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Account id.</p>' },
                    name: 'id',
                    value: ['abc', 'def'],
                    validationErrors: []
                }
            ]);
        });

        it('can parse path parameters', () => {
            expect(
                getParameters(
                    '/users/{username}',
                    {
                        parameters: [{
                            "description": "Name of user.",
                            "in": "path",
                            "name": "username",
                            "schema": { "type": "string" }
                        }],
                        responses: []
                    },
                    getExchange({
                        path: '/users/pimterry'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Name of user.</p>' },
                    name: 'username',
                    value: 'pimterry',
                    validationErrors: []
                }
            ]);
        });

        it('can parse header parameters', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            "description": "Secret.",
                            "in": "header",
                            "name": "X-Secret-Value",
                            "schema": { "type": "string" }
                        }],
                        responses: []
                    },
                    getExchange({
                        requestHeaders: {
                            'x-secret-value': '1234'
                        }
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Secret.</p>' },
                    name: 'X-Secret-Value',
                    value: '1234',
                    validationErrors: []
                }
            ]);
        });

        it('should add an error for missing required params', () => {
            expect(
                getParameters(
                    '/v1/account',
                    {
                        parameters: [{
                            "description": "The account id.",
                            "in": "query",
                            "name": "account",
                            "required": true,
                            "schema": { "type": "string" }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: ''
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>The account id.</p>' },
                    name: 'account',
                    value: undefined,
                    required: true,
                    validationErrors: [`The 'account' query parameter is required.`]
                }
            ]);
        });

        it('should add an error for use of deprecated params', () => {
            expect(
                getParameters(
                    '/v1/account',
                    {
                        parameters: [{
                            "description": "The account id.",
                            "in": "query",
                            "name": "account",
                            "deprecated": true,
                            "schema": { "type": "string" }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: '?account=qwe'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>The account id.</p>' },
                    name: 'account',
                    value: 'qwe',
                    required: false,
                    deprecated: true,
                    validationErrors: [`The 'account' query parameter is deprecated.`]
                }
            ]);
        });

        it('should coerce params according to their schema', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            "description": "A number.",
                            "in": "query",
                            "name": "num",
                            "schema": { "type": "number" }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: '?num=123'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>A number.</p>' },
                    name: 'num',
                    value: 123,
                    validationErrors: []
                }
            ]);
        });

        it('should validate params according to their schema', () => {
            expect(
                getParameters(
                    '/',
                    {
                        parameters: [{
                            "description": "A number.",
                            "in": "query",
                            "name": "num",
                            "schema": { "type": "number" }
                        }],
                        responses: []
                    },
                    getExchange({
                        query: '?num=abc'
                    })
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>A number.</p>' },
                    name: 'num',
                    value: 'abc',
                    validationErrors: [`'Num' should be number.`]
                }
            ]);
        });
    });

    describe('body parsing', () => {
        it('should return the request body schema', () => {
            expect(
                getBody(
                    {
                        description: 'My request body',
                        content: {
                            'text/plain': {
                                schema: {
                                    properties: {
                                        name: { type: "string" }
                                    }
                                }
                            }
                        }
                    }, getExchange({
                        requestHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).request
                )
            ).to.deep.match({
                description: 'My request body',
                properties: {
                    name: { type: "string" }
                }
            });
        });

        it('should return the response body schema', () => {
            expect(
                getBody(
                    {
                        content: {
                            'text/plain': {
                                schema: {
                                    properties: {
                                        matchedCorrectly: { type: "string" }
                                    }
                                }
                            }
                        }
                    }, getExchange({
                        responseHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).response
                )
            ).to.deep.match({
                properties: {
                    matchedCorrectly: { type: "string" }
                }
            });
        });

        it('should match partially wildcard content types', () => {
            expect(
                getBody(
                    {
                        description: 'My request body',
                        content: {
                            'text/*; charset=utf8': {
                                schema: {
                                    properties: {
                                        allGood: { type: "string" }
                                    }
                                }
                            },
                            'application/json': {
                                schema: {
                                    properties: {
                                        matchedIncorrectly: { type: "string" }
                                    }
                                }
                            }
                        }
                    }, getExchange({
                        requestHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).request
                )
            ).to.deep.match({
                properties: {
                    allGood: { type: "string" }
                }
            });
        });

        it('should match completely wildcard content types', () => {
            expect(
                getBody(
                    {
                        description: 'My request body',
                        content: {
                            'application/json': {
                                schema: {
                                    properties: {
                                        matchedIncorrectly: { type: "string" }
                                    }
                                }
                            },
                            '*/*': {
                                schema: {
                                    properties: {
                                        allGood: { type: "string" }
                                    }
                                }
                            },
                        }
                    }, getExchange({
                        requestHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).request
                )
            ).to.deep.match({
                properties: {
                    allGood: { type: "string" }
                }
            });
        });

        it('should match the most specific content type', () => {
            expect(
                getBody(
                    {
                        description: 'My request body',
                        content: {
                            'text/*': {
                                schema: {
                                    properties: {
                                        matchedTextStar: { type: "string" }
                                    }
                                }
                            },
                            'text/plain': {
                                schema: {
                                    properties: {
                                        matchedCorrectly: { type: "string" }
                                    }
                                }
                            },
                            '*/*': {
                                schema: {
                                    properties: {
                                        matchedPureWildcard: { type: "string" }
                                    }
                                }
                            },
                        }
                    }, getExchange({
                        requestHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).request
                )
            ).to.deep.match({
                properties: {
                    matchedCorrectly: { type: "string" }
                }
            });
        });

        it('should match the most specific content type', () => {
            expect(
                getBody(
                    {
                        description: 'My request body',
                        content: {
                            'text/*': {
                                schema: {
                                    properties: {
                                        matchedTextStar: { type: "string" }
                                    }
                                }
                            },
                            'text/plain': {
                                schema: {
                                    properties: {
                                        matchedTextPlain: { type: "string" }
                                    }
                                }
                            },
                            '*/*': {
                                schema: {
                                    properties: {
                                        matchedPureWildcard: { type: "string" }
                                    }
                                }
                            },
                        }
                    }, getExchange({
                        requestHeaders: {
                            'content-type': 'text/other'
                        }
                    }).request
                )
            ).to.deep.match({
                properties: {
                    matchedTextStar: { type: "string" }
                }
            });
        });
    });
});