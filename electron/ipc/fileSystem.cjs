const {
    ipcMain,
    dialog
} = require("electron");

const fs = require("fs/promises");
const path = require("path");


/*
|--------------------------------------------------------------------------
| Helper: Check if Path Exists
|--------------------------------------------------------------------------
*/

async function pathExists(targetPath) {

    try {

        await fs.access(targetPath);

        return true;

    } catch {

        return false;

    }

}


/*
|--------------------------------------------------------------------------
| Helper: Generate Unique Copy Name
|--------------------------------------------------------------------------
*/

async function getUniqueCopyPath(sourcePath) {

    const dir = path.dirname(sourcePath);

    const ext = path.extname(sourcePath);

    const baseName = path.basename(sourcePath, ext);

    let counter = 1;

    let candidateName = `${baseName} (copy)${ext}`;

    let candidatePath = path.join(dir, candidateName);


    while (await pathExists(candidatePath)) {

        counter++;

        candidateName = `${baseName} (copy ${counter})${ext}`;

        candidatePath = path.join(dir, candidateName);

    }


    return {
        path: candidatePath,
        name: candidateName
    };

}


/*
|--------------------------------------------------------------------------
| Helper: Generate Unique Numbered Name (For Keep Both)
|--------------------------------------------------------------------------
*/

async function getUniqueNumberedPath(destDir, originalName) {

    const ext = path.extname(originalName);

    const baseName = path.basename(originalName, ext);

    let counter = 1;

    let candidateName = `${baseName} (${counter})${ext}`;

    let candidatePath = path.join(destDir, candidateName);


    while (await pathExists(candidatePath)) {

        counter++;

        candidateName = `${baseName} (${counter})${ext}`;

        candidatePath = path.join(destDir, candidateName);

    }


    return {
        path: candidatePath,
        name: candidateName
    };

}


/*
|--------------------------------------------------------------------------
| Select Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:select-folder",
    async () => {

        console.log(
            "[IPC] select-folder"
        );


        const result =
            await dialog.showOpenDialog({

                properties: [
                    "openDirectory"
                ]

            });


        if (
            result.canceled ||
            result.filePaths.length === 0
        ) {

            console.log(
                "[IPC] Folder selection cancelled"
            );

            return null;

        }


        const selectedPath =
            result.filePaths[0];


        console.log(
            "[IPC] Selected folder:",
            selectedPath
        );


        return selectedPath;

    }
);


/*
|--------------------------------------------------------------------------
| Read Directory
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:read-directory",
    async (
        event,
        directoryPath
    ) => {

        console.log(
            "[IPC] read-directory:",
            directoryPath
        );


        try {

            const entries =
                await fs.readdir(
                    directoryPath,
                    {
                        withFileTypes: true
                    }
                );


            const items =
                entries.map(
                    (entry) => {

                        return {

                            name:
                                entry.name,

                            path:
                                path.join(
                                    directoryPath,
                                    entry.name
                                ),

                            type:
                                entry.isDirectory()
                                    ? "directory"
                                    : "file"

                        };

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Sort
            |--------------------------------------------------------------------------
            |
            | Directories first, files second (case-insensitive alphabetical).
            |
            */

            items.sort(
                (a, b) => {

                    if (
                        a.type !== b.type
                    ) {

                        return (
                            a.type === "directory"
                                ? -1
                                : 1
                        );

                    }


                    return a.name
                        .toLowerCase()
                        .localeCompare(
                            b.name.toLowerCase()
                        );

                }
            );


            return items;

        } catch (error) {

            console.error(
                "[FS] Failed to read directory:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Read File
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:read-file",
    async (
        event,
        filePath
    ) => {

        try {

            const content =
                await fs.readFile(
                    filePath,
                    "utf-8"
                );

            return content;

        } catch (error) {

            console.error(
                "[FS] Failed to read file:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Write File
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:write-file",
    async (
        event,
        filePath,
        content
    ) => {

        try {

            await fs.writeFile(
                filePath,
                content,
                "utf-8"
            );

            return true;

        } catch (error) {

            console.error(
                "[FS] Failed to save file:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Create File
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:create-file",
    async (
        event,
        parentPath,
        fileName
    ) => {

        console.log(
            "[IPC] create-file:",
            parentPath,
            fileName
        );


        try {

            const targetPath =
                path.join(
                    parentPath,
                    fileName
                );


            const exists =
                await pathExists(
                    targetPath
                );


            if (exists) {

                throw new Error(
                    `File "${fileName}" already exists.`
                );

            }


            await fs.writeFile(
                targetPath,
                "",
                "utf-8"
            );


            return {
                name: fileName,
                path: targetPath,
                type: "file"
            };

        } catch (error) {

            console.error(
                "[FS] Create file failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Create Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:create-folder",
    async (
        event,
        parentPath,
        folderName
    ) => {

        console.log(
            "[IPC] create-folder:",
            parentPath,
            folderName
        );


        try {

            const targetPath =
                path.join(
                    parentPath,
                    folderName
                );


            const exists =
                await pathExists(
                    targetPath
                );


            if (exists) {

                throw new Error(
                    `Folder "${folderName}" already exists.`
                );

            }


            await fs.mkdir(
                targetPath,
                {
                    recursive: true
                }
            );


            return {
                name: folderName,
                path: targetPath,
                type: "directory"
            };

        } catch (error) {

            console.error(
                "[FS] Create folder failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Rename File or Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:rename",
    async (
        event,
        oldPath,
        newName
    ) => {

        console.log(
            "[IPC] rename:",
            oldPath,
            newName
        );


        try {

            const parentDir =
                path.dirname(oldPath);

            const newPath =
                path.join(
                    parentDir,
                    newName
                );


            if (oldPath === newPath) {

                return {
                    oldPath,
                    newPath,
                    newName
                };

            }


            const exists =
                await pathExists(newPath);

            if (exists) {

                throw new Error(
                    `An item named "${newName}" already exists in this folder.`
                );

            }


            await fs.rename(
                oldPath,
                newPath
            );


            return {
                oldPath,
                newPath,
                newName
            };

        } catch (error) {

            console.error(
                "[FS] Rename failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Delete File or Folder (Recursive)
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:delete",
    async (
        event,
        targetPath,
        isDirectory
    ) => {

        console.log(
            "[IPC] delete:",
            targetPath,
            "isDirectory:",
            isDirectory
        );


        try {

            await fs.rm(
                targetPath,
                {
                    recursive: true,
                    force: true
                }
            );


            return {
                success: true,
                deletedPath: targetPath
            };

        } catch (error) {

            console.error(
                "[FS] Delete failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Exists
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:exists",
    async (
        event,
        targetPath
    ) => {

        return await pathExists(targetPath);

    }
);


/*
|--------------------------------------------------------------------------
| Copy File or Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:copy",
    async (
        event,
        srcPath,
        destDir,
        options = {}
    ) => {

        const {
            overwrite = false,
            keepBoth = false
        } = options;


        console.log(
            "[IPC] copy:",
            srcPath,
            "->",
            destDir,
            options
        );


        try {

            const originalName =
                path.basename(srcPath);

            let destPath =
                path.join(destDir, originalName);


            if (keepBoth) {

                const unique =
                    await getUniqueNumberedPath(
                        destDir,
                        originalName
                    );

                destPath = unique.path;

            } else if (!overwrite) {

                const exists =
                    await pathExists(destPath);

                if (exists) {

                    return {
                        conflict: true,
                        existingName: originalName,
                        destPath
                    };

                }

            }


            await fs.cp(
                srcPath,
                destPath,
                {
                    recursive: true,
                    force: true
                }
            );


            return {
                success: true,
                targetPath: destPath,
                name: path.basename(destPath)
            };

        } catch (error) {

            console.error(
                "[FS] Copy failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Move File or Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:move",
    async (
        event,
        srcPath,
        destDir,
        options = {}
    ) => {

        const {
            overwrite = false,
            keepBoth = false
        } = options;


        console.log(
            "[IPC] move:",
            srcPath,
            "->",
            destDir,
            options
        );


        try {

            const originalName =
                path.basename(srcPath);

            let destPath =
                path.join(destDir, originalName);


            /*
            |--------------------------------------------------------------------------
            | Prevent Moving Into Same Location
            |--------------------------------------------------------------------------
            */

            if (
                path.resolve(srcPath).toLowerCase() ===
                path.resolve(destPath).toLowerCase()
            ) {

                return {
                    success: true,
                    targetPath: srcPath,
                    name: originalName
                };

            }


            /*
            |--------------------------------------------------------------------------
            | Conflict Check
            |--------------------------------------------------------------------------
            */

            if (keepBoth) {

                const unique =
                    await getUniqueNumberedPath(
                        destDir,
                        originalName
                    );

                destPath = unique.path;

            } else if (!overwrite) {

                const exists =
                    await pathExists(destPath);

                if (exists) {

                    return {
                        conflict: true,
                        existingName: originalName,
                        destPath
                    };

                }

            }


            /*
            |--------------------------------------------------------------------------
            | If Overwriting Existing Destination
            |--------------------------------------------------------------------------
            */

            if (overwrite) {

                const exists =
                    await pathExists(destPath);

                if (exists) {

                    await fs.rm(
                        destPath,
                        {
                            recursive: true,
                            force: true
                        }
                    );

                }

            }


            /*
            |--------------------------------------------------------------------------
            | Rename with Cross-Device Fallback
            |--------------------------------------------------------------------------
            */

            try {

                await fs.rename(
                    srcPath,
                    destPath
                );

            } catch (err) {

                if (err.code === "EXDEV") {

                    await fs.cp(
                        srcPath,
                        destPath,
                        {
                            recursive: true
                        }
                    );

                    await fs.rm(
                        srcPath,
                        {
                            recursive: true,
                            force: true
                        }
                    );

                } else {

                    throw err;

                }

            }


            return {
                success: true,
                targetPath: destPath,
                name: path.basename(destPath)
            };

        } catch (error) {

            console.error(
                "[FS] Move failed:",
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Duplicate File or Folder
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "filesystem:duplicate",
    async (
        event,
        srcPath
    ) => {

        console.log(
            "[IPC] duplicate:",
            srcPath
        );


        try {

            const unique =
                await getUniqueCopyPath(
                    srcPath
                );


            await fs.cp(
                srcPath,
                unique.path,
                {
                    recursive: true
                }
            );


            return {
                success: true,
                targetPath: unique.path,
                name: unique.name
            };

        } catch (error) {

            console.error(
                "[FS] Duplicate failed:",
                error
            );

            throw error;

        }

/*
|--------------------------------------------------------------------------
| List Files (Recursive for Quick Open / Go To File)
|--------------------------------------------------------------------------
*/

const IGNORED_DIRS = new Set([
    ".git",
    "node_modules",
    "dist",
    ".svelte-kit",
    "release",
    "out",
    ".idea",
    ".vscode",
    "build",
    ".next",
    ".turbo",
    ".cache"
]);

async function scanFilesRecursively(dir, rootDir, results, maxFiles = 10000) {

    if (results.length >= maxFiles) return;

    try {

        const entries = await fs.readdir(dir, { withFileTypes: true });

        for (const entry of entries) {

            if (results.length >= maxFiles) break;

            const fullPath = path.join(dir, entry.name);

            if (entry.isDirectory()) {

                if (!IGNORED_DIRS.has(entry.name) && !entry.name.startsWith(".")) {

                    await scanFilesRecursively(fullPath, rootDir, results, maxFiles);

                }

            } else if (entry.isFile()) {

                const rel = path.relative(rootDir, fullPath).replace(/\\/g, "/");

                results.push({
                    name: entry.name,
                    path: fullPath,
                    relativePath: rel,
                    extension: path.extname(entry.name).toLowerCase().replace(/^\./, "")
                });

            }

        }

    } catch (err) {

        console.warn("[FS] scanFilesRecursively error at", dir, err.message);

    }

}

ipcMain.handle(
    "filesystem:list-files",
    async (event, directoryPath) => {

        console.log("[IPC] list-files:", directoryPath);

        try {

            const results = [];

            if (!directoryPath) return results;

            await scanFilesRecursively(directoryPath, directoryPath, results);

            return results;

        } catch (error) {

            console.error("[FS] list-files failed:", error);

            throw error;

        }

    }
);


module.exports = {};