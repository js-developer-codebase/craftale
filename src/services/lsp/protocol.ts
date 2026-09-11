import * as monaco from "monaco-editor";

/*
|--------------------------------------------------------------------------
| Language & Server Mapping
|--------------------------------------------------------------------------
*/

export const EXTENSION_TO_LANGUAGE: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    mjs: "javascript",
    cjs: "javascript",
    json: "json",
    jsonc: "json",
    html: "html",
    htm: "html",
    css: "css",
    scss: "css",
    less: "css",
    svelte: "svelte"
};

export const LANGUAGE_TO_SERVER: Record<string, string> = {
    typescript: "typescript",
    javascript: "typescript",
    javascriptreact: "typescript",
    typescriptreact: "typescript",
    html: "html",
    css: "css",
    scss: "css",
    less: "css",
    json: "json",
    jsonc: "json",
    svelte: "svelte"
};

export const SUPPORTED_LANGUAGES = [
    "typescript",
    "javascript",
    "html",
    "css",
    "json",
    "svelte"
];

export function getLanguageIdFromPath(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    return EXTENSION_TO_LANGUAGE[ext] || "plaintext";
}

export function getServerIdFromLanguageId(languageId: string): string | null {
    return LANGUAGE_TO_SERVER[languageId] || null;
}

export function getServerIdForPath(filePath: string): string | null {
    const lang = getLanguageIdFromPath(filePath);
    return getServerIdFromLanguageId(lang);
}

/*
|--------------------------------------------------------------------------
| URI Conversions (Windows Safe & Monaco Compatible)
|--------------------------------------------------------------------------
*/

export function pathToUri(filePath: string): string {
    try {
        return monaco.Uri.file(filePath).toString();
    } catch {
        const normalized = filePath.replace(/\\/g, "/");
        return `file:///${normalized.startsWith("/") ? normalized.slice(1) : normalized}`;
    }
}

export function uriToPath(uriStr: string): string {
    try {
        const parsed = monaco.Uri.parse(uriStr);
        return parsed.fsPath || parsed.path;
    } catch {
        if (uriStr.startsWith("file:///")) {
            return decodeURIComponent(uriStr.replace(/^file:\/\/\//, ""));
        }
        return uriStr;
    }
}

/*
|--------------------------------------------------------------------------
| Position & Range Conversions
| (Monaco is 1-based, LSP is 0-based)
|--------------------------------------------------------------------------
*/

export interface LspPosition {
    line: number;
    character: number;
}

export interface LspRange {
    start: LspPosition;
    end: LspPosition;
}

export function toLspPosition(pos: monaco.IPosition): LspPosition {
    return {
        line: Math.max(0, pos.lineNumber - 1),
        character: Math.max(0, pos.column - 1)
    };
}

export function toMonacoPosition(pos: LspPosition): monaco.IPosition {
    return {
        lineNumber: pos.line + 1,
        column: pos.character + 1
    };
}

export function toLspRange(range: monaco.IRange): LspRange {
    return {
        start: {
            line: Math.max(0, range.startLineNumber - 1),
            character: Math.max(0, range.startColumn - 1)
        },
        end: {
            line: Math.max(0, range.endLineNumber - 1),
            character: Math.max(0, range.endColumn - 1)
        }
    };
}

export function toMonacoRange(range: LspRange): monaco.Range {
    return new monaco.Range(
        range.start.line + 1,
        range.start.character + 1,
        range.end.line + 1,
        range.end.character + 1
    );
}
