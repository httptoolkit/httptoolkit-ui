import * as path from 'path';
import * as net from 'net';
import * as http from 'http';
import { spawn, ChildProcess } from 'child_process';
import * as StaticServer from 'static-server';
import * as puppeteer from 'puppeteer';

import { delay } from '../../src/util/promise';

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

async function getProxyPort(page: puppeteer.Page) {
    await page.waitForSelector('[data-interceptor-id=manual-setup]');

    return await page.evaluate(() => {
        const proxyPortText = document.querySelector('[data-interceptor-id=manual-setup] span');

        const proxyPortMatch = proxyPortText?.textContent?.match(/Proxy port: (\d+)/);
        if (!proxyPortMatch) throw new Error('Proxy port text not found');

        return parseInt(proxyPortMatch[1], 10);
    });
}

function sendRequest(proxyPort: number, url: string, options: http.RequestOptions = {}) {
    console.log(`Sending request to ${url} through proxy port ${proxyPort}`);
    return new Promise<void>((resolve, reject) => {
        const req = http.request(url, {
            ...options,
            createConnection: () => {
                return net.connect({
                    host: 'localhost',
                    port: proxyPort
                });
            }
        });
        req.end();

        req.on('error', reject);
        req.on('response', (res) => {
            console.log(`Response from ${url}: ${res.statusCode}`);
            res.resume();
            resolve();
        });
    });
}

async function getRowContents(page: puppeteer.Page, rowIndex: number) {
    const cells = await page.evaluate((index) => {
        const row = document.querySelector(`[aria-rowindex="${index}"]`);
        if (!row) throw new Error(`Row ${index} not found`);

        const cells = Array.from(row.querySelectorAll('[role=cell]'));
        return cells.map(cell => cell.textContent);
    }, rowIndex);

    return cells.slice(1); // Skip the row marker cell
}

describe('Smoke test', function () {
    this.timeout(10000);

    let browser: puppeteer.Browser;
    let server: ChildProcess;
    let page: puppeteer.Page;

    before(async () => {
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
        await page.close();
    });

    after(async () => {
        await Promise.all([
            browser.close(),
            server.kill(),
            Promise.race([
                new Promise((resolve) => server.on('exit', resolve)),
                delay(5000).then(() => server.kill('SIGKILL'))
            ])
        ]);
    });

    it('can load the app', async () => {
        page = await browser.newPage();
        await page.goto('http://localhost:7654');

        await page.waitForSelector('h1');
        const heading = await page.$eval('h1', (h1) => h1.innerHTML);

        expect(heading).to.equal('Intercept HTTP');
    });

    it('can show directly sent requests', async () => {
        page = await browser.newPage();
        await page.goto('http://localhost:7654');

        const proxyPort = await getProxyPort(page);

        // Sent in order, to make assertion order consistent
        await sendRequest(proxyPort, 'http://testserver.host/echo');
        await sendRequest(proxyPort, 'http://example.com/404');
        await sendRequest(proxyPort, 'http://testserver.host/anything', { method: 'POST' });

        await page.click('nav a[href="/view"]');

        await page.waitForSelector('[aria-rowindex]');
        const rowCount = await page.evaluate(() => {
            return document.querySelectorAll('[aria-rowindex]').length;
        });
        expect(rowCount).to.equal(3);

        expect(await getRowContents(page, 1)).to.deep.equal([
            'GET', '200', 'Unknown client', 'testserver.host', '/echo'
        ]);

        expect(await getRowContents(page, 2)).to.deep.equal([
            'GET', '404', 'Unknown client', 'example.com', '/404'
        ]);

        expect(await getRowContents(page, 3)).to.deep.equal([
            'POST', '200', 'Unknown client', 'testserver.host', '/anything'
        ]);

        await page.click('[aria-rowindex="3"]');

        // Check the basic request & response details are shown
        const requestSection = await page.waitForSelector('[aria-label="Request section"]');
        expect(await requestSection.evaluate(s => s.textContent)).to.include('http://testserver.host/anything');

        const responseSection = await page.waitForSelector('[aria-label="Response section"]');
        expect(await responseSection.evaluate(s => s.textContent)).to.include('Status: 200 OK');

        // Test the body is rendered & formatted (auto-indented JSON) OK
        const responseBody = await page.waitForSelector('[aria-label="Response Body section"]');
        expect(await responseBody.evaluate(s =>
            s.textContent?.replace(/\u00a0/g, ' ') // Replace nbsp with normal spaces, just for simplicity
        )).to.include('    "Host": "testserver.host:80"');
    });
});