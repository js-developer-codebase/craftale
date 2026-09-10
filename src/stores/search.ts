/*
|--------------------------------------------------------------------------
| Workspace Search & Replace Store
|--------------------------------------------------------------------------
| Manages query parameters, search execution, result preview trees,
| match navigation, and file/workspace replacements.
|--------------------------------------------------------------------------
*/

import { writable, derived, get } from "svelte/store";
import { workspacePath, openedFiles, updateFileContent } from "./workspace";
import { recordSelfTouch } from "./watcher";
import { requestJump } from "./navigation";
import { notify } from "./notifications";

export interface SearchMatchItem {
    lineNumber: number;
    column: number;
    length: number;
    lineText: string;
    preview: {
        before: string;
        match: string;
        after: string;
    };
}

export interface FileSearchResultItem {
    path: string;
    relativePath: string;
    fileName: string;
    matches: SearchMatchItem[];
}

/*
|--------------------------------------------------------------------------
| State Variables
|--------------------------------------------------------------------------
*/

export const searchQuery = writable("");
export const replaceQuery = writable("");

export const isReplaceOpen = writable(false);
export const isRegex = writable(false);
export const isCaseSensitive = writable(false);
export const matchWholeWord = writable(false);

export const includePattern = writable("");
export const excludePattern = writable("");
export const isDetailsOpen = writable(false);
export const onlyOpenEditors = writable(false);
export const preserveCase = writable(false);

export const isSearching = writable(false);
export const isReplacing = writable(false);
export const searchError = writable<string | null>(null);

export const searchResults = writable<FileSearchResultItem[]>([]);
export const searchDurationMs = writable(0);
export const searchTruncated = writable(false);

export const totalMatches = derived(searchResults, ($res) =>
    $res.reduce((sum, item) => sum + item.matches.length, 0)
);

export const totalFiles = derived(searchResults, ($res) => $res.length);

export const collapsedFiles = writable<Set<string>>(new Set());

export const activeMatchSelection = writable<{
    fileIndex: number;
    matchIndex: number;
} | null>(null);

export const replaceConfirmModal = writable<{
    visible: boolean;
    totalMatches: number;
    totalFiles: number;
} | null>(null);

/*
|--------------------------------------------------------------------------
| Search Execution
|--------------------------------------------------------------------------
*/

let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerSearchDebounced(delay = 300) {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
    }
    searchDebounceTimer = setTimeout(() => {
        void runWorkspaceSearch();
    }, delay);
}

export async function runWorkspaceSearch() {
    if (searchDebounceTimer) {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = null;
    }

    const query = get(searchQuery).trim();
    const currentWorkspace = get(workspacePath);

    if (!currentWorkspace || !query) {
        searchResults.set([]);
        searchError.set(null);
        searchDurationMs.set(0);
        searchTruncated.set(false);
        activeMatchSelection.set(null);
        return;
    }

    isSearching.set(true);
    searchError.set(null);

    const regex = get(isRegex);
    const caseSensitive = get(isCaseSensitive);
    const wholeWord = get(matchWholeWord);
    let inc = get(includePattern).trim();
    const exc = get(excludePattern).trim();

    /* If only open editors filter is active */
    if (get(onlyOpenEditors)) {
        const openList = get(openedFiles);
        if (openList.length === 0) {
            searchResults.set([]);
            isSearching.set(false);
            return;
        }
        const openNames = openList.map((f) => f.name).join(", ");
        inc = inc ? `${inc}, ${openNames}` : openNames;
    }

    try {
        if (!window.craftale?.search?.searchWorkspace) {
            throw new Error("Search service unavailable in current environment");
        }

        const response = await window.craftale.search.searchWorkspace(
            currentWorkspace,
            {
                query,
                isRegex: regex,
                isCaseSensitive: caseSensitive,
                matchWholeWord: wholeWord,
                includePattern: inc,
                excludePattern: exc
            }
        );

        if (response.error) {
            searchError.set(response.error);
            searchResults.set([]);
            searchDurationMs.set(0);
            searchTruncated.set(false);
        } else {
            searchResults.set(response.results);
            searchDurationMs.set(response.durationMs);
            searchTruncated.set(response.truncated);

            /* Auto expand all files on fresh search */
            collapsedFiles.set(new Set());
            activeMatchSelection.set(null);
        }
    } catch (err: any) {
        if (err.message && err.message.includes("No handler registered")) {
            searchError.set(
                "Search service was added to Electron's main process. Please restart the application (Ctrl+C in terminal and run 'npm run dev' again) to load the new search handlers."
            );
        } else {
            searchError.set(err.message || "Failed to execute workspace search");
        }
        searchResults.set([]);
    } finally {
        isSearching.set(false);
    }
}

export function clearSearch() {
    searchQuery.set("");
    searchResults.set([]);
    searchError.set(null);
    searchDurationMs.set(0);
    searchTruncated.set(false);
    activeMatchSelection.set(null);
}

/*
|--------------------------------------------------------------------------
| Collapse / Expand Controls
|--------------------------------------------------------------------------
*/

export function toggleFileCollapse(filePath: string) {
    collapsedFiles.update((set) => {
        const next = new Set(set);
        if (next.has(filePath)) {
            next.delete(filePath);
        } else {
            next.add(filePath);
        }
        return next;
    });
}

export function collapseAllFiles() {
    const results = get(searchResults);
    const set = new Set<string>();
    results.forEach((r) => set.add(r.path));
    collapsedFiles.set(set);
}

export function expandAllFiles() {
    collapsedFiles.set(new Set());
}

/*
|--------------------------------------------------------------------------
| Match Selection & Navigation
|--------------------------------------------------------------------------
*/

export function selectMatch(
    fileIndex: number,
    matchIndex: number,
    preview = false
) {
    const results = get(searchResults);
    if (!results[fileIndex] || !results[fileIndex].matches[matchIndex]) return;

    const file = results[fileIndex];
    const match = file.matches[matchIndex];

    activeMatchSelection.set({ fileIndex, matchIndex });

    /* Ensure file node is expanded */
    collapsedFiles.update((set) => {
        if (set.has(file.path)) {
            const next = new Set(set);
            next.delete(file.path);
            return next;
        }
        return set;
    });

    requestJump(match.lineNumber, match.column, file.path, preview, match.length);
}

export function navigateNextMatch() {
    const results = get(searchResults);
    if (results.length === 0) return;

    const current = get(activeMatchSelection);

    if (!current) {
        if (results[0]?.matches.length > 0) {
            selectMatch(0, 0);
        }
        return;
    }

    let { fileIndex, matchIndex } = current;
    matchIndex++;

    if (matchIndex < results[fileIndex].matches.length) {
        selectMatch(fileIndex, matchIndex);
        return;
    }

    /* Move to next file that has matches */
    for (let f = fileIndex + 1; f < results.length; f++) {
        if (results[f].matches.length > 0) {
            selectMatch(f, 0);
            return;
        }
    }

    /* Wrap to first file */
    for (let f = 0; f <= fileIndex; f++) {
        if (results[f].matches.length > 0) {
            selectMatch(f, 0);
            return;
        }
    }
}

export function navigatePrevMatch() {
    const results = get(searchResults);
    if (results.length === 0) return;

    const current = get(activeMatchSelection);

    if (!current) {
        const lastFileIdx = results.length - 1;
        const lastMatchIdx = results[lastFileIdx].matches.length - 1;
        selectMatch(lastFileIdx, Math.max(0, lastMatchIdx));
        return;
    }

    let { fileIndex, matchIndex } = current;
    matchIndex--;

    if (matchIndex >= 0) {
        selectMatch(fileIndex, matchIndex);
        return;
    }

    /* Move to previous file's last match */
    for (let f = fileIndex - 1; f >= 0; f--) {
        if (results[f].matches.length > 0) {
            selectMatch(f, results[f].matches.length - 1);
            return;
        }
    }

    /* Wrap around to last file's last match */
    for (let f = results.length - 1; f >= fileIndex; f--) {
        if (results[f].matches.length > 0) {
            selectMatch(f, results[f].matches.length - 1);
            return;
        }
    }
}

/*
|--------------------------------------------------------------------------
| Dismiss Match / File
|--------------------------------------------------------------------------
*/

export function dismissMatch(fileIndex: number, matchIndex: number) {
    searchResults.update((list) => {
        if (!list[fileIndex]) return list;
        const updatedMatches = list[fileIndex].matches.filter(
            (_, idx) => idx !== matchIndex
        );

        if (updatedMatches.length === 0) {
            return list.filter((_, idx) => idx !== fileIndex);
        }

        return list.map((item, idx) =>
            idx === fileIndex ? { ...item, matches: updatedMatches } : item
        );
    });
}

export function dismissFile(fileIndex: number) {
    searchResults.update((list) => list.filter((_, idx) => idx !== fileIndex));
}

/*
|--------------------------------------------------------------------------
| Replacement Operations
|--------------------------------------------------------------------------
*/

export async function replaceOneMatch(fileIndex: number, matchIndex: number) {
    const results = get(searchResults);
    const file = results[fileIndex];
    if (!file) return;
    const match = file.matches[matchIndex];
    if (!match) return;

    const query = get(searchQuery);
    const replacement = get(replaceQuery);
    const regex = get(isRegex);
    const caseSensitive = get(isCaseSensitive);
    const wholeWord = get(matchWholeWord);

    try {
        recordSelfTouch(file.path);

        const res = await window.craftale.search.replaceInFile(file.path, {
            query,
            replacement,
            isRegex: regex,
            isCaseSensitive: caseSensitive,
            matchWholeWord: wholeWord,
            lineNumber: match.lineNumber,
            column: match.column
        });

        if (!res.success) {
            notify.error(`Replace failed: ${res.error || "Unknown error"}`);
            return;
        }

        /* Update editor model if open */
        if (res.newContent != null) {
            updateFileContent(file.path, res.newContent);
        }

        /* Remove match from result list */
        dismissMatch(fileIndex, matchIndex);

        notify.info("Replaced 1 occurrence", { duration: 1500 });
    } catch (err: any) {
        notify.error(`Replace failed: ${err.message}`);
    }
}

export async function replaceAllInFile(fileIndex: number) {
    const results = get(searchResults);
    const file = results[fileIndex];
    if (!file) return;

    const query = get(searchQuery);
    const replacement = get(replaceQuery);
    const regex = get(isRegex);
    const caseSensitive = get(isCaseSensitive);
    const wholeWord = get(matchWholeWord);

    try {
        recordSelfTouch(file.path);

        const res = await window.craftale.search.replaceInFile(file.path, {
            query,
            replacement,
            isRegex: regex,
            isCaseSensitive: caseSensitive,
            matchWholeWord: wholeWord
        });

        if (!res.success) {
            notify.error(`Replace in file failed: ${res.error || "Unknown error"}`);
            return;
        }

        if (res.newContent != null) {
            updateFileContent(file.path, res.newContent);
        }

        const count = file.matches.length;
        dismissFile(fileIndex);

        notify.success(`Replaced ${count} occurrences in ${file.fileName}`, {
            duration: 2500
        });
    } catch (err: any) {
        notify.error(`Replace in file failed: ${err.message}`);
    }
}

export function promptReplaceWorkspace() {
    const matches = get(totalMatches);
    const files = get(totalFiles);
    if (matches === 0 || files === 0) return;

    replaceConfirmModal.set({
        visible: true,
        totalMatches: matches,
        totalFiles: files
    });
}

export async function confirmReplaceWorkspace() {
    const modal = get(replaceConfirmModal);
    replaceConfirmModal.set(null);
    if (!modal) return;

    const currentWorkspace = get(workspacePath);
    const results = get(searchResults);
    if (!currentWorkspace || results.length === 0) return;

    const query = get(searchQuery);
    const replacement = get(replaceQuery);
    const regex = get(isRegex);
    const caseSensitive = get(isCaseSensitive);
    const wholeWord = get(matchWholeWord);
    const filePaths = results.map((r) => r.path);

    isReplacing.set(true);

    try {
        filePaths.forEach((p) => recordSelfTouch(p));

        const res = await window.craftale.search.replaceWorkspace(
            currentWorkspace,
            {
                query,
                replacement,
                isRegex: regex,
                isCaseSensitive: caseSensitive,
                matchWholeWord: wholeWord,
                filePaths
            }
        );

        if (!res.success) {
            notify.error(`Workspace replace failed: ${res.error || "Unknown error"}`);
            return;
        }

        /* Update open files */
        if (res.modifiedFiles) {
            for (const item of res.modifiedFiles) {
                updateFileContent(item.filePath, item.newContent);
            }
        }

        notify.success(
            `Replaced ${res.totalReplacements} occurrences across ${res.totalModifiedFiles} files`,
            { duration: 4000 }
        );

        /* Re-run search to update remainder (or clear) */
        await runWorkspaceSearch();
    } catch (err: any) {
        notify.error(`Workspace replace failed: ${err.message}`);
    } finally {
        isReplacing.set(false);
    }
}

export function cancelReplaceWorkspace() {
    replaceConfirmModal.set(null);
}
