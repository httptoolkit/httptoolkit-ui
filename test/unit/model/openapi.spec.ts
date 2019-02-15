import { expect, getExchange } from '../../test-setup';

import { getParameters } from '../../../src/model/openapi';

describe('OpenAPI support', () => {
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
                    value: '2018-09-1T12:00:00'
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
                    value: 'pimterry'
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
                    value: '1234'
                }
            ]);
        });
    });
});