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


                exists(
                    filePath: string
                ): Promise<boolean>;


                resolveFile(
                    filePath: string
                ): Promise<string>;

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


            /*
            |--------------------------------------------------------------------------
            | SEARCH & REPLACE
            |--------------------------------------------------------------------------
            */

            search: {

                searchWorkspace(
                    workspacePath: string,
                    options?: {
                        query: string;
                        isRegex?: boolean;
                        isCaseSensitive?: boolean;
                        matchWholeWord?: boolean;
                        includePattern?: string;
                        excludePattern?: string;
                        maxResults?: number;
                    }
                ): Promise<{
                    results: Array<{
                        path: string;
                        relativePath: string;
                        fileName: string;
                        matches: Array<{
                            lineNumber: number;
                            column: number;
                            length: number;
                            lineText: string;
                            preview: {
                                before: string;
                                match: string;
                                after: string;
                            };
                        }>;
                    }>;
                    totalMatches: number;
                    totalFiles: number;
                    durationMs: number;
                    truncated: boolean;
                    error?: string;
                }>;

                replaceInFile(
                    filePath: string,
                    options: {
                        query: string;
                        replacement: string;
                        isRegex?: boolean;
                        isCaseSensitive?: boolean;
                        matchWholeWord?: boolean;
                        lineNumber?: number | null;
                        column?: number | null;
                    }
                ): Promise<{
                    success: boolean;
                    filePath?: string;
                    newContent?: string;
                    error?: string;
                }>;

                replaceWorkspace(
                    workspacePath: string,
                    options: {
                        query: string;
                        replacement: string;
                        isRegex?: boolean;
                        isCaseSensitive?: boolean;
                        matchWholeWord?: boolean;
                        filePaths: string[];
                    }
                ): Promise<{
                    success: boolean;
                    totalModifiedFiles: number;
                    totalReplacements: number;
                    modifiedFiles?: Array<{ filePath: string; newContent: string }>;
                    error?: string;
                }>;

            };


            /*
            |--------------------------------------------------------------------------
            | GIT SOURCE CONTROL
            |--------------------------------------------------------------------------
            */

            git: {

                isRepo(
                    workspacePath: string
                ): Promise<boolean>;

                init(
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                getStatus(
                    workspacePath: string
                ): Promise<{
                    isRepo: boolean;
                    branch: string;
                    upstream: string;
                    ahead: number;
                    behind: number;
                    staged: Array<{
                        path: string;
                        relativePath: string;
                        fileName: string;
                        status: string;
                    }>;
                    unstaged: Array<{
                        path: string;
                        relativePath: string;
                        fileName: string;
                        status: string;
                    }>;
                    untracked: Array<{
                        path: string;
                        relativePath: string;
                        fileName: string;
                        status: string;
                    }>;
                    error?: string;
                }>;

                stage(
                    workspacePath: string,
                    filePaths: string[] | "all"
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                unstage(
                    workspacePath: string,
                    filePaths: string[] | "all"
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                discard(
                    workspacePath: string,
                    filePaths: string[],
                    isUntracked?: boolean
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                commit(
                    workspacePath: string,
                    message: string
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                pull(
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                push(
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                fetch(
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

                getBranches(
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    branches: Array<{
                        fullName: string;
                        name: string;
                        isCurrent: boolean;
                        isRemote: boolean;
                    }>;
                    error?: string;
                }>;

                checkout(
                    workspacePath: string,
                    branchName: string,
                    createNew?: boolean
                ): Promise<{
                    success: boolean;
                    stdout?: string;
                    stderr?: string;
                    error?: string;
                }>;

            };


            /*
            |--------------------------------------------------------------------------
            | LSP (Language Server Protocol)
            |--------------------------------------------------------------------------
            */

            lsp: {

                startServer(
                    languageId: string,
                    workspacePath: string
                ): Promise<{
                    success: boolean;
                    serverId?: string;
                    alreadyRunning?: boolean;
                    error?: string;
                }>;

                stopServer(
                    serverId: string
                ): Promise<{
                    success: boolean;
                    error?: string;
                }>;

                stopAll(): Promise<{
                    success: boolean;
                }>;

                sendMessage(
                    serverId: string,
                    message: any
                ): Promise<{
                    success: boolean;
                    error?: string;
                }>;

                getServersStatus(): Promise<Record<string, {
                    name: string;
                    status: "starting" | "running" | "stopped" | "error";
                    workspacePath?: string;
                    pid?: number;
                }>>;

                onMessage(
                    callback: (data: { serverId: string; message: any }) => void
                ): () => void;

                onStatusChange(
                    callback: (data: {
                        serverId: string;
                        status: "starting" | "running" | "stopped" | "error";
                        code?: number;
                        signal?: string;
                        error?: string;
                    }) => void
                ): () => void;

            };

        };

    };

}