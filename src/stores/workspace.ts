import { writable, get } from "svelte/store";


/*
|--------------------------------------------------------------------------
| Open File
|--------------------------------------------------------------------------
*/

export type OpenFile = {

    name: string;

    path: string;

    content: string;

    isDirty?: boolean;

};


/*
|--------------------------------------------------------------------------
| Normalize & Compare Paths (Cross-Platform / Windows Safe)
|--------------------------------------------------------------------------
*/

export function pathsEqual(
    a: string | null | undefined,
    b: string | null | undefined
): boolean {

    if (!a || !b) {

        return false;

    }


    return (
        a.replace(/\\/g, "/").toLowerCase() ===
        b.replace(/\\/g, "/").toLowerCase()
    );

}


/*
|--------------------------------------------------------------------------
| Active File
|--------------------------------------------------------------------------
*/

export const activeFile =
    writable<OpenFile | null>(null);


/*
|--------------------------------------------------------------------------
| Opened Files
|--------------------------------------------------------------------------
*/

export const openedFiles =
    writable<OpenFile[]>([]);


/*
|--------------------------------------------------------------------------
| Active Path
|--------------------------------------------------------------------------
*/

export const activePath =
    writable<string | null>(null);


/*
|--------------------------------------------------------------------------
| Workspace Path
|--------------------------------------------------------------------------
*/

export const workspacePath =
    writable<string | null>(null);


/*
|--------------------------------------------------------------------------
| Terminal Visibility
|--------------------------------------------------------------------------
*/

export const isTerminalVisible =
    writable<boolean>(true);


export function toggleTerminal(
    visible?: boolean
) {

    isTerminalVisible.update(
        (current) =>
            visible !== undefined
                ? visible
                : !current
    );

}


/*
|--------------------------------------------------------------------------
| Set Workspace
|--------------------------------------------------------------------------
*/

export function setWorkspace(
    path: string
) {

    console.log(
        "[WORKSPACE] Setting workspace:",
        path
    );


    workspacePath.set(path);

}


/*
|--------------------------------------------------------------------------
| Open File
|--------------------------------------------------------------------------
*/

export function openFile(
    file: OpenFile
) {

    console.log(
        "[STORE] Opening file:",
        file.path
    );


    openedFiles.update(
        files => {

            const exists =
                files.some(
                    item =>
                        pathsEqual(
                            item.path,
                            file.path
                        )
                );


            if (exists) {

                return files;

            }


            return [
                ...files,
                {
                    ...file,
                    isDirty:
                        file.isDirty ?? false
                }
            ];

        }
    );


    activeFile.set(file);

    activePath.set(file.path);

}


/*
|--------------------------------------------------------------------------
| Activate File
|--------------------------------------------------------------------------
*/

export function activateFile(
    path: string
) {

    openedFiles.update(
        files => {

            const file =
                files.find(
                    item =>
                        pathsEqual(
                            item.path,
                            path
                        )
                );


            if (file) {

                activeFile.set(file);

                activePath.set(file.path);

            }


            return files;

        }
    );

}


/*
|--------------------------------------------------------------------------
| Update File Content
|--------------------------------------------------------------------------
*/

export function updateFileContent(
    path: string,
    content: string
) {

    console.log(
        "[STORE] Updating file:",
        path
    );


    openedFiles.update(
        files => {

            return files.map(
                file => {

                    if (
                        !pathsEqual(file.path, path)
                    ) {

                        return file;

                    }


                    return {

                        ...file,

                        content,

                        isDirty: true

                    };

                }
            );

        }
    );


    activeFile.update(
        file => {

            if (
                !file ||
                !pathsEqual(file.path, path)
            ) {

                return file;

            }


            return {

                ...file,

                content,

                isDirty: true

            };

        }
    );

}


/*
|--------------------------------------------------------------------------
| Mark File Saved
|--------------------------------------------------------------------------
*/

export function markFileSaved(
    path: string,
    content: string
) {

    openedFiles.update(
        files => {

            return files.map(
                file => {

                    if (
                        !pathsEqual(file.path, path)
                    ) {

                        return file;

                    }


                    return {

                        ...file,

                        content,

                        isDirty: false

                    };

                }
            );

        }
    );


    activeFile.update(
        file => {

            if (
                !file ||
                !pathsEqual(file.path, path)
            ) {

                return file;

            }


            return {

                ...file,

                content,

                isDirty: false

            };

        }
    );

}


/*
|--------------------------------------------------------------------------
| Save File
|--------------------------------------------------------------------------
*/

export async function saveFile(
    path: string
): Promise<boolean> {

    const files =
        get(openedFiles);


    const file =
        files.find(
            item =>
                pathsEqual(item.path, path)
        );


    if (!file) {

        console.error(
            "[STORE] File not found:",
            path
        );

        return false;

    }


    try {

        await (window as any)
            .craftale
            .filesystem
            .writeFile(
                file.path,
                file.content
            );


        markFileSaved(
            file.path,
            file.content
        );


        console.log(
            "[STORE] File saved:",
            file.path
        );


        return true;

    }

    catch (error) {

        console.error(
            "[STORE] Save failed:",
            error
        );

        return false;

    }

}


/*
|--------------------------------------------------------------------------
| Close File
|--------------------------------------------------------------------------
*/

export function closeFile(
    path: string
) {

    openedFiles.update(
        files => {

            const index =
                files.findIndex(
                    file =>
                        pathsEqual(file.path, path)
                );


            if (index === -1) {

                return files;

            }


            const newFiles =
                files.filter(
                    file =>
                        !pathsEqual(file.path, path)
                );


            /*
            |--------------------------------------------------------------------------
            | Closed Active File
            |--------------------------------------------------------------------------
            */

            activePath.update(
                currentPath => {

                    if (
                        !pathsEqual(currentPath, path)
                    ) {

                        return currentPath;

                    }


                    const nextFile =
                        newFiles[
                        Math.max(
                            0,
                            index - 1
                        )
                        ];


                    if (nextFile) {

                        activeFile.set(
                            nextFile
                        );

                        return nextFile.path;

                    }


                    activeFile.set(null);

                    return null;

                }
            );


            return newFiles;

        }
    );

}