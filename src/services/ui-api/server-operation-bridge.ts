import { OperationRegistry } from './api-registry';

const RECONNECT_BASE_MS = 1_000;
const RECONNECT_MAX_MS = 30_000;

export function startServerOperationBridge(
    registry: OperationRegistry,
    authToken: string | undefined
) {
    let ws: WebSocket | null = null;
    let reconnectDelay = RECONNECT_BASE_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let destroyed = false;

    function connect() {
        if (destroyed) return;

        const url = authToken
            ? `ws://127.0.0.1:45457/ui-operations?token=${encodeURIComponent(authToken)}`
            : `ws://127.0.0.1:45457/ui-operations`;

        try {
            ws = new WebSocket(url);
        } catch {
            scheduleReconnect();
            return;
        }

        ws.onopen = () => {
            reconnectDelay = RECONNECT_BASE_MS;
            sendOperations();
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data as string);
                handleMessage(msg);
            } catch {}
        };

        ws.onclose = () => {
            ws = null;
            scheduleReconnect();
        };

        ws.onerror = () => {
            // Error will be followed by close
        };
    }

    function scheduleReconnect() {
        if (destroyed || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            reconnectDelay = Math.min(reconnectDelay * 2, RECONNECT_MAX_MS);
            connect();
        }, reconnectDelay);
    }

    function sendOperations() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        ws.send(JSON.stringify({
            type: 'operations',
            operations: registry.getDefinitions()
        }));
    }

    function handleMessage(msg: any) {
        if (!msg || msg.type !== 'request') return;

        const { id, operation, params } = msg;

        registry.execute(operation, params || {}).then((result) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'response',
                    id,
                    result
                }));
            }
        }).catch((err) => {
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({
                    type: 'response',
                    id,
                    error: err.message || String(err)
                }));
            }
        });
    }

    connect();

    return {
        destroy() {
            destroyed = true;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (ws) {
                ws.close();
                ws = null;
            }
        }
    };
}
