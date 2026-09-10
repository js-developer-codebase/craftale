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

        };

    };

}