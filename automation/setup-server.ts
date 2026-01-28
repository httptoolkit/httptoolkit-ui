import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import { promisify } from 'util';

import * as _ from 'lodash';
import * as semver from 'semver';
import fetch from 'node-fetch';
import * as targz from 'targz';

const extractTarGz = promisify(targz.decompress);
const deleteFile = promisify(fs.unlink);

const canAccess = (path: string) => promisify(fs.access)(path).then(() => true).catch(() => false);

const SERVER_PATH = path.join(__dirname, '..', '.httptoolkit-server');

async function setUpLocalEnv() {
    const existingServerPackageJsonPath = path.join(SERVER_PATH, 'httptoolkit-server', 'package.json');
    const serverExists = await canAccess(existingServerPackageJsonPath);
    const currentServerVersion = serverExists
        ? require(existingServerPackageJsonPath).version
        : null;

    const latestServerDetails = await getLatestServerDetails().catch((e) => {
        if (serverExists) {
            // If we can ignore this, do - let's just use what we've got
            console.log(`Failed to fetch latest server due to '${e.message}' - using existing for now`);
            process.exit(0);
        } else {
            throw e;
        }
    });
    const latestServerVersion = latestServerDetails.tag_name;

    if (!serverExists || semver.gt(latestServerVersion, currentServerVersion)) {
        await downloadServer(latestServerDetails);
        console.log('Server setup completed.');
    } else {
        console.log('Downloaded server already up to date.');
    }
}

async function getLatestServerDetails() {
    const headers: { Authorization: string } | {} = process.env.GITHUB_TOKEN
        ? { Authorization: `token ${process.env.GITHUB_TOKEN}` }
        : {}

    const response = await fetch(
        'https://api.github.com/repos/httptoolkit/httptoolkit-server/releases/latest',
        { headers }
    );
    if (!response.ok) {
        console.log(`${response.status} response, body: `, await response.text(), '\n');
        throw new Error(`Server releases request rejected with ${response.status}`);
    }

    return response.json();
}

async function downloadServer(
    latestServerDetails: any
) {
    console.log(`Downloading latest httptoolkit-server...`);

    const platform = os.platform();
    const arch = os.arch();
    const assetRegex = new RegExp(`httptoolkit-server-v[\\d\\.]+-${platform}-${arch}\\.tar\\.gz`);

    if (!latestServerDetails.assets) {
        console.error(JSON.stringify(latestServerDetails, null, 2));
        throw new Error('Could not retrieve latest server assets');
    }

    const asset = latestServerDetails.assets
        .filter((asset: { name: string }) => asset.name.match(assetRegex))[0];

    if (!asset) {
        throw new Error(`No server download available matching ${assetRegex.toString()}`);
    }

    console.log(`Downloading server from ${asset.browser_download_url}...`);

    const downloadPath = path.join(__dirname, 'httptoolkit-server.tar.gz');

    const assetDownload = await fetch(asset.browser_download_url);
    const assetWrite = assetDownload.body.pipe(fs.createWriteStream(downloadPath));

    await new Promise((resolve, reject) => {
        assetWrite.on('finish', resolve);
        assetWrite.on('error', reject);
    });

    console.log(`Extracting server to ${SERVER_PATH}`);
    await extractTarGz({
        src: downloadPath,
        dest: SERVER_PATH,
        tar: {
            ignore (_, header) {
                // Extract only files & directories - ignore symlinks or similar
                // which can sneak in in some cases (e.g. native dep build envs)
                return header!.type !== 'file' && header!.type !== 'directory'
            }
        }
    });
    await deleteFile(downloadPath);

    console.log('Server download completed');
}

setUpLocalEnv().catch(e => {
    console.error(e);
    process.exit(1);
});