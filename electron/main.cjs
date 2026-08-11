const {
    app,
    BrowserWindow
} = require("electron");

const path = require("path");


/*
|--------------------------------------------------------------------------
| Load IPC handlers
|--------------------------------------------------------------------------
*/

require("./ipc/fileSystem.cjs");


/*
|--------------------------------------------------------------------------
| Create Electron Window
|--------------------------------------------------------------------------
*/

function createWindow() {

    const mainWindow =
        new BrowserWindow({

            width: 1400,

            height: 900,

            minWidth: 900,

            minHeight: 600,

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
    | Load Vite
    |--------------------------------------------------------------------------
    */

    mainWindow.loadURL(
        "http://localhost:5173"
    );


    /*
    |--------------------------------------------------------------------------
    | Development
    |--------------------------------------------------------------------------
    */

    mainWindow.webContents.openDevTools();

}


/*
|--------------------------------------------------------------------------
| Application Ready
|--------------------------------------------------------------------------
*/

app.whenReady().then(() => {

    createWindow();


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

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);