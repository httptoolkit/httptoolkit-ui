import { HttpExchange } from "./model/store";

export function getExchangeSummaryColour(exchange: HttpExchange) {
    if (exchange.request.method === 'POST') {
        return '#ce3939';
    } else if (exchange.request.path.endsWith('.js')) {
        return '#4c86af';
    } else if (exchange.request.path.endsWith('/') || exchange.request.path.endsWith('.html')) {
        return '#574caf';
    } else if (exchange.request.path.endsWith('.css')) {
        return '#af4c9a';
    } else if (exchange.request.path.endsWith('.jpg') ||
        exchange.request.path.endsWith('.jpeg') ||
        exchange.request.path.endsWith('.png') ||
        exchange.request.path.endsWith('.gif')) {
        return '#4caf7d';
    } else {
        return '#888';
    }
};

export function getStatusColor(status: undefined | number): string {
    if (!status || status < 100 || status >= 600) {
        // All odd undefined/unknown cases
        return '#000';
    } else if (status >= 500) {
        return '#ce3939';
    } else if (status >= 400) {
        return '#f1971f';
    } else if (status >= 300) {
        return '#5a80cc';
    } else if (status >= 200) {
        return '#4caf7d';
    } else if (status >= 100) {
        return '#888';
    }

    // Anything else weird.
    return '#000';
}