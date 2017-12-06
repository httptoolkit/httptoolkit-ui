import * as os from 'os';
import * as path from 'path';
import * as url from 'url';

import { app, BrowserWindow } from 'electron';

import { getLocal } from 'mockttp';

const configDir = path.join(os.homedir(), '.httptoolkit/')

let mockServer = getLocal({
    https: {
        keyPath: path.join(configDir, 'ca.key'),
        certPath: path.join(configDir, 'ca.pem')
    }
});

mockServer.start().then(async () => {
    console.log('Server started on', mockServer.port);

    await mockServer.get('/').thenReply(200, 'Running!');
    await mockServer.anyRequest().always().thenPassThrough();
});


let mainWindow: Electron.BrowserWindow | null;

function createWindow() {
    mainWindow = new BrowserWindow({
        height: 600,
        width: 800,
    });

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, "../index.html"),
        protocol: "file:",
        slashes: true,
    }));

    // Open the DevTools.
    mainWindow.webContents.openDevTools();

    mainWindow.on("closed", () => { mainWindow = null; });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
    // On OS X it is common for applications and their menu bar
    // to stay active until the user quits explicitly with Cmd + Q
    if (process.platform !== "darwin") {
        app.quit();
    }
});

app.on("activate", () => {
    // On OS X it"s common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (mainWindow === null) {
        createWindow();
    }
});