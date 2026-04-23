import { Operation, OperationDefinition, OperationResult } from './api-types';

function tierRequiredError(tier: string): OperationResult {
    const displayTier = tier.charAt(0).toUpperCase() + tier.slice(1);
    return {
        success: false,
        error: {
            code: `TIER_REQUIRED_${tier.toUpperCase()}`,
            message: `This feature requires an HTTP Toolkit ${displayTier} subscription. ` +
                     `Get ${displayTier} at https://httptoolkit.com/pricing/ to unlock ` +
                     'programmatic access to HTTP Toolkit via MCP, CLI, and more.'
        }
    };
}

export class OperationRegistry {

    private operations = new Map<string, Operation>();
    private sessionLimitCounters = new Map<string, number>();

    constructor(private isPaidUser: () => boolean) {}

    register(op: Operation): void {
        this.operations.set(op.definition.name, op);
    }

    private getUserTier(): 'free' | 'pro' {
        return this.isPaidUser() ? 'pro' : 'free';
    }

    getDefinitions(): OperationDefinition[] {
        const tier = this.getUserTier();

        return Array.from(this.operations.values())
            .filter(op => {
                const { tiers } = op.definition;
                // Hide operations whose tiers don't include the current user's tier
                // (e.g. account.upgrade has tiers: ['free'] — hidden from pro users)
                if (!tiers.includes(tier)) return false;
                return true;
            })
            .map(op => {
                // Strip internal-only fields from output before sending to
                // external clients — they're only used here for augmentation.
                const { freeTierNote, sessionLimit, ...definition } = op.definition;

                if (tier === 'pro') return definition;

                // Augment descriptions for free users so AI agents understand limits
                let description = definition.description;

                if (sessionLimit) {
                    description += `\n\n[Free tier] Limited to ${sessionLimit} calls per session. ` +
                        'Use account.upgrade to subscribe to Pro for unlimited access.';
                }

                if (freeTierNote) {
                    description += `\n\n[Free tier] ${freeTierNote}`;
                }

                if (description === definition.description) return definition;
                return { ...definition, description };
            });
    }

    async execute(name: string, params: Record<string, unknown>): Promise<OperationResult> {
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

        const tier = this.getUserTier();
        const { tiers, sessionLimit } = op.definition;

        if (!tiers.includes(tier)) {
            const requiredTier = tiers[0]; // The first listed tier the user doesn't have
            return tierRequiredError(requiredTier);
        }

        // Check session limits for free users
        if (tier === 'free' && sessionLimit) {
            const count = this.sessionLimitCounters.get(name) ?? 0;
            if (count >= sessionLimit) {
                return {
                    success: false,
                    error: {
                        code: 'SESSION_LIMIT',
                        message: `Free users are limited to ${sessionLimit} calls per session. ` +
                            'Upgrade to HTTP Toolkit Pro for unlimited access: https://httptoolkit.com/pricing/'
                    }
                };
            }
            this.sessionLimitCounters.set(name, count + 1);
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
