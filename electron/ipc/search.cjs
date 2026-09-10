const { ipcMain } = require("electron");
const fs = require("fs/promises");
const fsSync = require("fs");
const path = require("path");

/*
|--------------------------------------------------------------------------
| Common Ignored Directories & Binary Extensions
|--------------------------------------------------------------------------
*/

const DEFAULT_IGNORED_DIRS = new Set([
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
    ".cache",
    ".output",
    "coverage"
]);

const BINARY_EXTENSIONS = new Set([
    "png", "jpg", "jpeg", "gif", "bmp", "ico", "webp", "tiff", "psd",
    "woff", "woff2", "ttf", "eot", "otf",
    "zip", "tar", "gz", "7z", "rar", "bz2", "xz",
    "exe", "dll", "so", "dylib", "bin", "iso", "dmg",
    "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
    "mp3", "mp4", "mov", "avi", "mkv", "webm", "wav", "flac", "ogg",
    "pyc", "class", "wasm", "node", "lockb"
]);

/*
|--------------------------------------------------------------------------
| Helper: Convert User Glob to RegExp
|--------------------------------------------------------------------------
*/

function patternToRegex(pattern) {
    let clean = pattern.trim().replace(/\\/g, "/");
    if (clean.startsWith("./")) clean = clean.slice(2);
    if (!clean) return null;

    let escaped = clean
        .replace(/[.+^${}()|[\]\\]/g, "\\$&")
        .replace(/\*\*/g, ".*")
        .replace(/(?<!\.)\*/g, "[^/]*")
        .replace(/\?/g, ".");

    return new RegExp(`(^|/)${escaped}($|/)`, "i");
}

function compilePatterns(commaSeparated) {
    if (!commaSeparated || !commaSeparated.trim()) return [];
    return commaSeparated
        .split(",")
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => patternToRegex(p))
        .filter(Boolean);
}

function matchesAnyPattern(targetPath, regexList) {
    const normalized = targetPath.replace(/\\/g, "/");
    return regexList.some(r => r.test(normalized));
}

/*
|--------------------------------------------------------------------------
| Helper: Binary File Check
|--------------------------------------------------------------------------
*/

async function isBinaryFile(filePath, ext) {
    if (BINARY_EXTENSIONS.has(ext)) {
        return true;
    }

    try {
        const handle = await fs.open(filePath, "r");
        const buf = Buffer.alloc(512);
        const { bytesRead } = await handle.read(buf, 0, 512, 0);
        await handle.close();

        for (let i = 0; i < bytesRead; i++) {
            if (buf[i] === 0) {
                return true;
            }
        }
        return false;
    } catch {
        return false;
    }
}

/*
|--------------------------------------------------------------------------
| Helper: Build Search Regex
|--------------------------------------------------------------------------
*/

function buildSearchRegex(query, isRegex, isCaseSensitive, matchWholeWord) {
    let pattern;
    if (isRegex) {
        pattern = query;
    } else {
        pattern = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    if (matchWholeWord) {
        pattern = `\\b(?:${pattern})\\b`;
    }

    const flags = isCaseSensitive ? "g" : "gi";
    return new RegExp(pattern, flags);
}

/*
|--------------------------------------------------------------------------
| Helper: Recursively Scan & Search Files
|--------------------------------------------------------------------------
*/

async function searchDirectory(
    dir,
    workspacePath,
    searchRegex,
    includeRegexes,
    excludeRegexes,
    maxResults,
    state
) {
    if (state.totalMatches >= maxResults) return;

    let entries;
    try {
        entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
        return;
    }

    for (const entry of entries) {
        if (state.totalMatches >= maxResults) break;

        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, "/");

        if (entry.isDirectory()) {
            if (DEFAULT_IGNORED_DIRS.has(entry.name) || entry.name.startsWith(".")) {
                continue;
            }
            if (excludeRegexes.length > 0 && matchesAnyPattern(relativePath, excludeRegexes)) {
                continue;
            }
            await searchDirectory(
                fullPath,
                workspacePath,
                searchRegex,
                includeRegexes,
                excludeRegexes,
                maxResults,
                state
            );
        } else if (entry.isFile()) {
            if (excludeRegexes.length > 0 && matchesAnyPattern(relativePath, excludeRegexes)) {
                continue;
            }
            if (includeRegexes.length > 0 && !matchesAnyPattern(relativePath, includeRegexes)) {
                continue;
            }

            const ext = path.extname(entry.name).toLowerCase().replace(/^\./, "");
            const binary = await isBinaryFile(fullPath, ext);
            if (binary) continue;

            try {
                const content = await fs.readFile(fullPath, "utf-8");
                searchRegex.lastIndex = 0;
                if (!searchRegex.test(content)) continue;

                /* Line by line scan */
                const lines = content.split(/\r?\n/);
                const fileMatches = [];

                for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
                    if (state.totalMatches >= maxResults) {
                        state.truncated = true;
                        break;
                    }

                    const lineText = lines[lineIndex];
                    searchRegex.lastIndex = 0;
                    let match;

                    while ((match = searchRegex.exec(lineText)) !== null) {
                        const matchLength = match[0].length;
                        const matchStart = match.index;
                        const colNumber = matchStart + 1;

                        const snippetStart = Math.max(0, matchStart - 40);
                        const snippetEnd = Math.min(lineText.length, matchStart + matchLength + 60);

                        fileMatches.push({
                            lineNumber: lineIndex + 1,
                            column: colNumber,
                            length: matchLength,
                            lineText: lineText.trimEnd(),
                            preview: {
                                before: lineText.slice(snippetStart, matchStart),
                                match: match[0],
                                after: lineText.slice(matchStart + matchLength, snippetEnd)
                            }
                        });

                        state.totalMatches++;

                        if (matchLength === 0) {
                            searchRegex.lastIndex++;
                        }

                        if (state.totalMatches >= maxResults) {
                            state.truncated = true;
                            break;
                        }
                    }
                }

                if (fileMatches.length > 0) {
                    state.results.push({
                        path: fullPath,
                        relativePath,
                        fileName: entry.name,
                        matches: fileMatches
                    });
                }
            } catch {
                /* Skip unreadable files */
            }
        }
    }
}

/*
|--------------------------------------------------------------------------
| IPC: Search Workspace
|--------------------------------------------------------------------------
*/

ipcMain.handle("search:workspace", async (event, workspacePath, options = {}) => {
    const startTime = Date.now();
    const {
        query = "",
        isRegex = false,
        isCaseSensitive = false,
        matchWholeWord = false,
        includePattern = "",
        excludePattern = "",
        maxResults = 5000
    } = options;

    if (!workspacePath || !query.trim()) {
        return {
            results: [],
            totalMatches: 0,
            totalFiles: 0,
            durationMs: 0,
            truncated: false
        };
    }

    let searchRegex;
    try {
        searchRegex = buildSearchRegex(query, isRegex, isCaseSensitive, matchWholeWord);
    } catch (err) {
        return {
            error: `Invalid regular expression: ${err.message}`,
            results: [],
            totalMatches: 0,
            totalFiles: 0,
            durationMs: 0,
            truncated: false
        };
    }

    const includeRegexes = compilePatterns(includePattern);
    const excludeRegexes = compilePatterns(excludePattern);

    const state = {
        results: [],
        totalMatches: 0,
        truncated: false
    };

    await searchDirectory(
        workspacePath,
        workspacePath,
        searchRegex,
        includeRegexes,
        excludeRegexes,
        maxResults,
        state
    );

    const durationMs = Date.now() - startTime;

    return {
        results: state.results,
        totalMatches: state.totalMatches,
        totalFiles: state.results.length,
        durationMs,
        truncated: state.truncated
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Replace In File
|--------------------------------------------------------------------------
*/

ipcMain.handle("search:replace-in-file", async (event, filePath, options = {}) => {
    const {
        query,
        replacement = "",
        isRegex = false,
        isCaseSensitive = false,
        matchWholeWord = false,
        lineNumber = null,
        column = null
    } = options;

    if (!filePath || !query) {
        return { success: false, error: "Missing filePath or query" };
    }

    try {
        const content = await fs.readFile(filePath, "utf-8");
        const searchRegex = buildSearchRegex(query, isRegex, isCaseSensitive, matchWholeWord);

        let newContent;

        if (lineNumber != null && column != null) {
            /* Replace single specific occurrence */
            const lines = content.split(/\r?\n/);
            const lineIdx = lineNumber - 1;
            if (lineIdx >= 0 && lineIdx < lines.length) {
                const line = lines[lineIdx];
                const colIdx = column - 1;
                searchRegex.lastIndex = 0;
                let found = false;
                let m;
                while ((m = searchRegex.exec(line)) !== null) {
                    if (m.index === colIdx) {
                        const before = line.slice(0, colIdx);
                        const after = line.slice(colIdx + m[0].length);
                        lines[lineIdx] = before + replacement + after;
                        found = true;
                        break;
                    }
                    if (m[0].length === 0) searchRegex.lastIndex++;
                }
                if (found) {
                    newContent = lines.join("\n");
                } else {
                    return { success: false, error: "Occurrence not found at target position" };
                }
            } else {
                return { success: false, error: "Target line number out of range" };
            }
        } else {
            /* Replace all occurrences in this file */
            newContent = content.replace(searchRegex, replacement);
        }

        await fs.writeFile(filePath, newContent, "utf-8");
        return { success: true, filePath, newContent };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

/*
|--------------------------------------------------------------------------
| IPC: Replace Across Workspace
|--------------------------------------------------------------------------
*/

ipcMain.handle("search:replace-workspace", async (event, workspacePath, options = {}) => {
    const {
        query,
        replacement = "",
        isRegex = false,
        isCaseSensitive = false,
        matchWholeWord = false,
        filePaths = []
    } = options;

    if (!query || !Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: false, totalModifiedFiles: 0, totalReplacements: 0 };
    }

    let searchRegex;
    try {
        searchRegex = buildSearchRegex(query, isRegex, isCaseSensitive, matchWholeWord);
    } catch (err) {
        return { success: false, error: err.message };
    }

    let totalModifiedFiles = 0;
    let totalReplacements = 0;
    const modifiedFiles = [];

    for (const filePath of filePaths) {
        try {
            const content = await fs.readFile(filePath, "utf-8");
            searchRegex.lastIndex = 0;
            const matches = content.match(searchRegex);
            if (matches && matches.length > 0) {
                const count = matches.length;
                searchRegex.lastIndex = 0;
                const newContent = content.replace(searchRegex, replacement);
                await fs.writeFile(filePath, newContent, "utf-8");

                totalModifiedFiles++;
                totalReplacements += count;
                modifiedFiles.push({ filePath, newContent });
            }
        } catch (err) {
            console.warn("[SEARCH] Failed to replace in file:", filePath, err.message);
        }
    }

    return {
        success: true,
        totalModifiedFiles,
        totalReplacements,
        modifiedFiles
    };
});

module.exports = {};
