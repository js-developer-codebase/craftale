const {
    contextBridge,
    ipcRenderer
} = require("electron");


contextBridge.exposeInMainWorld(
    "craftale",
    {

        /*
        |--------------------------------------------------------------------------
        | Application
        |--------------------------------------------------------------------------
        */

        app: {

            name: "Craftale",

            version: "0.1.0"

        },


        /*
        |--------------------------------------------------------------------------
        | Filesystem
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

            }

        }

    }
);