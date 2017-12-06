import * as os from 'os';
import * as path from 'path';

import { getLocal } from 'mockttp';

const configDir = path.join(os.homedir(), '.httptoolkit/')

let mockServer = getLocal({
    https: {
        keyPath: path.join(configDir, 'ca.key'),
        certPath: path.join(configDir, 'ca.pem')
    },
    debug: true
});

mockServer.start().then(async () => {
    console.log('Server started on', mockServer.port);

    await mockServer.get('/').thenReply(200, 'Running!');
    await mockServer.anyRequest().always().thenPassThrough();
});