const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "craftale",
    {

        /*
        |--------------------------------------------------------------------------
        | APPLICATION
        |--------------------------------------------------------------------------
        */

        app: {

            name:
                "Craftale",

            version:
                "0.1.0"

        },


        /*
        |--------------------------------------------------------------------------
        | FILESYSTEM
        |--------------------------------------------------------------------------
        */

        filesystem: {

            /*
            |--------------------------------------------------------------------------
            | Select Folder
            |--------------------------------------------------------------------------
            */

            selectFolder: () => {

                return ipcRenderer.invoke(
                    "filesystem:select-folder"
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Read Directory
            |--------------------------------------------------------------------------
            */

            readDirectory: (
                directoryPath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:read-directory",
                    directoryPath
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Read File
            |--------------------------------------------------------------------------
            */

            readFile: (
                filePath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:read-file",
                    filePath
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Write File
            |--------------------------------------------------------------------------
            */

            writeFile: (
                filePath,
                content
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:write-file",
                    filePath,
                    content
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Create File
            |--------------------------------------------------------------------------
            */

            createFile: (
                parentPath,
                fileName
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:create-file",
                    parentPath,
                    fileName
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Create Folder
            |--------------------------------------------------------------------------
            */

            createFolder: (
                parentPath,
                folderName
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:create-folder",
                    parentPath,
                    folderName
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Rename
            |--------------------------------------------------------------------------
            */

            rename: (
                oldPath,
                newName
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:rename",
                    oldPath,
                    newName
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Delete
            |--------------------------------------------------------------------------
            */

            delete: (
                targetPath,
                isDirectory
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:delete",
                    targetPath,
                    isDirectory
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Exists
            |--------------------------------------------------------------------------
            */

            exists: (
                targetPath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:exists",
                    targetPath
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Copy
            |--------------------------------------------------------------------------
            */

            copy: (
                srcPath,
                destDir,
                options
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:copy",
                    srcPath,
                    destDir,
                    options
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Move
            |--------------------------------------------------------------------------
            */

            move: (
                srcPath,
                destDir,
                options
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:move",
                    srcPath,
                    destDir,
                    options
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Duplicate
            |--------------------------------------------------------------------------
            */

            duplicate: (
                srcPath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:duplicate",
                    srcPath
                );

            }

        },


        /*
        |--------------------------------------------------------------------------
        | TERMINAL
        |--------------------------------------------------------------------------
        */

        terminal: {

            /*
            |--------------------------------------------------------------------------
            | Create Terminal
            |--------------------------------------------------------------------------
            */

            create: (
                cwd,
                cols,
                rows
            ) => {

                return ipcRenderer.invoke(
                    "terminal:create",
                    cwd,
                    cols,
                    rows
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Write to Terminal
            |--------------------------------------------------------------------------
            */

            write: (
                terminalId,
                data
            ) => {

                return ipcRenderer.invoke(
                    "terminal:write",
                    terminalId,
                    data
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Resize Terminal
            |--------------------------------------------------------------------------
            */

            resize: (
                terminalId,
                cols,
                rows
            ) => {

                return ipcRenderer.invoke(
                    "terminal:resize",
                    terminalId,
                    cols,
                    rows
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Kill Terminal
            |--------------------------------------------------------------------------
            */

            kill: (
                terminalId
            ) => {

                return ipcRenderer.invoke(
                    "terminal:kill",
                    terminalId
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Terminal Data Listener
            |--------------------------------------------------------------------------
            |
            | Receives PTY output from the main process.
            |
            | Returns an unsubscribe function.
            |
            */

            onData: (
                callback
            ) => {

                const handler = (
                    _event,
                    terminalId,
                    data
                ) => {

                    callback(
                        terminalId,
                        data
                    );

                };


                ipcRenderer.on(
                    "terminal:data",
                    handler
                );


                return () => {

                    ipcRenderer.removeListener(
                        "terminal:data",
                        handler
                    );

                };

            },


            /*
            |--------------------------------------------------------------------------
            | Terminal Exit Listener
            |--------------------------------------------------------------------------
            |
            | Receives PTY exit events from the main process.
            |
            | Returns an unsubscribe function.
            |
            */

            onExit: (
                callback
            ) => {

                const handler = (
                    _event,
                    terminalId,
                    exitCode
                ) => {

                    callback(
                        terminalId,
                        exitCode
                    );

                };


                ipcRenderer.on(
                    "terminal:exit",
                    handler
                );


                return () => {

                    ipcRenderer.removeListener(
                        "terminal:exit",
                        handler
                    );

                };

            }

        },


        /*
        |--------------------------------------------------------------------------
        | WATCHER
        |--------------------------------------------------------------------------
        */

        watcher: {

            start: (
                workspacePath
            ) => {

                return ipcRenderer.invoke(
                    "watcher:start",
                    workspacePath
                );

            },


            stop: () => {

                return ipcRenderer.invoke(
                    "watcher:stop"
                );

            },


            onEvent: (
                callback
            ) => {

                const handler = (
                    _event,
                    data
                ) => {

                    callback(data);

                };


                ipcRenderer.on(
                    "watcher:event",
                    handler
                );


                return () => {

                    ipcRenderer.removeListener(
                        "watcher:event",
                        handler
                    );

                };

            }

        }

    }
);