export { };


declare global {

    interface Window {

        craftale: {

            /*
            |--------------------------------------------------------------------------
            | APPLICATION
            |--------------------------------------------------------------------------
            */

            app: {

                name: string;

                version: string;

            };


            /*
            |--------------------------------------------------------------------------
            | FILESYSTEM
            |--------------------------------------------------------------------------
            */

            filesystem: {

                selectFolder():
                    Promise<string | null>;


                readDirectory(
                    directoryPath: string
                ): Promise<{

                    name: string;

                    path: string;

                    type:
                    | "file"
                    | "directory";

                }[]>;


                readFile(
                    filePath: string
                ): Promise<string>;


                writeFile(
                    filePath: string,
                    content: string
                ): Promise<boolean>;


                createFile(
                    parentPath: string,
                    fileName: string
                ): Promise<{
                    name: string;
                    path: string;
                    type: "file";
                }>;


                createFolder(
                    parentPath: string,
                    folderName: string
                ): Promise<{
                    name: string;
                    path: string;
                    type: "directory";
                }>;


                rename(
                    oldPath: string,
                    newName: string
                ): Promise<{
                    oldPath: string;
                    newPath: string;
                    newName: string;
                }>;


                delete(
                    targetPath: string,
                    isDirectory: boolean
                ): Promise<{
                    success: boolean;
                    deletedPath: string;
                }>;


                exists(
                    targetPath: string
                ): Promise<boolean>;


                copy(
                    srcPath: string,
                    destDir: string,
                    options?: {
                        overwrite?: boolean;
                        keepBoth?: boolean;
                    }
                ): Promise<{
                    success?: boolean;
                    conflict?: boolean;
                    existingName?: string;
                    destPath?: string;
                    targetPath?: string;
                    name?: string;
                }>;


                move(
                    srcPath: string,
                    destDir: string,
                    options?: {
                        overwrite?: boolean;
                        keepBoth?: boolean;
                    }
                ): Promise<{
                    success?: boolean;
                    conflict?: boolean;
                    existingName?: string;
                    destPath?: string;
                    targetPath?: string;
                    name?: string;
                }>;


                duplicate(
                    srcPath: string
                ): Promise<{
                    success: boolean;
                    targetPath: string;
                    name: string;
                }>;


                listFiles(
                    directoryPath: string
                ): Promise<{
                    name: string;
                    path: string;
                    relativePath: string;
                    extension: string;
                }[]>;

            };


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
                |
                | Spawns a persistent PTY shell process.
                |
                */

                create(
                    cwd?: string,
                    cols?: number,
                    rows?: number
                ): Promise<{
                    terminalId: number;
                    shell: string;
                    pid: number;
                }>;


                /*
                |--------------------------------------------------------------------------
                | Write to Terminal
                |--------------------------------------------------------------------------
                |
                | Sends user input (keystrokes) to the PTY.
                |
                */

                write(
                    terminalId: number,
                    data: string
                ): Promise<boolean>;


                /*
                |--------------------------------------------------------------------------
                | Resize Terminal
                |--------------------------------------------------------------------------
                |
                | Resizes the PTY to match xterm dimensions.
                |
                */

                resize(
                    terminalId: number,
                    cols: number,
                    rows: number
                ): Promise<boolean>;


                /*
                |--------------------------------------------------------------------------
                | Kill Terminal
                |--------------------------------------------------------------------------
                |
                | Kills the PTY process.
                |
                */

                kill(
                    terminalId: number
                ): Promise<boolean>;


                /*
                |--------------------------------------------------------------------------
                | Terminal Data Listener
                |--------------------------------------------------------------------------
                |
                | Receives PTY output.
                | Returns an unsubscribe function.
                |
                */

                onData(
                    callback: (
                        terminalId: number,
                        data: string
                    ) => void
                ): () => void;


                /*
                |--------------------------------------------------------------------------
                | Terminal Exit Listener
                |--------------------------------------------------------------------------
                |
                | Receives PTY exit events.
                | Returns an unsubscribe function.
                |
                */

                onExit(
                    callback: (
                        terminalId: number,
                        exitCode: number
                    ) => void
                ): () => void;

            };


            /*
            |--------------------------------------------------------------------------
            | WATCHER
            |--------------------------------------------------------------------------
            */

            watcher: {

                start(
                    workspacePath: string
                ): Promise<boolean>;


                stop(): Promise<boolean>;


                onEvent(
                    callback: (event: {
                        type: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
                        path: string;
                        parentDir: string;
                    }) => void
                ): () => void;

            };

        };

    };

}