import { writable, get } from "svelte/store";
import {
    openedFiles,
    pathsEqual,
    updateFileContent,
    markFileSaved
} from "./workspace";
import { notify } from "./notifications";


/*
|--------------------------------------------------------------------------
| Self-Operation Registry
|--------------------------------------------------------------------------
|
| Suppresses false external change notifications when Craftale itself
| saves, renames, creates, or moves files.
|
*/

const recentlyTouched = new Map<string, number>();

const TOUCH_GRACE_PERIOD_MS = 750;


export function recordSelfTouch(filePath: string) {

    const norm = filePath.replace(/\\/g, "/").toLowerCase();

    recentlyTouched.set(norm, Date.now());


    /* Auto cleanup */

    setTimeout(() => {

        const timestamp = recentlyTouched.get(norm);

        if (timestamp && Date.now() - timestamp >= TOUCH_GRACE_PERIOD_MS) {

            recentlyTouched.delete(norm);

        }

    }, TOUCH_GRACE_PERIOD_MS + 100);

}


export function isSelfTouched(filePath: string): boolean {

    const norm = filePath.replace(/\\/g, "/").toLowerCase();

    const timestamp = recentlyTouched.get(norm);

    if (!timestamp) return false;

    return (Date.now() - timestamp) < TOUCH_GRACE_PERIOD_MS;

}


/*
|--------------------------------------------------------------------------
| Selective Directory Invalidation Store
|--------------------------------------------------------------------------
|
| Broadcasts targeted updates so ONLY the affected directory reloads.
| Prevents full-tree reloads and UI thrashing.
|
*/

export interface DirectoryInvalidation {

    dirPath: string;

    timestamp: number;

}


export const directoryInvalidation =
    writable<DirectoryInvalidation | null>(null);


const pendingDirs = new Set<string>();

let debounceTimer: ReturnType<typeof setTimeout> | null = null;


function scheduleDirectoryInvalidation(dirPath: string) {

    pendingDirs.add(dirPath);

    if (debounceTimer) {

        clearTimeout(debounceTimer);

    }

    debounceTimer = setTimeout(() => {

        const dirsToNotify = Array.from(pendingDirs);

        pendingDirs.clear();

        debounceTimer = null;

        dirsToNotify.forEach((dir) => {

            directoryInvalidation.set({
                dirPath: dir,
                timestamp: Date.now()
            });

        });

    }, 80);

}


/*
|--------------------------------------------------------------------------
| External Conflict State
|--------------------------------------------------------------------------
*/

export interface ExternalFileConflict {

    path: string;

    name: string;

    type: "modified" | "deleted";

    diskContent?: string;

}


export const externalFileConflict =
    writable<ExternalFileConflict | null>(null);


export function clearExternalFileConflict() {

    externalFileConflict.set(null);

}


/*
|--------------------------------------------------------------------------
| Watcher Event Dispatcher & Opened Files Reaction
|--------------------------------------------------------------------------
*/

export function handleWatcherEvent(event: {
    type: "add" | "addDir" | "change" | "unlink" | "unlinkDir";
    path: string;
    parentDir: string;
}) {

    console.log("[WATCHER EVENT]", event.type, event.path);


    /*
    |--------------------------------------------------------------------------
    | 1. Structural Changes (Add, Remove) -> Invalidate Parent Directory
    |--------------------------------------------------------------------------
    */

    if (
        event.type === "add" ||
        event.type === "addDir" ||
        event.type === "unlink" ||
        event.type === "unlinkDir"
    ) {

        scheduleDirectoryInvalidation(event.parentDir);

    }


    /*
    |--------------------------------------------------------------------------
    | 2. Ignore changes triggered by Craftale itself
    |--------------------------------------------------------------------------
    */

    if (isSelfTouched(event.path)) {

        return;

    }


    /*
    |--------------------------------------------------------------------------
    | 3. Check Opened Files for External Modification / Deletion
    |--------------------------------------------------------------------------
    */

    const files = get(openedFiles);

    const openDoc = files.find((f) => pathsEqual(f.path, event.path));

    if (!openDoc) {

        return;

    }


    const fileName = openDoc.name;


    /*
    |--------------------------------------------------------------------------
    | External Modification
    |--------------------------------------------------------------------------
    */

    if (event.type === "change") {

        void handleExternalFileChange(openDoc);

    }


    /*
    |--------------------------------------------------------------------------
    | External Deletion
    |--------------------------------------------------------------------------
    */

    if (event.type === "unlink") {

        handleExternalFileDeletion(openDoc);

    }

}


async function handleExternalFileChange(file: {
    name: string;
    path: string;
    content: string;
    isDirty?: boolean;
}) {

    try {

        const newDiskContent =
            await window.craftale.filesystem.readFile(file.path);


        /* If content on disk matches memory, no real change */

        if (newDiskContent === file.content) {

            return;

        }


        if (!file.isDirty) {

            /*
            |--------------------------------------------------------------------------
            | Clean File -> Automatically Reload
            |--------------------------------------------------------------------------
            */

            recordSelfTouch(file.path);

            updateFileContent(file.path, newDiskContent);

            markFileSaved(file.path, newDiskContent);

            notify.info(`"${file.name}" was reloaded from disk.`);

        } else {

            /*
            |--------------------------------------------------------------------------
            | Dirty File -> Prompt Conflict Resolution Dialog
            |--------------------------------------------------------------------------
            */

            externalFileConflict.set({
                path: file.path,
                name: file.name,
                type: "modified",
                diskContent: newDiskContent
            });

        }

    } catch (err) {

        console.error("[WATCHER] Failed to read externally changed file:", err);

    }

}


function handleExternalFileDeletion(file: {
    name: string;
    path: string;
    isDirty?: boolean;
}) {

    if (!file.isDirty) {

        notify.warning(`"${file.name}" was deleted on disk.`);

    } else {

        notify.warning(
            `"${file.name}" was deleted on disk, but has unsaved edits in Craftale. Press Ctrl+S to save and recreate it.`
        );

    }

}
