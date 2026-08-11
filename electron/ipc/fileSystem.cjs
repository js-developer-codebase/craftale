const {
    ipcMain,
    dialog
} = require("electron");

const fs = require("fs/promises");

const path = require("path");


/*
|--------------------------------------------------------------------------
| Select Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:select-folder",
    async () => {

        console.log(
            "[IPC] select-folder"
        );


        const result =
            await dialog.showOpenDialog({

                properties: [
                    "openDirectory"
                ]

            });


        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {

            console.log(
                "[IPC] Folder selection cancelled"
            );

            return null;

        }


        const selectedPath =
            result.filePaths[0];


        console.log(
            "[IPC] Selected folder:",
            selectedPath
        );


        return selectedPath;

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
        event,
        directoryPath
    ) => {

        console.log(
            "[IPC] read-directory:",
            directoryPath
        );


        try {

            console.log(
                "[FS] Reading:",
                directoryPath
            );


            const entries =
                await fs.readdir(
                    directoryPath,
                    {
                        withFileTypes: true
                    }
                );


            const items =
                entries.map(
                    (entry) => {

                        return {

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

                        };

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Sort
            |--------------------------------------------------------------------------
            |
            | Directories first, files second.
            |
            */

            items.sort(
                (a, b) => {

                    if (
                        a.type !== b.type
                    ) {

                        return (
                            a.type === "directory"
                                ? -1
                                : 1
                        );

                    }


                    return a.name.localeCompare(
                        b.name
                    );

                }
            );


            console.log(
                "[FS] Found",
                items.length,
                "items"
            );


            return items;

        } catch (error) {

            console.error(
                "[FS] Failed to read directory:",
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
        event,
        filePath
    ) => {

        console.log(
            "[IPC] read-file:",
            filePath
        );


        try {

            const content =
                await fs.readFile(
                    filePath,
                    "utf-8"
                );


            console.log(
                "[FS] File read:",
                filePath
            );


            return content;

        } catch (error) {

            console.error(
                "[FS] Failed to read file:",
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
        event,
        filePath,
        content
    ) => {

        console.log(
            "[IPC] write-file:",
            filePath
        );


        try {

            await fs.writeFile(
                filePath,
                content,
                "utf-8"
            );


            console.log(
                "[FS] File saved:",
                filePath
            );


            return true;

        } catch (error) {

            console.error(
                "[FS] Failed to save file:",
                error
            );


            throw error;

        }

    }
);