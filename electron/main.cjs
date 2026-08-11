const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");

const path = require("path");


const {
    readDirectory,
    readFile
} = require("./ipc/fileSystem.cjs");


/*
|--------------------------------------------------------------------------
| Create Window
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

                nodeIntegration: false,

                contextIsolation: true,

                sandbox: true

            }

        });


    mainWindow.loadURL(
        "http://localhost:5173"
    );

}


/*
|--------------------------------------------------------------------------
| Read Directory
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:read-directory",

    async (
        _event,
        directoryPath
    ) => {

        console.log(
            "[IPC] read-directory:",
            directoryPath
        );


        try {

            const result =
                await readDirectory(
                    directoryPath
                );


            console.log(
                "[IPC] Returning:",
                result.length,
                "items"
            );


            return result;

        } catch (error) {

            console.error(
                "[IPC] read-directory failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Read File
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:read-file",

    async (
        _event,
        filePath
    ) => {

        console.log(
            "[IPC] read-file:",
            filePath
        );


        try {

            const content =
                await readFile(
                    filePath
                );


            console.log(
                "[IPC] File content returned"
            );


            return content;

        } catch (error) {

            console.error(
                "[IPC] read-file failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Select Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:select-folder",

    async () => {

        const result =
            await dialog.showOpenDialog({

                properties: [
                    "openDirectory"
                ]

            });


        if (result.canceled) {

            return null;

        }


        return result.filePaths[0];

    }
);


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
| Application Close
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