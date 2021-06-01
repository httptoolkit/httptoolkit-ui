import { Method } from 'mockttp';

export type MethodName = keyof typeof Method;
export const MethodNames = Object.values(Method)
    .filter(
        value => typeof value === 'string'
    ) as Array<MethodName>;
