declare module '@httptoolkit/httpsnippet' {
    import * as HARFormat from 'har-format';

    namespace HTTPSnippet {
        export type Target =
            | "c"
            | "clojure"
            | "csharp"
            | "go"
            | "java"
            | "javascript"
            | "node"
            | "objc"
            | "ocaml"
            | "php"
            | "powershell"
            | "python"
            | "ruby"
            | "shell"
            | "swift";

        export type Client = string; // Could be worth doing later, not for now

        export type TargetObject = {
            key: Target,
            title: string,
            extname: string,
            default: Client,
            clients: Array<{
                key: Client,
                title: string,
                link: string,
                description: string
            }>
        };

        export function availableTargets(): TargetObject[];
    }

    class HTTPSnippet {
        constructor(source: HARFormat.Request);
        convert(target: HTTPSnippet.Target, client?: HTTPSnippet.Client, options?: {}): string;
    }

    export = HTTPSnippet;
}