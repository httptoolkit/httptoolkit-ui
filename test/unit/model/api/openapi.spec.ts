import { expect } from '../../../test-setup';
import { getExchangeData } from '../../unit-test-helpers';

import { buildOpenApiMetadata } from '../../../../src/model/api/build-api-metadata';
import {
    OpenApiExchange,
    getParameters,
    getBodySchema
} from '../../../../src/model/api/openapi';

import stripeSpec from 'openapi-directory/api/stripe.com.json';
import slackSpec from 'openapi-directory/api/slack.com.json';
import { OpenAPIObject } from 'openapi-directory';
const stripeApi = buildOpenApiMetadata(stripeSpec);
const slackApi = buildOpenApiMetadata(slackSpec);

describe('OpenAPI support', () => {
    describe('full exchange parsing', () => {

        it('should pull generic service info regardless of endpoint', async () => {
            expect(
                new OpenApiExchange(
                    await stripeApi,
                    getExchangeData({
                        hostname: 'api.stripe.com',
                        path: '/'
                    }),
                )
            ).to.deep.match({
                service: {
                    name: 'Stripe API',
                    logoUrl: 'https://twitter.com/stripe/profile_image?size=original',
                    description: {
                        __html:
                            '<p>The Stripe REST API. Please see ' +
                            '<a href="https://stripe.com/docs/api" target="_blank" rel="noreferrer">' +
                            'https://stripe.com/docs/api</a> for more details.</p>'
                    },
                    docsUrl: undefined,
                },
                operation: {
                    name: 'GET /',
                    description: undefined,
                    docsUrl: undefined,
                    warnings: [
                        `Unknown operation 'GET /'.`
                    ]
                },
                request: {
                    parameters: [],
                    bodySchema: {}
                }
            });
        });

        it('should pull detailed operation info for matching operations', async () => {
            expect(
                new OpenApiExchange(
                    await stripeApi,
                    getExchangeData({
                        hostname: 'api.stripe.com',
                        path: '/v1/account',
                        query: '?account=abc'
                    }),
                )
            ).to.deep.match({
                operation: {
                    name: 'GetAccount',
                    description: { __html: '<p>Retrieves the details of an account.</p>' },
                    docsUrl: undefined,
                    warnings: []
                },
                request: {
                    parameters: [{
                        deprecated: false,
                        description: {
                            __html: "<p>Specifies which fields in the response should be expanded.</p>"
                        },
                        name: "expand",
                        required: false,
                        warnings: [],
                        value: undefined
                    }]
                }
            });
        });

        it('should respect x-http-method-override', async () => {
            expect(
                new OpenApiExchange(
                    await stripeApi,
                    getExchangeData({
                        hostname: 'api.stripe.com',
                        path: '/v1/accounts',
                        query: '?account=abc',
                        requestHeaders: {
                            'x-http-method-override': 'POST'
                        }
                    }),
                )
            ).to.deep.match({
                operation: {
                    name: 'PostAccounts',
                }
            });
        });

        it('should report an error for deprecated operations', async () => {
            expect(
                new OpenApiExchange(
                    await stripeApi,
                    getExchangeData({
                        hostname: 'api.stripe.com',
                        path: '/v1/customers/123/bank_accounts',
                    }),
                )
            ).to.deep.match({
                operation: {
                    name: 'GetCustomersCustomerBankAccounts',
                    description: {
                        __html: "<p>You can see a list of the bank accounts belonging to a Customer. Note that the 10 most recent sources are always available by default on the Customer. If you need more than those 10, you can use this API method and the <code>limit</code> and <code>starting_after</code> parameters to page through additional bank accounts.</p>"
                    },
                    warnings: [`The 'GetCustomersCustomerBankAccounts' operation is deprecated.`]
                }
            });
        });

        it('should include the response details', async () => {
            expect(
                new OpenApiExchange(
                    await slackApi,
                    getExchangeData({
                        hostname: 'slack.com',
                        path: '/api/bots.info',
                        statusCode: 200
                    }),
                )
            ).to.deep.match({
                response: {
                    description: { __html: '<p>When successful, returns bot info by bot ID.</p>' },
                }
            });
        });

        it('should fall back to default response details', async () => {
            expect(
                new OpenApiExchange(
                    await slackApi,
                    getExchangeData({
                        hostname: 'slack.com',
                        path: '/api/bots.info',
                        statusCode: 418
                    }),
                )
            ).to.deep.match({
                response: {
                    description: { __html: '<p>When no bot can be found, it returns an error.</p>' },
                }
            });
        });
    });

    describe('parameter parsing', () => {
        it('can parse query parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        description: 'Timestamp in ISO 8601 format.',
                        in: 'query',
                        name: 'since',
                        schema: { 'type': 'string' }
                    }],
                    getExchangeData({
                        query: '?since=2018-09-1T12:00:00'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Timestamp in ISO 8601 format.</p>' },
                    name: 'since',
                    value: '2018-09-1T12:00:00',
                    warnings: []
                }
            ]);
        });

        it('can parse exploded query parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        description: 'List of formats.',
                        in: 'query',
                        name: 'formats',
                        schema: {
                            type: 'array',
                            items: {
                                type: 'string'
                            }
                        }
                    }],
                    getExchangeData({
                        query: '?formats=json&formats=xml'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>List of formats.</p>' },
                    name: 'formats',
                    value: ['json', 'xml'],
                    warnings: []
                }
            ]);
        });

        it('can parse CSV query parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        description: 'List of formats.',
                        in: 'query',
                        name: 'formats',
                        style: 'form',
                        explode: false,
                        schema: {
                            type: 'array',
                            items: {
                                type: 'string'
                            }
                        }
                    }],
                    getExchangeData({
                        query: '?formats=json,xml'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>List of formats.</p>' },
                    name: 'formats',
                    value: ['json', 'xml'],
                    warnings: []
                }
            ]);
        });

        it('returns undefined for missing query parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        description: 'Timestamp in ISO 8601 format.',
                        in: 'query',
                        name: 'since',
                        schema: { 'type': 'string' }
                    }],
                    getExchangeData({
                        query: ''
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Timestamp in ISO 8601 format.</p>' },
                    name: 'since',
                    value: undefined,
                    warnings: []
                }
            ]);
        });

        it('returns arrays of multiple query parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        description: '<p>Account id.</p>',
                        in: 'query',
                        name: 'id',
                        schema: { 'type': 'array' },
                        style: 'form',
                        explode: true
                    }],
                    getExchangeData({
                        query: '?id=abc&id=def'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Account id.</p>' },
                    name: 'id',
                    value: ['abc', 'def'],
                    warnings: []
                }
            ]);
        });

        it('can parse path parameters', () => {
            expect(
                getParameters(
                    '/users/{username}/{content_id}',
                    [
                        {
                            "description": "Name of user.",
                            "in": "path",
                            "name": "username",
                            "schema": {
                                "type": "string",
                                "default": "me"
                            },
                        },
                        {
                            "description": "Content id.",
                            "in": "path",
                            "name": "content_id",
                            "schema": {
                                "type": "number"
                            },
                        }
                    ],
                    getExchangeData({
                        path: '/users/pimterry/123'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Name of user.</p>' },
                    name: 'username',
                    value: 'pimterry',
                    defaultValue: 'me',
                    warnings: []
                },
                {
                    description: { __html: '<p>Content id.</p>' },
                    name: 'content_id',
                    value: 123,
                    warnings: []
                }
            ]);
        });

        it('can parse header parameters', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        "description": "Secret.",
                        "in": "header",
                        "name": "X-Secret-Value",
                        "schema": { "type": "string" }
                    }],
                    getExchangeData({
                        requestHeaders: {
                            'x-secret-value': '1234'
                        }
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Secret.</p>' },
                    name: 'X-Secret-Value',
                    value: '1234',
                    warnings: []
                }
            ]);
        });

        it('should add an error for missing required params', () => {
            expect(
                getParameters(
                    '/v1/account',
                    [{
                        "description": "The account id.",
                        "in": "query",
                        "name": "account",
                        "required": true,
                        "schema": { "type": "string" }
                    }],
                    getExchangeData({
                        query: ''
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>The account id.</p>' },
                    name: 'account',
                    value: undefined,
                    required: true,
                    warnings: [`The 'account' query parameter is required.`]
                }
            ]);
        });

        it('should not add an error for empty required-empty params', () => {
            expect(
                getParameters(
                    '/v1/account',
                    [{
                        "name": "isTest",
                        "description": "Is this for testing?",
                        "in": "query",
                        "required": true,
                        "allowEmptyValue": true,
                        "schema": {
                            "type": "boolean",
                            "enum": [true]
                        }
                    }],
                    getExchangeData({
                        query: '?isTest'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>Is this for testing?</p>' },
                    name: 'isTest',
                    value: true,
                    required: true,
                    warnings: []
                }
            ]);
        });

        it('should add an error for use of deprecated params', () => {
            expect(
                getParameters(
                    '/v1/account',
                    [{
                        "description": "The account id.",
                        "in": "query",
                        "name": "account",
                        "deprecated": true,
                        "schema": { "type": "string" }
                    }],
                    getExchangeData({
                        query: '?account=qwe'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>The account id.</p>' },
                    name: 'account',
                    value: 'qwe',
                    required: false,
                    deprecated: true,
                    warnings: [`The 'account' query parameter is deprecated.`]
                }
            ]);
        });

        it('should coerce params according to their schema', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        "description": "A number.",
                        "in": "query",
                        "name": "num",
                        "schema": { "type": "number" }
                    }],
                    getExchangeData({
                        query: '?num=123'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>A number.</p>' },
                    name: 'num',
                    value: 123,
                    warnings: []
                }
            ]);
        });

        it('should validate params according to their schema', () => {
            expect(
                getParameters(
                    '/',
                    [{
                        "description": "A number.",
                        "in": "query",
                        "name": "num",
                        "schema": { "type": "number" }
                    }],
                    getExchangeData({
                        query: '?num=abc'
                    }).request
                )
            ).to.deep.match([
                {
                    description: { __html: '<p>A number.</p>' },
                    name: 'num',
                    value: 'abc',
                    warnings: [`num ("abc") must be number.`]
                }
            ]);
        });
    });

    describe('body parsing', () => {
        it('should return the request body schema', () => {
            expect(
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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
        it('should return the request body schema with refs', () => {
            expect(
                getBodySchema(
                    {
                        components: {
                            nameProp: {
                                type: "string"
                            }
                        }
                    } as unknown as OpenAPIObject,
                    {
                        description: 'My request body',
                        content: {
                            'text/plain': {
                                schema: {
                                    properties: {
                                        name: { $ref: "#/components/nameProp" }
                                    }
                                }
                            }
                        }
                    }, getExchangeData({
                        requestHeaders: {
                            'content-type': 'text/plain'
                        }
                    }).request
                )
            ).to.deep.match({
                description: 'My request body',
                components: {
                    nameProp: {
                        type: "string"
                    }
                },
                properties: {
                    name: { $ref: "#/components/nameProp" }
                }
            });
        });

        it('should return the response body schema', () => {
            expect(
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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

        it('should match the most specific content type, using wildcards where appropriate', () => {
            expect(
                getBodySchema(
                    {} as OpenAPIObject,
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
                    }, getExchangeData({
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