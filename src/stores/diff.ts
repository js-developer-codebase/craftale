/*
|--------------------------------------------------------------------------
| Git Diff Store
|--------------------------------------------------------------------------
| Manages active file diff comparisons (Working Tree vs HEAD, Staged vs HEAD,
| and Branch comparisons), inline/split view mode, line-level staging,
| and change discarding.
|--------------------------------------------------------------------------
*/

import { writable, get } from "svelte/store";
import { workspacePath, activateFile, openFile, updateFileContent } from "./workspace";
import { refreshGitStatus, stageFiles, unstageFiles, discardFiles, type GitFileEntry } from "./git";
import { notify } from "./notifications";

export interface DiffTarget {
    id: string;
    filePath: string;
    relativePath: string;
    fileName: string;
    originalContent: string;
    modifiedContent: string;
    originalLabel: string;
    modifiedLabel: string;
    language: string;
    mode: "working-tree" | "staged" | "branch-compare";
    baseRef: string;
    targetRef?: string;
    status: string; // 'M' | 'A' | 'D' | '?' | 'R'
    isStaged?: boolean;
}

export const activeDiff = writable<DiffTarget | null>(null);
export const isInlineDiff = writable<boolean>(false);

/* Language detection helper */
export function getLanguageForFile(fileName: string): string {
    const ext = fileName.split(".").pop()?.toLowerCase() || "";
    switch (ext) {
        case "ts":
        case "tsx":
            return "typescript";
        case "js":
        case "jsx":
        case "mjs":
        case "cjs":
            return "javascript";
        case "json":
            return "json";
        case "css":
        case "scss":
        case "less":
            return "css";
        case "html":
        case "htm":
            return "html";
        case "svelte":
            return "svelte";
        case "md":
            return "markdown";
        case "py":
            return "python";
        case "rs":
            return "rust";
        case "go":
            return "go";
        case "sql":
            return "sql";
        case "yml":
        case "yaml":
            return "yaml";
        case "xml":
            return "xml";
        default:
            return "plaintext";
    }
}

/*
|--------------------------------------------------------------------------
| Open Working Tree vs HEAD Diff
|--------------------------------------------------------------------------
*/

export async function openWorkingTreeDiff(file: {
    path: string;
    relativePath?: string;
    fileName?: string;
    status?: string;
}) {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.git || !window.craftale?.filesystem) return;

    const rel = file.relativePath || file.path.replace(ws, "").replace(/^[\\/]/, "").replace(/\\/g, "/");
    const name = file.fileName || file.path.split(/[\\/]/).pop() || rel;
    const status = file.status || "M";

    try {
        // 1. Get working tree content (modified)
        let modifiedContent = "";
        if (status !== "D") {
            try {
                modifiedContent = await window.craftale.filesystem.readFile(file.path);
            } catch {
                modifiedContent = "";
            }
        }

        // 2. Get HEAD content (original)
        let originalContent = "";
        if (status !== "A" && status !== "?") {
            const headRes = await window.craftale.git.getFileContent(ws, "HEAD", rel);
            if (headRes.success && headRes.exists) {
                originalContent = headRes.content;
            }
        }

        const target: DiffTarget = {
            id: `diff:working:${rel}`,
            filePath: file.path,
            relativePath: rel,
            fileName: name,
            originalContent,
            modifiedContent,
            originalLabel: "HEAD",
            modifiedLabel: "Working Tree",
            language: getLanguageForFile(name),
            mode: "working-tree",
            baseRef: "HEAD",
            status,
            isStaged: false
        };

        activeDiff.set(target);
    } catch (err: any) {
        notify.error(`Failed to load diff: ${err.message}`);
    }
}

/*
|--------------------------------------------------------------------------
| Open Staged Changes vs HEAD Diff
|--------------------------------------------------------------------------
*/

export async function openStagedDiff(file: {
    path: string;
    relativePath?: string;
    fileName?: string;
    status?: string;
}) {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.git) return;

    const rel = file.relativePath || file.path.replace(ws, "").replace(/^[\\/]/, "").replace(/\\/g, "/");
    const name = file.fileName || file.path.split(/[\\/]/).pop() || rel;
    const status = file.status || "M";

    try {
        // 1. Get Staged Index content (modified)
        let modifiedContent = "";
        if (status !== "D") {
            const indexRes = await window.craftale.git.getFileContent(ws, "", rel);
            if (indexRes.success) {
                modifiedContent = indexRes.content;
            }
        }

        // 2. Get HEAD content (original)
        let originalContent = "";
        if (status !== "A") {
            const headRes = await window.craftale.git.getFileContent(ws, "HEAD", rel);
            if (headRes.success && headRes.exists) {
                originalContent = headRes.content;
            }
        }

        const target: DiffTarget = {
            id: `diff:staged:${rel}`,
            filePath: file.path,
            relativePath: rel,
            fileName: name,
            originalContent,
            modifiedContent,
            originalLabel: "HEAD",
            modifiedLabel: "Index (Staged)",
            language: getLanguageForFile(name),
            mode: "staged",
            baseRef: "HEAD",
            status,
            isStaged: true
        };

        activeDiff.set(target);
    } catch (err: any) {
        notify.error(`Failed to load staged diff: ${err.message}`);
    }
}

/*
|--------------------------------------------------------------------------
| Open Branch Comparison Diff
|--------------------------------------------------------------------------
*/

export async function openBranchFileDiff(
    baseBranch: string,
    compareBranch: string,
    relativePath: string,
    status = "M"
) {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.git) return;

    const normRel = relativePath.replace(/\\/g, "/");
    const fileName = normRel.split("/").pop() || normRel;
    const fullPath = `${ws}/${normRel}`.replace(/\\/g, "/");

    try {
        // 1. Get Base Branch content (original)
        let originalContent = "";
        if (status !== "A") {
            const baseRes = await window.craftale.git.getFileContent(ws, baseBranch, normRel);
            if (baseRes.success && baseRes.exists) {
                originalContent = baseRes.content;
            }
        }

        // 2. Get Compare Branch content (modified)
        let modifiedContent = "";
        if (status !== "D") {
            const cmpRes = await window.craftale.git.getFileContent(ws, compareBranch, normRel);
            if (cmpRes.success && cmpRes.exists) {
                modifiedContent = cmpRes.content;
            }
        }

        const target: DiffTarget = {
            id: `diff:branch:${baseBranch}:${compareBranch}:${normRel}`,
            filePath: fullPath,
            relativePath: normRel,
            fileName,
            originalContent,
            modifiedContent,
            originalLabel: baseBranch,
            modifiedLabel: compareBranch,
            language: getLanguageForFile(fileName),
            mode: "branch-compare",
            baseRef: baseBranch,
            targetRef: compareBranch,
            status,
            isStaged: false
        };

        activeDiff.set(target);
    } catch (err: any) {
        notify.error(`Failed to load branch diff: ${err.message}`);
    }
}

/*
|--------------------------------------------------------------------------
| Close Active Diff
|--------------------------------------------------------------------------
*/

export function closeDiff() {
    activeDiff.set(null);
}

/*
|--------------------------------------------------------------------------
| Toggle Inline Diff View
|--------------------------------------------------------------------------
*/

export function toggleInlineDiff() {
    isInlineDiff.update((v) => !v);
}

/*
|--------------------------------------------------------------------------
| Stage Selected Lines
|--------------------------------------------------------------------------
*/

export async function stageSelectedLines(
    diff: DiffTarget,
    selectedLineRange: { startLine: number; endLine: number }
): Promise<boolean> {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.git?.applyPatch) {
        notify.error("Git service not available");
        return false;
    }

    try {
        const origLines = diff.originalContent.split(/\r?\n/);
        const modLines = diff.modifiedContent.split(/\r?\n/);

        const startIdx = Math.max(0, selectedLineRange.startLine - 1);
        const endIdx = Math.min(modLines.length, selectedLineRange.endLine);

        if (startIdx >= endIdx) {
            notify.warning("No lines selected to stage");
            return false;
        }

        // Build unified diff hunk for the selected range
        // We construct a patch against index/HEAD
        const hunkLines: string[] = [];
        
        // Find corresponding line in original
        const origStartLine = Math.min(selectedLineRange.startLine, origLines.length + 1);
        const modStartLine = selectedLineRange.startLine;
        const modCount = endIdx - startIdx;

        for (let i = startIdx; i < endIdx; i++) {
            hunkLines.push(`+${modLines[i]}`);
        }

        const patchHeader = [
            `--- a/${diff.relativePath}`,
            `+++ b/${diff.relativePath}`,
            `@@ -${origStartLine},0 +${modStartLine},${modCount} @@`,
            ...hunkLines,
            ""
        ].join("\n");

        const res = await window.craftale.git.applyPatch(ws, patchHeader, true);

        if (res.success) {
            notify.info(`Staged lines ${selectedLineRange.startLine}-${selectedLineRange.endLine}`);
            await refreshGitStatus();
            // Refresh diff content
            await openWorkingTreeDiff({ path: diff.filePath, relativePath: diff.relativePath, status: diff.status });
            return true;
        } else {
            // Fallback: If partial hunk apply fails, stage file or report error
            notify.warning(`Could not apply partial patch: ${res.error || "Hunk overlap"}`);
            return false;
        }
    } catch (err: any) {
        notify.error(`Failed to stage selected lines: ${err.message}`);
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| Discard Selected Lines
|--------------------------------------------------------------------------
*/

export async function discardSelectedLines(
    diff: DiffTarget,
    selectedLineRange: { startLine: number; endLine: number }
): Promise<boolean> {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.filesystem) {
        notify.error("Filesystem service not available");
        return false;
    }

    try {
        const origLines = diff.originalContent.split(/\r?\n/);
        const modLines = diff.modifiedContent.split(/\r?\n/);

        const startIdx = Math.max(0, selectedLineRange.startLine - 1);
        const endIdx = Math.min(modLines.length, selectedLineRange.endLine);

        if (startIdx >= endIdx) {
            notify.warning("No lines selected to discard");
            return false;
        }

        // Replace the selected lines in modLines with corresponding lines from origLines
        const origLineSnippet = origLines.slice(startIdx, Math.min(origLines.length, startIdx + (endIdx - startIdx)));
        
        const newModLines = [
            ...modLines.slice(0, startIdx),
            ...origLineSnippet,
            ...modLines.slice(endIdx)
        ];

        const newContent = newModLines.join("\n");

        // Write updated content to disk
        await window.craftale.filesystem.writeFile(diff.filePath, newContent);
        updateFileContent(diff.filePath, newContent);

        notify.info(`Discarded changes for lines ${selectedLineRange.startLine}-${selectedLineRange.endLine}`);
        await refreshGitStatus();

        // Refresh diff target
        await openWorkingTreeDiff({ path: diff.filePath, relativePath: diff.relativePath, status: diff.status });
        return true;
    } catch (err: any) {
        notify.error(`Failed to discard selected lines: ${err.message}`);
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| Revert Entire File Changes
|--------------------------------------------------------------------------
*/

export async function revertEntireFile(diff: DiffTarget): Promise<boolean> {
    const ws = get(workspacePath);
    if (!ws || !window.craftale?.git?.discard) return false;

    try {
        const isUntracked = diff.status === "?";
        const res = await window.craftale.git.discard(ws, [diff.filePath], isUntracked);
        if (!res.success) {
            notify.error(`Revert failed: ${res.error || res.stderr}`);
            return false;
        }

        notify.info(`Reverted changes in "${diff.fileName}"`);
        await refreshGitStatus();
        closeDiff();
        return true;
    } catch (err: any) {
        notify.error(`Revert failed: ${err.message}`);
        return false;
    }
}
