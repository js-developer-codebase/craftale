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

                execute(
                    command: string,

                    cwd?: string
                ): Promise<{

                    stdout: string;

                    stderr: string;

                    exitCode: number;

                }>;

            };

        };

    };

}