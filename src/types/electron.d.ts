export { };

declare global {
    interface Window {
        craftale: {
            app: {
                name: string;
                version: string;
            };

            filesystem: {
                selectFolder(): Promise<string | null>;

                readDirectory(
                    directoryPath: string
                ): Promise<{
                    name: string;
                    path: string;
                    type: "file" | "directory";
                }[]>;

                readFile(
                    filePath: string
                ): Promise<string>;

                writeFile(
                    filePath: string,
                    content: string
                ): Promise<boolean>;
            };
        };
    }
}