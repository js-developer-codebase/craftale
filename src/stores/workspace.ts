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

    isPinned?: boolean;

    isPreview?: boolean;

};


/*
|--------------------------------------------------------------------------
| Closed Tab History (for Reopen Closed Tab)
|--------------------------------------------------------------------------
*/

export interface ClosedTabRecord {

    path: string;

    name: string;

}

export const recentlyClosedTabs =
    writable<ClosedTabRecord[]>([]);


export function recordClosedTab(file: ClosedTabRecord) {

    recentlyClosedTabs.update(tabs => {

        const filtered = tabs.filter(t => !pathsEqual(t.path, file.path));

        return [file, ...filtered].slice(0, 25);

    });

}


export function popClosedTab(): ClosedTabRecord | null {

    let popped: ClosedTabRecord | null = null;

    recentlyClosedTabs.update(tabs => {

        if (tabs.length === 0) return tabs;

        popped = tabs[0];

        return tabs.slice(1);

    });

    return popped;

}


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
    file: OpenFile,
    options?: { preview?: boolean; pinned?: boolean }
) {

    console.log(
        "[STORE] Opening file:",
        file.path,
        options
    );

    const isPreview = options?.preview ?? false;

    const isPinned = options?.pinned ?? false;

    let activatedDoc: OpenFile = {
        ...file,
        isDirty: file.isDirty ?? false,
        isPinned,
        isPreview
    };


    openedFiles.update(files => {

        const existingIndex = files.findIndex(item => pathsEqual(item.path, file.path));

        if (existingIndex !== -1) {

            const existing = files[existingIndex];

            const updated: OpenFile = {
                ...existing,
                isPreview: isPreview ? existing.isPreview : false,
                isPinned: isPinned || existing.isPinned
            };

            activatedDoc = updated;

            return files.map((f, i) => (i === existingIndex ? updated : f));

        }


        /* If requested as preview, replace an existing unpinned clean preview tab */

        if (isPreview) {

            const previewIndex = files.findIndex(
                f => f.isPreview && !f.isDirty && !f.isPinned
            );

            if (previewIndex !== -1) {

                const replacedTab = files[previewIndex];

                recordClosedTab({ path: replacedTab.path, name: replacedTab.name });

                const replaced: OpenFile = {
                    ...file,
                    isDirty: false,
                    isPinned: false,
                    isPreview: true
                };

                activatedDoc = replaced;

                return files.map((f, i) => (i === previewIndex ? replaced : f));

            }

        }


        const newDoc: OpenFile = {
            ...file,
            isDirty: file.isDirty ?? false,
            isPinned,
            isPreview
        };

        activatedDoc = newDoc;


        if (isPinned) {

            let lastPinnedIdx = -1;

            for (let i = files.length - 1; i >= 0; i--) {

                if (files[i].isPinned) {

                    lastPinnedIdx = i;

                    break;

                }

            }

            if (lastPinnedIdx === -1) {

                return [newDoc, ...files];

            } else {

                const nextFiles = [...files];

                nextFiles.splice(lastPinnedIdx + 1, 0, newDoc);

                return nextFiles;

            }

        }


        return [...files, newDoc];

    });


    activeFile.set(activatedDoc);

    activePath.set(activatedDoc.path);

}


/*
|--------------------------------------------------------------------------
| Promote Preview Tab to Permanent
|--------------------------------------------------------------------------
*/

export function promotePreviewTab(path: string) {

    openedFiles.update(files =>
        files.map(f => (pathsEqual(f.path, path) ? { ...f, isPreview: false } : f))
    );

    activeFile.update(f =>
        f && pathsEqual(f.path, path) ? { ...f, isPreview: false } : f
    );

}


/*
|--------------------------------------------------------------------------
| Pin Tab
|--------------------------------------------------------------------------
*/

export function pinTab(path: string) {

    openedFiles.update(files => {

        const target = files.find(f => pathsEqual(f.path, path));

        if (!target) return files;

        const updatedTarget: OpenFile = {
            ...target,
            isPinned: true,
            isPreview: false
        };

        const others = files.filter(f => !pathsEqual(f.path, path));

        const pinned = others.filter(f => f.isPinned);

        const unpinned = others.filter(f => !f.isPinned);

        return [...pinned, updatedTarget, ...unpinned];

    });

    activeFile.update(f =>
        f && pathsEqual(f.path, path) ? { ...f, isPinned: true, isPreview: false } : f
    );

}


/*
|--------------------------------------------------------------------------
| Unpin Tab
|--------------------------------------------------------------------------
*/

export function unpinTab(path: string) {

    openedFiles.update(files => {

        const target = files.find(f => pathsEqual(f.path, path));

        if (!target) return files;

        const updatedTarget: OpenFile = {
            ...target,
            isPinned: false
        };

        const others = files.filter(f => !pathsEqual(f.path, path));

        const pinned = others.filter(f => f.isPinned);

        const unpinned = others.filter(f => !f.isPinned);

        return [...pinned, updatedTarget, ...unpinned];

    });

    activeFile.update(f =>
        f && pathsEqual(f.path, path) ? { ...f, isPinned: false } : f
    );

}


/*
|--------------------------------------------------------------------------
| Reorder Tabs (Drag & Drop)
|--------------------------------------------------------------------------
*/

export function reorderTabs(fromIndex: number, toIndex: number) {

    openedFiles.update(files => {

        if (
            fromIndex < 0 ||
            fromIndex >= files.length ||
            toIndex < 0 ||
            toIndex >= files.length ||
            fromIndex === toIndex
        ) {

            return files;

        }

        const reordered = [...files];

        const [moved] = reordered.splice(fromIndex, 1);

        reordered.splice(toIndex, 0, moved);

        const pinned = reordered.filter(f => f.isPinned);

        const unpinned = reordered.filter(f => !f.isPinned);

        return [...pinned, ...unpinned];

    });

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

                        isDirty: true,

                        isPreview: false

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

                isDirty: true,

                isPreview: false

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

                        isDirty: false,

                        isPreview: false

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

                isDirty: false,

                isPreview: false

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


            const fileToClose = files[index];

            recordClosedTab({ path: fileToClose.path, name: fileToClose.name });


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
| Close Multiple Files (Batch Close)
|--------------------------------------------------------------------------
*/

export function closeMultipleFiles(paths: string[]) {

    openedFiles.update(files => {

        const pathsToClose = new Set(
            paths.map(p => p.replace(/\\/g, "/").toLowerCase())
        );

        files.forEach(f => {

            if (pathsToClose.has(f.path.replace(/\\/g, "/").toLowerCase())) {

                recordClosedTab({ path: f.path, name: f.name });

            }

        });

        const newFiles = files.filter(
            f => !pathsToClose.has(f.path.replace(/\\/g, "/").toLowerCase())
        );

        activePath.update(currentPath => {

            if (
                !currentPath ||
                !pathsToClose.has(currentPath.replace(/\\/g, "/").toLowerCase())
            ) {

                return currentPath;

            }

            if (newFiles.length > 0) {

                const nextFile = newFiles[0];

                activeFile.set(nextFile);

                return nextFile.path;

            }

            activeFile.set(null);

            return null;

        });

        return newFiles;

    });

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