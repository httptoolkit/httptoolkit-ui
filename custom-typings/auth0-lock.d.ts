// Auth0-lock types don't include the passwordless constructor, so extend them:
declare module 'auth0-lock' {
    interface Auth0LockPasswordlessConstructorOptions extends Auth0LockConstructorOptions {
        passwordlessMethod: 'code'
    }

    export type Auth0LockPasswordlessStatic = Auth0LockStatic & {
        new (
            clientId: string,
            domain: string,
            options?: Auth0LockPasswordlessConstructorOptions
        ): Auth0LockStatic;
    }

    export const Auth0LockPasswordless: Auth0LockPasswordlessStatic;
}