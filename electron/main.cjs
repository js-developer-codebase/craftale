const {
    app,
    BrowserWindow,
    ipcMain,
    dialog
} = require("electron");

const path = require("path");
const fs = require("fs");
const { exec } = require("child_process");


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
    | Development
    |--------------------------------------------------------------------------
    */

    window.loadURL(
        "http://localhost:5173"
    );


    /*
    |--------------------------------------------------------------------------
    | DevTools
    |--------------------------------------------------------------------------
    */

    // window.webContents.openDevTools();

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

        if (
            process.platform !== "darwin"
        ) {

            app.quit();

        }

    }
);


/*
|--------------------------------------------------------------------------
| FILESYSTEM
|--------------------------------------------------------------------------
*/


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


        if (
            result.canceled
        ) {

            return null;

        }


        return result
            .filePaths[0] || null;

    }
);


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

            const entries =
                await fs.promises.readdir(
                    directoryPath,
                    {
                        withFileTypes: true
                    }
                );


            const result =
                entries.map(
                    (entry) => ({

                        name:
                            entry.name,

                        path:
                            path.join(
                                directoryPath,
                                entry.name
                            ),

                        type:
                            entry.isDirectory()
                                ? "directory"
                                : "file"

                    })
                );


            /*
            |--------------------------------------------------------------------------
            | Directories First
            |--------------------------------------------------------------------------
            */

            result.sort(
                (
                    a,
                    b
                ) => {

                    if (
                        a.type !==
                        b.type
                    ) {

                        return a.type ===
                            "directory"
                            ? -1
                            : 1;

                    }


                    return a.name
                        .toLowerCase()
                        .localeCompare(
                            b.name
                                .toLowerCase()
                        );

                }
            );


            console.log(
                "[FS] Found",
                result.length,
                "items"
            );


            return result;

        }

        catch (error) {

            console.error(
                "[FS] Read directory failed:",
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
                await fs.promises.readFile(
                    filePath,
                    "utf-8"
                );


            return content;

        }

        catch (error) {

            console.error(
                "[FS] Read file failed:",
                error
            );


            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Write File
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:write-file",

    async (
        _event,
        filePath,
        content
    ) => {

        console.log(
            "[IPC] write-file:",
            filePath
        );


        try {

            await fs.promises.writeFile(
                filePath,
                content,
                "utf-8"
            );


            console.log(
                "[FS] File written:",
                filePath
            );


            return true;

        }

        catch (error) {

            console.error(
                "[FS] Write file failed:",
                error
            );


            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| TERMINAL
|--------------------------------------------------------------------------
*/


/*
|--------------------------------------------------------------------------
| Execute Terminal Command
|--------------------------------------------------------------------------
|
| This is the first/basic version.
|
| It executes the command using PowerShell.
|
*/

ipcMain.handle(
    "terminal:execute",

    async (
        _event,
        command,
        cwd
    ) => {

        console.log(
            "[TERMINAL] Command:",
            command
        );


        console.log(
            "[TERMINAL] CWD:",
            cwd
        );


        /*
        |--------------------------------------------------------------------------
        | Validate Command
        |--------------------------------------------------------------------------
        */

        if (
            typeof command !==
            "string"
        ) {

            throw new Error(
                "Invalid terminal command."
            );

        }


        /*
        |--------------------------------------------------------------------------
        | Working Directory
        |--------------------------------------------------------------------------
        */

        let workingDirectory =
            cwd;


        if (
            !workingDirectory ||
            !fs.existsSync(
                workingDirectory
            )
        ) {

            workingDirectory =
                process.cwd();

        }


        /*
        |--------------------------------------------------------------------------
        | Execute
        |--------------------------------------------------------------------------
        */

        return new Promise(
            (resolve) => {

                exec(
                    command,

                    {

                        cwd:
                            workingDirectory,

                        shell:
                            "powershell.exe",

                        windowsHide:
                            true,

                        maxBuffer:
                            10 * 1024 * 1024

                    },

                    (
                        error,
                        stdout,
                        stderr
                    ) => {

                        const exitCode =
                            error
                                ? (
                                    typeof error.code ===
                                        "number"
                                        ? error.code
                                        : 1
                                )
                                : 0;


                        resolve({

                            stdout:
                                stdout || "",

                            stderr:
                                stderr || "",

                            exitCode

                        });

                    }

                );

            }
        );

    }
);