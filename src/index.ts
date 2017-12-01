import { getLocal } from 'mockttp';

let mockServer = getLocal({
    https: {
        keyPath: '../mockttp/test/fixtures/test-ca.key',
        certPath: '../mockttp/test/fixtures/test-ca.pem'
    }
});

mockServer.start().then(() => {
    console.log('Server started on', mockServer.port);

    setTimeout(() => {
        mockServer.stop();
    }, 30000);
});