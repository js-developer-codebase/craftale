/*
|--------------------------------------------------------------------------
| Windows Reserved Filenames & Characters
|--------------------------------------------------------------------------
*/

const INVALID_CHARS_REGEX = /[\\/:*?"<>|]/;

const RESERVED_NAMES = new Set([
    "CON", "PRN", "AUX", "NUL",
    "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
    "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
]);


/*
|--------------------------------------------------------------------------
| Validate Filename
|--------------------------------------------------------------------------
|
| Ensures names conform to OS filesystem rules before hitting IPC.
|
*/

export function validateFilename(name: string): { valid: boolean; error?: string } {

    const trimmed = name.trim();


    if (!trimmed) {

        return {
            valid: false,
            error: "A file or folder name must not be empty."
        };

    }


    if (INVALID_CHARS_REGEX.test(trimmed)) {

        return {
            valid: false,
            error: "A file or folder name cannot contain any of the following characters: \\ / : * ? \" < > |"
        };

    }


    if (trimmed.endsWith(".") || trimmed.endsWith(" ")) {

        return {
            valid: false,
            error: "A file or folder name cannot end with a period or space."
        };

    }


    /* Check base name against reserved names */

    const baseName = trimmed.split(".")[0]?.toUpperCase() || "";

    if (RESERVED_NAMES.has(baseName)) {

        return {
            valid: false,
            error: `"${trimmed}" is a reserved system name and cannot be used.`
        };

    }


    return {
        valid: true
    };

}


/*
|--------------------------------------------------------------------------
| Format Error Message
|--------------------------------------------------------------------------
|
| Normalizes raw Node.js / Electron error objects into friendly messages.
|
*/

export function formatErrorMessage(err: unknown): { message: string; details?: string } {

    if (!err) {

        return {
            message: "An unknown error occurred."
        };

    }


    if (typeof err === "string") {

        return {
            message: cleanErrorMessage(err)
        };

    }


    const error = err as Error & { code?: string };

    const rawMessage = error.message || String(error);

    const code = error.code;

    const details = error.stack || rawMessage;


    /*
    |--------------------------------------------------------------------------
    | Categorized Error Codes
    |--------------------------------------------------------------------------
    */

    if (code === "ENOENT" || rawMessage.includes("ENOENT")) {

        return {
            message: "The requested file or directory could not be found.",
            details
        };

    }


    if (
        code === "EACCES" ||
        code === "EPERM" ||
        rawMessage.includes("EACCES") ||
        rawMessage.includes("EPERM")
    ) {

        return {
            message: "Permission denied. Please verify you have permissions to modify this path.",
            details
        };

    }


    if (code === "EBUSY" || rawMessage.includes("EBUSY")) {

        return {
            message: "The file or folder is locked or currently in use by another application.",
            details
        };

    }


    if (code === "ENOSPC" || rawMessage.includes("ENOSPC")) {

        return {
            message: "Disk is full. Free up space on this drive to continue.",
            details
        };

    }


    if (code === "EEXIST" || rawMessage.includes("already exists")) {

        return {
            message: cleanErrorMessage(rawMessage),
            details
        };

    }


    return {
        message: cleanErrorMessage(rawMessage),
        details
    };

}


/*
|--------------------------------------------------------------------------
| Clean Electron / Node Prefixes
|--------------------------------------------------------------------------
|
| Removes "Error: Error invoking remote method '...': Error: " boilerplate.
|
*/

function cleanErrorMessage(msg: string): string {

    return msg
        .replace(/^Error:\s*Error invoking remote method '[^']+':\s*/i, "")
        .replace(/^Error:\s*/i, "")
        .trim();

}
