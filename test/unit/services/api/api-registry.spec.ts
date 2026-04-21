import { expect } from '../../../test-setup';

import { OperationRegistry } from '../../../../src/services/ui-api/api-registry';
import { Operation, OperationResult } from '../../../../src/services/ui-api/api-types';

function makeOperation(
    name: string,
    overrides?: Partial<Operation['definition']>,
    handler?: () => Promise<OperationResult>
): Operation {
    return {
        definition: {
            name,
            description: `Test operation ${name}`,
            category: 'test',
            tiers: ['free', 'pro'],
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' },
            ...overrides
        },
        handler: handler || (async () => ({ success: true, data: { ok: true } }))
    };
}

describe('OperationRegistry', () => {

    describe('getDefinitions()', () => {

        it('should return registered operation definitions', () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op'));

            const defs = registry.getDefinitions();
            expect(defs).to.have.length(1);
            expect(defs[0].name).to.equal('test.op');
        });

        it('should hide operations whose tiers do not include the user tier', () => {
            const registry = new OperationRegistry(() => true); // pro user
            registry.register(makeOperation('free.only', { tiers: ['free'] }));
            registry.register(makeOperation('pro.op', { tiers: ['pro'] }));
            registry.register(makeOperation('both', { tiers: ['free', 'pro'] }));

            const defs = registry.getDefinitions();
            expect(defs.map(d => d.name)).to.deep.equal(['pro.op', 'both']);
        });

        it('should show free-only operations to free users', () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('free.only', { tiers: ['free'] }));
            registry.register(makeOperation('pro.only', { tiers: ['pro'] }));

            const defs = registry.getDefinitions();
            expect(defs.map(d => d.name)).to.deep.equal(['free.only']);
        });

        it('should not augment descriptions for pro users', () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', {
                sessionLimit: 10
            }));

            const defs = registry.getDefinitions();
            expect(defs[0].description).to.equal('Test operation test.op');
        });

        it('should augment descriptions with session limit info for free users', () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('test.op', {
                sessionLimit: 10
            }));

            const defs = registry.getDefinitions();
            expect(defs[0].description).to.include('Limited to 10 calls per session');
        });

        it('should not augment descriptions for free users when there is no session limit or note', () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('test.op'));

            const defs = registry.getDefinitions();
            expect(defs[0].description).to.equal('Test operation test.op');
        });

        it('should append freeTierNote to descriptions for free users', () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('test.op', {
                freeTierNote: 'Bodies are capped at 100 chars per call.'
            }));

            const defs = registry.getDefinitions();
            expect(defs[0].description).to.include('[Free tier] Bodies are capped at 100 chars per call.');
        });

        it('should not append freeTierNote for pro users', () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', {
                freeTierNote: 'Bodies are capped at 100 chars per call.'
            }));

            const defs = registry.getDefinitions();
            expect(defs[0].description).to.equal('Test operation test.op');
        });
    });

    describe('execute()', () => {

        it('should call the handler and return its result for a free+pro operation', async () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('test.op', { tiers: ['free', 'pro'] }, async () => ({
                success: true,
                data: { result: 42 }
            })));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(true);
            expect(result.data).to.deep.equal({ result: 42 });
        });

        it('should return TIER_REQUIRED for pro-only operation when unpaid', async () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('pro.op', { tiers: ['pro'] }));

            const result = await registry.execute('pro.op', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('TIER_REQUIRED_PRO');
        });

        it('should allow pro-only operation when paid', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('pro.op', { tiers: ['pro'] }));

            const result = await registry.execute('pro.op', {});
            expect(result.success).to.equal(true);
        });

        it('should return UNKNOWN_OPERATION error for unknown operation name', async () => {
            const registry = new OperationRegistry(() => true);

            const result = await registry.execute('nonexistent', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('UNKNOWN_OPERATION');
        });

        it('should catch handler errors and return EXECUTION_ERROR', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', {}, async () => {
                throw new Error('Something went wrong');
            }));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('EXECUTION_ERROR');
            expect(result.error!.message).to.equal('Something went wrong');
        });

        it('should enforce session limits for free users', async () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('limited.op', { sessionLimit: 2 }));

            const result1 = await registry.execute('limited.op', {});
            expect(result1.success).to.equal(true);

            const result2 = await registry.execute('limited.op', {});
            expect(result2.success).to.equal(true);

            const result3 = await registry.execute('limited.op', {});
            expect(result3.success).to.equal(false);
            expect(result3.error!.code).to.equal('SESSION_LIMIT');
        });

        it('should track session limits independently per operation', async () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('op.a', { sessionLimit: 1 }));
            registry.register(makeOperation('op.b', { sessionLimit: 1 }));

            await registry.execute('op.a', {});

            // op.b should still have its own counter
            const result = await registry.execute('op.b', {});
            expect(result.success).to.equal(true);
        });

        it('should not enforce session limits for pro users', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('limited.op', { sessionLimit: 1 }));

            const result1 = await registry.execute('limited.op', {});
            expect(result1.success).to.equal(true);

            const result2 = await registry.execute('limited.op', {});
            expect(result2.success).to.equal(true);
        });

        it('should JSON-roundtrip the result to strip non-serializable values', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', {}, async () => ({
                success: true as const,
                data: { value: 'hello', fn: undefined }
            })));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(true);
            expect(result.data).to.deep.equal({ value: 'hello' });
        });
    });
});
