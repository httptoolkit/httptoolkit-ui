import { expect } from '../../../test-setup';

import { OperationRegistry } from '../../../../src/services/ui-api/api-registry';
import { Operation, OperationResult } from '../../../../src/services/ui-api/api-types';

function makeOperation(name: string, handler?: () => Promise<OperationResult>): Operation {
    return {
        definition: {
            name,
            description: `Test operation ${name}`,
            category: 'test',
            inputSchema: { type: 'object' },
            outputSchema: { type: 'object' }
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

        it('should return full list regardless of payment status', () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('op.one'));
            registry.register(makeOperation('op.two'));

            const defs = registry.getDefinitions();
            expect(defs).to.have.length(2);
        });
    });

    describe('execute()', () => {

        it('should call the handler and return its result when paid', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', async () => ({
                success: true,
                data: { result: 42 }
            })));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(true);
            expect(result.data).to.deep.equal({ result: 42 });
        });

        it('should return PRO_REQUIRED error when unpaid', async () => {
            const registry = new OperationRegistry(() => false);
            registry.register(makeOperation('test.op'));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('PRO_REQUIRED');
        });

        it('should return UNKNOWN_OPERATION error for unknown operation name', async () => {
            const registry = new OperationRegistry(() => true);

            const result = await registry.execute('nonexistent', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('UNKNOWN_OPERATION');
        });

        it('should catch handler errors and return EXECUTION_ERROR', async () => {
            const registry = new OperationRegistry(() => true);
            registry.register(makeOperation('test.op', async () => {
                throw new Error('Something went wrong');
            }));

            const result = await registry.execute('test.op', {});
            expect(result.success).to.equal(false);
            expect(result.error!.code).to.equal('EXECUTION_ERROR');
            expect(result.error!.message).to.equal('Something went wrong');
        });

    });
});
