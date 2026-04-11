import { autorun, IReactionDisposer } from 'mobx';
import { AccountStore } from '../../model/account/account-store';
import { OperationRegistry } from './api-registry';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function startServerOperationBridge(
    registry: OperationRegistry,
    authToken: string | undefined,
    accountStore: AccountStore
) {
    let ws: WebSocket | null = null;
    let reconnectDelay = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposers: IReactionDisposer[] = [];

    function connect() {
        const url = `ws://127.0.0.1:45457/ui-operations`;

        try {
            ws = new WebSocket(url);
        } catch {
            scheduleReconnect();
            return;
        }

        ws.onopen = () => {
            reconnectDelay = RECONNECT_BASE_MS;
            sendConfiguration();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                handleMessage(msg);
            } catch {}
        };

        ws.onclose = () => {
            disposeAutoruns();
            ws = null;
            scheduleReconnect();
        };

        ws.onerror = () => {
            // Error will be followed by close
        };
    }

    function disposeAutoruns() {
        disposers.forEach(d => d());
        disposers = [];
    }

    function scheduleReconnect() {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
            connect();
        }, reconnectDelay);
    }

    function sendConfiguration() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;

        // On each JWT update, forward it to the server to manage auth there.
        disposers.push(autorun(() => {
            ws!.send(JSON.stringify({
                type: 'auth',
                token: authToken,
                // JWT must be false (not a paid user) or a valid JWT. N.b. we don't use
                // _maybe_ paid user - if not sure, we treat as free until the updated
                // JWT arrives, which will refresh this automatically.
                jwt: accountStore.user.isPaidUser()
                    ? accountStore.userJwt
                    : false
            }));
        }));

        disposers.push(autorun(() => {
            ws!.send(JSON.stringify({
                type: 'operations',
                operations: registry.getDefinitions()
            }));
        }));
    }

    function handleMessage(msg: any) {
        if (!msg) return;

        if (msg.type === 'auth-result') {
            if (!msg.success) {
                console.warn('Server auth failed:', msg.error);
            }
            return;
        }

        if (msg.type !== 'request') return;

        const { id, operation, params } = msg;

        registry.execute(operation, params || {}).then((result) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'response', id, result }));
            }
        });
    }

    connect();
}
