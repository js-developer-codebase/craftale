import { writable } from "svelte/store";


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
                        item.path === file.path
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
                        item.path === path
                );


            if (file) {

                activeFile.set(file);

                activePath.set(path);

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
                        file.path !== path
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
                file.path !== path
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
                        file.path !== path
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
                file.path !== path
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
                        file.path === path
                );


            if (index === -1) {

                return files;

            }


            const newFiles =
                files.filter(
                    file =>
                        file.path !== path
                );


            /*
            |--------------------------------------------------------------------------
            | Closed Active File
            |--------------------------------------------------------------------------
            */

            activePath.update(
                currentPath => {

                    if (
                        currentPath !== path
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