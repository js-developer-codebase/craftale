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

            },


            /*
            |--------------------------------------------------------------------------
            | List Files (Recursive for Quick Open / Go To File)
            |--------------------------------------------------------------------------
            */

            listFiles: (
                directoryPath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:list-files",
                    directoryPath
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Exists
            |--------------------------------------------------------------------------
            */

            exists: (
                filePath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:exists",
                    filePath
                );

            },


            /*
            |--------------------------------------------------------------------------
            | Resolve File (Fallback with Extensions)
            |--------------------------------------------------------------------------
            */

            resolveFile: (
                filePath
            ) => {

                return ipcRenderer.invoke(
                    "filesystem:resolve-file",
                    filePath
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

        },


        /*
        |--------------------------------------------------------------------------
        | SEARCH & REPLACE
        |--------------------------------------------------------------------------
        */

        search: {

            searchWorkspace: (workspacePath, options) => {

                return ipcRenderer.invoke(
                    "search:workspace",
                    workspacePath,
                    options
                );

            },

            replaceInFile: (filePath, options) => {

                return ipcRenderer.invoke(
                    "search:replace-in-file",
                    filePath,
                    options
                );

            },

            replaceWorkspace: (workspacePath, options) => {

                return ipcRenderer.invoke(
                    "search:replace-workspace",
                    workspacePath,
                    options
                );

            }

        },


        /*
        |--------------------------------------------------------------------------
        | GIT SOURCE CONTROL
        |--------------------------------------------------------------------------
        */

        git: {

            isRepo: (workspacePath) => {
                return ipcRenderer.invoke("git:is-repo", workspacePath);
            },

            init: (workspacePath) => {
                return ipcRenderer.invoke("git:init", workspacePath);
            },

            getStatus: (workspacePath) => {
                return ipcRenderer.invoke("git:get-status", workspacePath);
            },

            stage: (workspacePath, filePaths) => {
                return ipcRenderer.invoke("git:stage", workspacePath, filePaths);
            },

            unstage: (workspacePath, filePaths) => {
                return ipcRenderer.invoke("git:unstage", workspacePath, filePaths);
            },

            discard: (workspacePath, filePaths, isUntracked = false) => {
                return ipcRenderer.invoke("git:discard", workspacePath, filePaths, isUntracked);
            },

            commit: (workspacePath, message) => {
                return ipcRenderer.invoke("git:commit", workspacePath, message);
            },

            pull: (workspacePath) => {
                return ipcRenderer.invoke("git:pull", workspacePath);
            },

            push: (workspacePath) => {
                return ipcRenderer.invoke("git:push", workspacePath);
            },

            fetch: (workspacePath) => {
                return ipcRenderer.invoke("git:fetch", workspacePath);
            },

            getBranches: (workspacePath) => {
                return ipcRenderer.invoke("git:get-branches", workspacePath);
            },

            checkout: (workspacePath, branchName, createNew = false) => {
                return ipcRenderer.invoke("git:checkout", workspacePath, branchName, createNew);
            }

        },


        /*
        |--------------------------------------------------------------------------
        | LSP (Language Server Protocol)
        |--------------------------------------------------------------------------
        */

        lsp: {

            startServer: (languageId, workspacePath) => {
                return ipcRenderer.invoke("lsp:start-server", { languageId, workspacePath });
            },

            stopServer: (serverId) => {
                return ipcRenderer.invoke("lsp:stop-server", { serverId });
            },

            stopAll: () => {
                return ipcRenderer.invoke("lsp:stop-all");
            },

            sendMessage: (serverId, message) => {
                return ipcRenderer.invoke("lsp:send-message", { serverId, message });
            },

            getServersStatus: () => {
                return ipcRenderer.invoke("lsp:get-servers-status");
            },

            onMessage: (callback) => {
                const handler = (_event, data) => callback(data);
                ipcRenderer.on("lsp:message", handler);
                return () => ipcRenderer.removeListener("lsp:message", handler);
            },

            onStatusChange: (callback) => {
                const handler = (_event, data) => callback(data);
                ipcRenderer.on("lsp:status", handler);
                return () => ipcRenderer.removeListener("lsp:status", handler);
            }

        }

    }
);