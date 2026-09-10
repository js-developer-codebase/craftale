const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");

const path = require("path");
const fs = require("fs");


/*
|--------------------------------------------------------------------------
| Terminal Manager
|--------------------------------------------------------------------------
*/

const terminalManager =
    require("./ipc/terminal.cjs");

const watcherManager =
    require("./ipc/watcher.cjs");

require("./ipc/fileSystem.cjs");
require("./ipc/search.cjs");


/*
|--------------------------------------------------------------------------
| Create Window
|--------------------------------------------------------------------------
*/

function createWindow() {

    const window = new BrowserWindow({

        width: 1400,

        height: 900,

        minWidth: 900,

        minHeight: 600,

        backgroundColor: "#1e1e1e",

        webPreferences: {

            preload: path.join(
                __dirname,
                "preload.cjs"
            ),

            contextIsolation: true,

            nodeIntegration: false

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Initialize Terminal Manager
    |--------------------------------------------------------------------------
    |
    | Pass window reference so PTY output can be sent
    | to the renderer via webContents.send().
    |
    */

    terminalManager.initialize(
        window
    );

    watcherManager.initialize(
        window
    );


    /*
    |--------------------------------------------------------------------------
    | Load Application
    |--------------------------------------------------------------------------
    |
    | In development, load from Vite dev server.
    | In production, load the built files from disk.
    |
    */

    const isDev =
        !app.isPackaged;

    if (isDev) {

        window.loadURL(
            "http://localhost:5173"
        );

    } else {

        window.loadFile(
            path.join(
                __dirname,
                "..",
                "dist",
                "index.html"
            )
        );

    }


    /*
    |--------------------------------------------------------------------------
    | DevTools
    |--------------------------------------------------------------------------
    */

    window.webContents.openDevTools();

}


/*
|--------------------------------------------------------------------------
| Application Ready
|--------------------------------------------------------------------------
*/

app.whenReady().then(() => {

    createWindow();


    /*
    |--------------------------------------------------------------------------
    | macOS
    |--------------------------------------------------------------------------
    */

    app.on(
        "activate",
        () => {

            if (
                BrowserWindow
                    .getAllWindows()
                    .length === 0
            ) {

                createWindow();

            }

        }
    );

});


/*
|--------------------------------------------------------------------------
| Close Application
|--------------------------------------------------------------------------
*/

app.on(
    "window-all-closed",
    () => {

        /*
        |--------------------------------------------------------------------------
        | Kill all terminal processes
        |--------------------------------------------------------------------------
        */

        terminalManager.killAll();

        watcherManager.stopWatching();


        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);