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

export function openFile(file: OpenFile) {

    console.log(
        "[STORE] Opening file:",
        file.path
    );


    /*
    |--------------------------------------------------------------------------
    | Add to tabs if not already open
    |--------------------------------------------------------------------------
    */

    openedFiles.update(files => {

        const exists =
            files.some(
                existing =>
                    existing.path === file.path
            );


        if (exists) {

            return files;

        }


        return [
            ...files,
            file
        ];

    });


    /*
    |--------------------------------------------------------------------------
    | Set active file
    |--------------------------------------------------------------------------
    */

    activeFile.set(file);

    activePath.set(file.path);


    console.log(
        "[STORE] Active file:",
        file.name
    );

}


/*
|--------------------------------------------------------------------------
| Activate Existing Tab
|--------------------------------------------------------------------------
*/

export function activateFile(
    filePath: string
) {

    openedFiles.subscribe(files => {

        const file =
            files.find(
                item =>
                    item.path === filePath
            );


        if (file) {

            activeFile.set(file);

            activePath.set(file.path);

        }

    })();

}


/*
|--------------------------------------------------------------------------
| Close File
|--------------------------------------------------------------------------
*/

export function closeFile(
    filePath: string
) {

    openedFiles.update(files => {

        const index =
            files.findIndex(
                file =>
                    file.path === filePath
            );


        if (index === -1) {

            return files;

        }


        const remaining =
            files.filter(
                file =>
                    file.path !== filePath
            );


        /*
        |--------------------------------------------------------------------------
        | Check whether active file is closing
        |--------------------------------------------------------------------------
        */

        activeFile.update(current => {

            if (
                current?.path !== filePath
            ) {

                return current;

            }


            if (
                remaining.length === 0
            ) {

                activePath.set(null);

                return null;

            }


            /*
            |--------------------------------------------------------------------------
            | Activate previous tab
            |--------------------------------------------------------------------------
            */

            const newIndex =
                Math.max(
                    0,
                    index - 1
                );


            const newFile =
                remaining[newIndex];


            activePath.set(
                newFile.path
            );


            return newFile;

        });


        return remaining;

    });

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

    openedFiles.update(files =>

        files.map(file => {

            if (
                file.path !== filePath
            ) {

                return file;

            }


            return {
                ...file,
                content
            };

        })

    );


    /*
    |--------------------------------------------------------------------------
    | Also update active file
    |--------------------------------------------------------------------------
    */

    activeFile.update(file => {

        if (
            !file ||
            file.path !== filePath
        ) {

            return file;

        }


        return {
            ...file,
            content
        };

    });

}