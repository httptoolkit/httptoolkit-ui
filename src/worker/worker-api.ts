import Worker = require('worker-loader!./background-worker');

const worker = new Worker();

export function send() {
    worker.postMessage({ a: 1 });
}

worker.onmessage = (event) => {
    console.log('Got worker event', event);
};

worker.addEventListener("message", (event) => {
    console.log('Got worker message', event);
});