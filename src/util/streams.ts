export function byteStreamToLines(stream: ReadableStream<Uint8Array>) {
    const newlineMatcher = /\r?\n/;
    const decoder = new TextDecoder();

    let reader: ReadableStreamDefaultReader<Uint8Array>;
    let currentLine = '';

    return new ReadableStream<string>({
        start() {
            reader = stream.getReader();
        },
        async pull(controller) {
            const { done, value } = await reader.read();

            if (done) {
                // If the stream closes cleanly, all data up to the end
                // (if there is any) is our final line:
                if (currentLine.length > 0) {
                    controller.enqueue(currentLine);
                }
                controller.close();
            }

            const chunk = decoder.decode(value, { stream: true });
            currentLine += chunk;

            const parts = currentLine.split(newlineMatcher);

            // The last part is incomplete, so becomes our current line:
            currentLine = parts.pop() ?? '';

            // Every other part is a complete line:
            for (const part of parts) controller.enqueue(part);
        },
        cancel(reason) {
            reader.cancel(reason);
        }
    });
}

export function parseJsonLinesStream<T = unknown>(stream: ReadableStream<string>) {
    let reader: ReadableStreamDefaultReader<string>;

    return new ReadableStream<T>({
        start() {
            reader = stream.getReader();
        },
        async pull(controller) {
            const { done, value } = await reader.read();

            if (done) return controller.close();
            else controller.enqueue(JSON.parse(value));
        },
        cancel(reason) {
            reader.cancel(reason);
        }
    });
}

export const emptyStream = () => new ReadableStream({
    start(controller) {
        controller.close();
    }
});