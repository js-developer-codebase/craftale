import {
    writable,
    derived,
    get
} from "svelte/store";

/*
|--------------------------------------------------------------------------
| Open File
|--------------------------------------------------------------------------
*/

export type OpenFile = {

    name: string;

    path: string;

    content: string;

    isDirty: boolean;

};


/*
|--------------------------------------------------------------------------
| Opened Files
|--------------------------------------------------------------------------
*/

export const openedFiles =
    writable<OpenFile[]>([]);


/*
|--------------------------------------------------------------------------
| Active File
|--------------------------------------------------------------------------
*/

export const activeFile =
    writable<OpenFile | null>(null);


/*
|--------------------------------------------------------------------------
| Active Path
|--------------------------------------------------------------------------
*/

export const activePath =
    derived(
        activeFile,
        ($activeFile) => {

            return $activeFile?.path ?? null;

        }
    );


/*
|--------------------------------------------------------------------------
| Normalize Windows Path
|--------------------------------------------------------------------------
*/

function normalizePath(
    filePath: string
): string {

    return filePath
        .replace(/\\/g, "/")
        .toLowerCase();

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
        (files) => {

            const exists =
                files.some(
                    (existingFile) =>
                        normalizePath(
                            existingFile.path
                        ) ===
                        normalizePath(
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
                    isDirty: false
                }
            ];

        }
    );


    activeFile.set({

        ...file,

        isDirty: false

    });


    console.log(
        "[STORE] Active file:",
        file.path
    );

}


/*
|--------------------------------------------------------------------------
| Activate File
|--------------------------------------------------------------------------
*/

export function activateFile(
    filePath: string
) {

    const files =
        get(openedFiles);


    const file =
        files.find(
            (item) =>
                normalizePath(
                    item.path
                ) ===
                normalizePath(
                    filePath
                )
        );


    if (!file) {

        console.warn(
            "[STORE] File not found:",
            filePath
        );

        return;

    }


    activeFile.set(
        file
    );


    console.log(
        "[STORE] Activated:",
        file.path
    );

}


/*
|--------------------------------------------------------------------------
| Update File Content
|--------------------------------------------------------------------------
*/

export function updateFileContent(
    filePath: string,
    content: string
) {

    console.log(
        "[STORE] Updating file:",
        filePath
    );


    openedFiles.update(
        (files) => {

            const updatedFiles =
                files.map(
                    (file): OpenFile => {

                        if (
                            normalizePath(
                                file.path
                            ) ===
                            normalizePath(
                                filePath
                            )
                        ) {

                            return {

                                ...file,

                                content,

                                isDirty: true

                            };

                        }


                        return file;

                    }
                );


            console.log(
                "[STORE] Updated files:",
                updatedFiles
            );


            console.log(
                "[STORE] Dirty state:",
                updatedFiles.map(
                    (file) => ({

                        name:
                            file.name,

                        isDirty:
                            file.isDirty

                    })
                )
            );


            return updatedFiles;

        }
    );


    /*
    |--------------------------------------------------------------------------
    | Update Active File
    |--------------------------------------------------------------------------
    */

    activeFile.update(
        (file) => {

            if (
                !file
            ) {

                return file;

            }


            if (
                normalizePath(
                    file.path
                ) !==
                normalizePath(
                    filePath
                )
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
| Save File
|--------------------------------------------------------------------------
*/

export async function saveFile(
    filePath: string
): Promise<boolean> {

    console.log(
        "[STORE] Saving file:",
        filePath
    );


    /*
    |--------------------------------------------------------------------------
    | Find File
    |--------------------------------------------------------------------------
    */

    const files =
        get(openedFiles);


    const fileToSave =
        files.find(
            (file) =>
                normalizePath(
                    file.path
                ) ===
                normalizePath(
                    filePath
                )
        );


    if (!fileToSave) {

        console.error(
            "[STORE] File not found:",
            filePath
        );


        return false;

    }


    try {

        /*
        |--------------------------------------------------------------------------
        | Write Through Electron IPC
        |--------------------------------------------------------------------------
        */

        await window.craftale.filesystem.writeFile(

            fileToSave.path,

            fileToSave.content

        );


        /*
        |--------------------------------------------------------------------------
        | Mark File Clean
        |--------------------------------------------------------------------------
        */

        openedFiles.update(
            (files) => {

                return files.map(
                    (file) => {

                        if (
                            normalizePath(
                                file.path
                            ) ===
                            normalizePath(
                                filePath
                            )
                        ) {

                            return {

                                ...file,

                                isDirty: false

                            };

                        }


                        return file;

                    }
                );

            }
        );


        /*
        |--------------------------------------------------------------------------
        | Update Active File
        |--------------------------------------------------------------------------
        */

        activeFile.update(
            (file) => {

                if (
                    !file
                ) {

                    return file;

                }


                if (
                    normalizePath(
                        file.path
                    ) !==
                    normalizePath(
                        filePath
                    )
                ) {

                    return file;

                }


                return {

                    ...file,

                    isDirty: false

                };

            }
        );


        console.log(
            "[STORE] File saved:",
            filePath
        );


        return true;

    } catch (error) {

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
    filePath: string
) {

    const files =
        get(openedFiles);


    const index =
        files.findIndex(
            (file) =>
                normalizePath(
                    file.path
                ) ===
                normalizePath(
                    filePath
                )
        );


    if (
        index === -1
    ) {

        return;

    }


    const newFiles =
        files.filter(
            (file) =>
                normalizePath(
                    file.path
                ) !==
                normalizePath(
                    filePath
                )
        );


    openedFiles.set(
        newFiles
    );


    const currentActive =
        get(activeFile);


    if (
        currentActive &&
        normalizePath(
            currentActive.path
        ) ===
        normalizePath(
            filePath
        )
    ) {

        if (
            newFiles.length === 0
        ) {

            activeFile.set(
                null
            );

        } else {

            const newIndex =
                Math.max(
                    0,
                    index - 1
                );


            activeFile.set(
                newFiles[newIndex]
            );

        }

    }

}