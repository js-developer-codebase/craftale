const fs = require("fs/promises");
const path = require("path");


/*
|--------------------------------------------------------------------------
| Read Directory
|--------------------------------------------------------------------------
*/

async function readDirectory(directoryPath) {

    console.log(
        "[FS] Reading directory:",
        directoryPath
    );

    try {

        const entries = await fs.readdir(
            directoryPath,
            {
                withFileTypes: true
            }
        );


        const result = entries
            .map((entry) => {

                return {
                    name: entry.name,

                    path: path.resolve(
                        directoryPath,
                        entry.name
                    ),

                    type: entry.isDirectory()
                        ? "directory"
                        : "file"
                };

            })
            .sort((a, b) => {

                // Directories first
                if (a.type !== b.type) {

                    return a.type === "directory"
                        ? -1
                        : 1;

                }

                // Alphabetical
                return a.name.localeCompare(
                    b.name
                );

            });


        console.log(
            "[FS] Found",
            result.length,
            "items"
        );


        return result;

    } catch (error) {

        console.error(
            "[FS] Failed to read directory:",
            directoryPath
        );

        throw error;

    }

}


/*
|--------------------------------------------------------------------------
| Read File
|--------------------------------------------------------------------------
*/

async function readFile(filePath) {

    console.log(
        "[FS] Reading file:",
        filePath
    );


    try {

        const content =
            await fs.readFile(
                filePath,
                "utf-8"
            );


        console.log(
            "[FS] File read successfully:",
            filePath
        );


        return content;

    } catch (error) {

        console.error(
            "[FS] Failed to read file:",
            filePath
        );

        throw error;

    }

}


/*
|--------------------------------------------------------------------------
| Exports
|--------------------------------------------------------------------------
*/

module.exports = {

    readDirectory,

    readFile

};