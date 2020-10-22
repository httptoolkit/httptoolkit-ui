import * as path from 'path';
import { runHTK } from 'httptoolkit-server';
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

describe('Smoke test', function () {
    this.timeout(10000);

    let browser: puppeteer.Browser;

    beforeEach(async () => {
        [ browser ] = await Promise.all<puppeteer.Browser, unknown, unknown>([
            puppeteer.launch({
                headless: true,
                slowMo: 0,
                timeout: 10000,
                args: ['--no-sandbox']
            }),
            runHTK({}),
            startWebServer()
        ]);
    });

    afterEach(() => {
        browser.close();
    });

    it('can load the app', async () => {
        const page = await browser.newPage();
        await page.goto('http://local.httptoolkit.tech:7654');

        await page.waitFor('h1');
        const heading = await page.$eval('h1', (h1) => h1.innerHTML);

        expect(heading).to.equal('Intercept HTTP');
    });
});