import { Operation, OperationResult } from './api-types';

const PRO_REQUIRED_ERROR: OperationResult = {
    success: false,
    error: {
        code: 'PRO_REQUIRED',
        message: 'This feature requires an HTTP Toolkit Pro subscription. ' +
                 'Get Pro at https://httptoolkit.com/pricing/ to unlock ' +
                 'programmatic access to HTTP Toolkit via MCP, CLI, and more.'
    }
};

export class OperationRegistry {

    private operations = new Map<string, Operation>();

    constructor(private isPaidUser: () => boolean) {}

    register(op: Operation): void {
        this.operations.set(op.definition.name, op);
    }

    getDefinitions() {
        return Array.from(this.operations.values()).map(op => op.definition);
    }

    async execute(name: string, params: Record<string, unknown>): Promise<OperationResult> {
        if (!this.isPaidUser()) {
            return PRO_REQUIRED_ERROR;
        }

        const op = this.operations.get(name);
        if (!op) {
            return {
                success: false,
                error: {
                    code: 'UNKNOWN_OPERATION',
                    message: `Unknown operation: ${name}`
                }
            };
        }

        try {
            const result = await op.handler(params);
            // JSON roundtrip to strip MobX observables, class instances, and other
            // non-cloneable objects before the result crosses the IPC boundary:
            return JSON.parse(JSON.stringify(result));
        } catch (e: any) {
            return {
                success: false,
                error: {
                    code: 'EXECUTION_ERROR',
                    message: e.message || String(e)
                }
            };
        }
    }
}
