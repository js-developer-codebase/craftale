import { writable, get } from "svelte/store";
import { recordSelfTouch } from "./watcher";


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

    recordSelfTouch(path);

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


/*
|--------------------------------------------------------------------------
| Tree Refresh Trigger
|--------------------------------------------------------------------------
*/

export const treeRefreshTrigger =
    writable<number>(0);


export function triggerTreeRefresh() {

    treeRefreshTrigger.update(
        (n) => n + 1
    );

}


/*
|--------------------------------------------------------------------------
| Clipboard
|--------------------------------------------------------------------------
*/

export type ClipboardItem = {

    path: string;

    name: string;

    type: "file" | "directory";

    operation: "copy" | "cut";

};


export const clipboard =
    writable<ClipboardItem | null>(null);


export function copyToClipboard(
    path: string,
    name: string,
    type: "file" | "directory"
) {

    clipboard.set({
        path,
        name,
        type,
        operation: "copy"
    });

}


export function cutToClipboard(
    path: string,
    name: string,
    type: "file" | "directory"
) {

    clipboard.set({
        path,
        name,
        type,
        operation: "cut"
    });

}


export function clearClipboard() {

    clipboard.set(null);

}


/*
|--------------------------------------------------------------------------
| Rename File / Folder in Store
|--------------------------------------------------------------------------
*/

export function renameFileInStore(
    oldPath: string,
    newPath: string,
    newName: string
) {

    const normOld =
        oldPath.replace(/\\/g, "/").toLowerCase();

    openedFiles.update((files) => {

        return files.map((file) => {

            const normFile =
                file.path.replace(/\\/g, "/").toLowerCase();


            if (normFile === normOld) {

                return {
                    ...file,
                    path: newPath,
                    name: newName
                };

            }


            /*
            |--------------------------------------------------------------------------
            | Handle Children of Renamed Folder
            |--------------------------------------------------------------------------
            */

            if (
                normFile.startsWith(normOld + "/")
            ) {

                const subPath =
                    file.path.slice(oldPath.length);

                const updatedPath =
                    newPath + subPath;

                return {
                    ...file,
                    path: updatedPath
                };

            }


            return file;

        });

    });


    activeFile.update((curr) => {

        if (!curr) {
            return null;
        }


        const normCurr =
            curr.path.replace(/\\/g, "/").toLowerCase();


        if (normCurr === normOld) {

            return {
                ...curr,
                path: newPath,
                name: newName
            };

        }


        if (
            normCurr.startsWith(normOld + "/")
        ) {

            const subPath =
                curr.path.slice(oldPath.length);

            return {
                ...curr,
                path: newPath + subPath
            };

        }


        return curr;

    });


    activePath.update((currPath) => {

        if (!currPath) {
            return null;
        }


        const normCurr =
            currPath.replace(/\\/g, "/").toLowerCase();


        if (normCurr === normOld) {

            return newPath;

        }


        if (
            normCurr.startsWith(normOld + "/")
        ) {

            const subPath =
                currPath.slice(oldPath.length);

            return newPath + subPath;

        }


        return currPath;

    });

}


/*
|--------------------------------------------------------------------------
| Delete File / Folder in Store
|--------------------------------------------------------------------------
*/

export function deleteFileInStore(
    deletedPath: string
) {

    const normDeleted =
        deletedPath.replace(/\\/g, "/").toLowerCase();


    openedFiles.update((files) => {

        return files.filter((file) => {

            const normFile =
                file.path.replace(/\\/g, "/").toLowerCase();


            const isMatch =
                normFile === normDeleted ||
                normFile.startsWith(normDeleted + "/");


            return !isMatch;

        });

    });


    activeFile.update((curr) => {

        if (!curr) {
            return null;
        }


        const normCurr =
            curr.path.replace(/\\/g, "/").toLowerCase();


        if (
            normCurr === normDeleted ||
            normCurr.startsWith(normDeleted + "/")
        ) {

            const remaining =
                get(openedFiles);

            return remaining.length > 0
                ? remaining[remaining.length - 1]
                : null;

        }


        return curr;

    });


    activePath.update((currPath) => {

        if (!currPath) {
            return null;
        }


        const normCurr =
            currPath.replace(/\\/g, "/").toLowerCase();


        if (
            normCurr === normDeleted ||
            normCurr.startsWith(normDeleted + "/")
        ) {

            const remaining =
                get(openedFiles);

            return remaining.length > 0
                ? remaining[remaining.length - 1].path
                : null;

        }


        return currPath;

    });

}