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
    writable<string | null>(null);


/*
|--------------------------------------------------------------------------
| Open File
|--------------------------------------------------------------------------
*/

export function openFile(
    file: {
        name: string;
        path: string;
        content: string;
    }
) {

    const newFile: OpenFile = {

        name: file.name,

        path: file.path,

        content: file.content,

        isDirty: false

    };


    openedFiles.update(
        (files: OpenFile[]) => {

            /*
            |--------------------------------------------------------------------------
            | Check whether already open
            |--------------------------------------------------------------------------
            */

            const existing =
                files.find(
                    (item: OpenFile) =>
                        item.path === file.path
                );


            if (existing) {

                activeFile.set(existing);

                activePath.set(
                    existing.path
                );

                return files;

            }


            /*
            |--------------------------------------------------------------------------
            | Add new file
            |--------------------------------------------------------------------------
            */

            const updatedFiles: OpenFile[] = [
                ...files,
                newFile
            ];


            activeFile.set(newFile);

            activePath.set(
                newFile.path
            );


            return updatedFiles;

        }
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

    openedFiles.update(
        (files: OpenFile[]) => {

            const file:
                OpenFile | undefined =
                files.find(
                    (item: OpenFile) =>
                        item.path === filePath
                );


            if (!file) {

                return files;

            }


            activeFile.set(file);

            activePath.set(
                file.path
            );


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
    filePath: string,
    content: string
) {
    openedFiles.update(
        (files: OpenFile[]) => {

            const updatedFiles = files.map(
                (file: OpenFile): OpenFile => {

                    if (
                        file.path.toLowerCase() ===
                        filePath.toLowerCase()
                    ) {

                        return {
                            ...file,
                            content: content,
                            isDirty: true
                        };

                    }

                    return file;

                }
            );




            return updatedFiles;
        }
    );
}


/*
|--------------------------------------------------------------------------
| Mark File Saved
|--------------------------------------------------------------------------
*/

export function markFileSaved(
    filePath: string,
    content: string
) {

    openedFiles.update(
        (files: OpenFile[]) => {

            return files.map(
                (file: OpenFile): OpenFile => {

                    if (
                        file.path !== filePath
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
        (
            file: OpenFile | null
        ): OpenFile | null => {

            if (
                file === null
            ) {

                return null;

            }


            if (
                file.path !== filePath
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

export function closeFile(filePath: string) {

    let filesSnapshot: OpenFile[] = [];

    /*
    |--------------------------------------------------------------------------
    | Get current files
    |--------------------------------------------------------------------------
    */

    openedFiles.subscribe(
        (files: OpenFile[]) => {

            filesSnapshot = files;

        }
    )();


    /*
    |--------------------------------------------------------------------------
    | Find file
    |--------------------------------------------------------------------------
    */

    const index: number =
        filesSnapshot.findIndex(
            (file: OpenFile) =>
                file.path === filePath
        );


    if (index === -1) {

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | Remove file
    |--------------------------------------------------------------------------
    */

    const remaining: OpenFile[] =
        filesSnapshot.filter(
            (file: OpenFile) =>
                file.path !== filePath
        );


    /*
    |--------------------------------------------------------------------------
    | Get current active file
    |--------------------------------------------------------------------------
    */

    let currentPath: string | null = null;

    activePath.subscribe(
        (path: string | null) => {

            currentPath = path;

        }
    )();


    /*
    |--------------------------------------------------------------------------
    | Update opened files
    |--------------------------------------------------------------------------
    */

    openedFiles.set(
        remaining
    );


    /*
    |--------------------------------------------------------------------------
    | If another file is active
    |--------------------------------------------------------------------------
    */

    if (
        currentPath !== filePath
    ) {

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | No files remaining
    |--------------------------------------------------------------------------
    */

    if (
        remaining.length === 0
    ) {

        activeFile.set(null);

        activePath.set(null);

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | Select another tab
    |--------------------------------------------------------------------------
    */

    const newIndex: number =
        Math.min(
            Math.max(
                index - 1,
                0
            ),
            remaining.length - 1
        );


    const newFile: OpenFile =
        remaining[newIndex];


    /*
    |--------------------------------------------------------------------------
    | Activate new file
    |--------------------------------------------------------------------------
    */

    activeFile.set(
        newFile
    );

    activePath.set(
        newFile.path
    );

}