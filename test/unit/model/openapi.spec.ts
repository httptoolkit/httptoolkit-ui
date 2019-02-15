import { expect, getExchange } from '../../test-setup';

import { getParameters, parseExchange, buildApiMetadata } from '../../../src/model/openapi';

import stripeSpec from 'openapi-directory/api/stripe.com.json';
const stripeApi = buildApiMetadata(stripeSpec);

describe('OpenAPI support', () => {
    describe('full exchange parsing', () => {

        it('should pull generic service info regardless of endpoint', async () => {
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
                operationName: 'GET /',
                operationDescription:
                    'The Stripe REST API. Please see https://stripe.com/docs/api for more details.',
                operationDocsUrl: undefined,
                parameters: [],
                validationErrors: []
            });
        });

        it('should pull detailed operation info for matching operations', async () => {
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
                operationName: 'GetAccount',
                operationDescription: '<p>Retrieves the details of the account.</p>',
                operationDocsUrl: undefined,
                parameters: [{
                    "deprecated": false,
                    "description": "Specifies which fields in the response should be expanded.",
                    "name": "expand",
                    "required": false,
                    "validationErrors": [],
                    "value": undefined
                }, {
                    "deprecated": false,
                    "description": "The identifier of the account to retrieve. If none is provided, the account associated with the API key is returned.",
                    "name": "account",
                    "required": false,
                    "validationErrors": [],
                    "value": 'abc'
                }],
                validationErrors: [],
            });
        });

        it('should should report an error for deprecated operations', async () => {
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
                operationName: 'GetBitcoinTransactions',
                operationDescription: '<p>List bitcoin transacitons for a given receiver.</p>',
                validationErrors: [`The 'GetBitcoinTransactions' operation is deprecated`]
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
                    description: 'Timestamp in ISO 8601 format.',
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
                    description: 'Timestamp in ISO 8601 format.',
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
                            description: 'Account id.',
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
                    description: 'Account id.',
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
                    description: 'Name of user.',
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
                    description: 'Secret.',
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
                    description: 'The account id.',
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
                    description: 'The account id.',
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
                    description: 'A number.',
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
                    description: 'A number.',
                    name: 'num',
                    value: 'abc',
                    validationErrors: [`'Num' should be number.`]
                }
            ]);
        });
    });
});