import * as path from 'path';
import { spawn, ChildProcess } from 'child_process';
import * as StaticServer from 'static-server';
import * as puppeteer from 'puppeteer';

import { expect } from '../test-setup';

function startWebServer() {
    return new Promise((resolve) => {
        new StaticServer({
            port: 7654,
            rootPath: path.join(__dirname, '..', '..', 'dist')
        }).start(resolve)
    });
}

async function startServer() {
    process.env.OCLIF_TS_NODE = '0';
    const serverPath = path.join('.httptoolkit-server', 'httptoolkit-server', 'bin', 'run');
    const serverProcess = spawn(serverPath, ['start'], {
        stdio: 'inherit'
    });
    serverProcess.on('error', (error) => console.error('Server start failed', error));
    serverProcess.on('exit', (code, signal) => {
        console.log(`Server exited with ${code ?? signal}`);
    });

    return serverProcess;
}

describe('Smoke test', function () {
    this.timeout(10000);

    let browser: puppeteer.Browser;
    let server: ChildProcess;

    beforeEach(async () => {
        [ browser, server ] = await Promise.all([
            puppeteer.launch({
                headless: true,
                defaultViewport: { width: 1280, height: 1024 },
                slowMo: 0,
                timeout: 10000,
                args: ['--no-sandbox']
            }),
            startServer(),
            startWebServer()
        ]);

        console.log(`Testing with browser ${await browser.version()}`);
    });

    afterEach(async () => {
        await Promise.all([
            browser.close(),
            server.kill()
        ]);
    });

    it('can load the app', async () => {
        const page = await browser.newPage();
        await page.goto('http://localhost:7654');

        await page.waitForSelector('h1');
        const heading = await page.$eval('h1', (h1) => h1.innerHTML);

        expect(heading).to.equal('Intercept HTTP');
    });
});