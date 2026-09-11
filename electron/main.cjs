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

const lspManager =
    require("./ipc/lsp.cjs");

require("./ipc/fileSystem.cjs");
require("./ipc/search.cjs");
require("./ipc/git.cjs");
require("./ipc/compiler.cjs");


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

    lspManager.initialize(
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
    | DevTools & Error Logging
    |--------------------------------------------------------------------------
    */

    window.webContents.on("console-message", (_event, level, message, line, sourceId) => {
        const levels = ["DEBUG", "INFO", "WARN", "ERROR"];
        const lvl = levels[level] || "LOG";
        console.log(`[RENDERER ${lvl}] ${message} (${sourceId}:${line})`);
    });

    window.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
        console.error(`[MAIN] Failed to load URL: ${validatedURL} (${errorCode}: ${errorDescription})`);
        const distIndex = path.join(__dirname, "..", "dist", "index.html");
        if (isDev && fs.existsSync(distIndex) && validatedURL.includes("5173")) {
            console.log("[MAIN] Vite dev server unreachable. Falling back to dist/index.html...");
            window.loadFile(distIndex);
        }
    });

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

        lspManager.stopAllServers();


        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);