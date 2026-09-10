const chokidar = require("chokidar");
const { ipcMain } = require("electron");
const path = require("path");


/*
|--------------------------------------------------------------------------
| Watcher Manager State
|--------------------------------------------------------------------------
*/

let activeWatcher = null;
let currentWindow = null;
let currentWorkspace = null;


/*
|--------------------------------------------------------------------------
| Initialize Window Reference
|--------------------------------------------------------------------------
*/

function initialize(window) {

    currentWindow = window;

}


/*
|--------------------------------------------------------------------------
| Dispatch Watcher Event to Renderer
|--------------------------------------------------------------------------
*/

function sendEvent(type, targetPath) {

    if (!currentWindow || currentWindow.isDestroyed()) {

        return;

    }


    const parentDir = path.dirname(targetPath);


    currentWindow.webContents.send("watcher:event", {
        type,
        path: targetPath,
        parentDir
    });

}


/*
|--------------------------------------------------------------------------
| Start Watching
|--------------------------------------------------------------------------
*/

async function startWatching(workspacePath) {

    if (!workspacePath) {

        return false;

    }


    /* If already watching same path, keep active */

    if (
        activeWatcher &&
        currentWorkspace &&
        path.resolve(currentWorkspace).toLowerCase() ===
        path.resolve(workspacePath).toLowerCase()
    ) {

        return true;

    }


    await stopWatching();


    currentWorkspace = workspacePath;


    console.log(
        "[WATCHER] Starting Chokidar for:",
        workspacePath
    );


    try {

        activeWatcher = chokidar.watch(workspacePath, {

            /*
            |--------------------------------------------------------------------------
            | Ignored Directories (High performance, near-zero CPU)
            |--------------------------------------------------------------------------
            */

            ignored: [
                /(^|[\/\\])\.git([\/\\]|$)/,
                /(^|[\/\\])node_modules([\/\\]|$)/,
                /(^|[\/\\])dist([\/\\]|$)/,
                /(^|[\/\\])\.svelte-kit([\/\\]|$)/
            ],

            ignoreInitial: true,

            persistent: true,

            depth: 99,

            /*
            |--------------------------------------------------------------------------
            | Await Write Finish
            |--------------------------------------------------------------------------
            |
            | Avoids picking up partial / incomplete writes from editors or downloads.
            |
            */

            awaitWriteFinish: {
                stabilityThreshold: 150,
                pollInterval: 50
            }

        });


        activeWatcher
            .on("add", (filePath) => {
                sendEvent("add", filePath);
            })
            .on("addDir", (dirPath) => {
                sendEvent("addDir", dirPath);
            })
            .on("change", (filePath) => {
                sendEvent("change", filePath);
            })
            .on("unlink", (filePath) => {
                sendEvent("unlink", filePath);
            })
            .on("unlinkDir", (dirPath) => {
                sendEvent("unlinkDir", dirPath);
            })
            .on("error", (error) => {
                console.error("[WATCHER ERROR]", error);
            });


        return true;

    } catch (err) {

        console.error(
            "[WATCHER] Failed to initialize watcher:",
            err
        );

        return false;

    }

}


/*
|--------------------------------------------------------------------------
| Stop Watching
|--------------------------------------------------------------------------
*/

async function stopWatching() {

    if (activeWatcher) {

        console.log(
            "[WATCHER] Stopping watcher for:",
            currentWorkspace
        );

        try {

            await activeWatcher.close();

        } catch (err) {

            console.error(
                "[WATCHER] Error closing watcher:",
                err
            );

        }

        activeWatcher = null;

        currentWorkspace = null;

    }

    return true;

}


/*
|--------------------------------------------------------------------------
| IPC Handlers
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "watcher:start",
    async (event, workspacePath) => {

        return await startWatching(workspacePath);

    }
);


ipcMain.handle(
    "watcher:stop",
    async () => {

        return await stopWatching();

    }
);


module.exports = {
    initialize,
    startWatching,
    stopWatching
};
