import { writable, derived, get } from "svelte/store";
import { uriToPath, pathToUri } from "../services/lsp/protocol";

export type DiagnosticSeverity = "error" | "warning" | "info" | "hint";
export type DiagnosticSourceType = "lsp" | "compiler";

export interface ProblemItem {
    id: string;
    severity: DiagnosticSeverity;
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    source?: string;
    sourceType: DiagnosticSourceType;
    code?: string | number;
    fileUri: string;
    filePath: string;
    fileName: string;
}

export interface ProblemFilterOptions {
    query: string;
    showErrors: boolean;
    showWarnings: boolean;
    showInfos: boolean;
    sourceType: "all" | "lsp" | "compiler";
}

/*
|--------------------------------------------------------------------------
| Problems Stores
|--------------------------------------------------------------------------
*/

export const problemsList = writable<ProblemItem[]>([]);

export const problemsFilter = writable<ProblemFilterOptions>({
    query: "",
    showErrors: true,
    showWarnings: true,
    showInfos: true,
    sourceType: "all"
});

export const isCheckingWorkspace = writable<boolean>(false);

/*
|--------------------------------------------------------------------------
| Derived Stores
|--------------------------------------------------------------------------
*/

export const problemsSummary = derived(problemsList, ($problems) => {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    const uniqueFiles = new Set<string>();

    for (const item of $problems) {
        uniqueFiles.add(item.filePath.toLowerCase());
        if (item.severity === "error") {
            errorCount++;
        } else if (item.severity === "warning") {
            warningCount++;
        } else {
            infoCount++;
        }
    }

    return {
        errorCount,
        warningCount,
        infoCount,
        totalCount: $problems.length,
        fileCount: uniqueFiles.size
    };
});

export interface FileProblemsGroup {
    filePath: string;
    fileName: string;
    fileUri: string;
    errorCount: number;
    warningCount: number;
    infoCount: number;
    problems: ProblemItem[];
}

export const filteredProblemsByFile = derived(
    [problemsList, problemsFilter],
    ([$problems, $filter]) => {
        const queryLower = ($filter.query || "").trim().toLowerCase();

        // 1. Filter problems
        const matching = $problems.filter((item) => {
            // Severity filter
            if (item.severity === "error" && !$filter.showErrors) return false;
            if (item.severity === "warning" && !$filter.showWarnings) return false;
            if ((item.severity === "info" || item.severity === "hint") && !$filter.showInfos) return false;

            // Source type filter
            if ($filter.sourceType !== "all" && item.sourceType !== $filter.sourceType) {
                return false;
            }

            // Query text filter
            if (queryLower) {
                const matchMsg = item.message.toLowerCase().includes(queryLower);
                const matchFile = item.fileName.toLowerCase().includes(queryLower);
                const matchPath = item.filePath.toLowerCase().includes(queryLower);
                const matchSource = (item.source || "").toLowerCase().includes(queryLower);
                const matchCode = String(item.code || "").toLowerCase().includes(queryLower);
                if (!matchMsg && !matchFile && !matchPath && !matchSource && !matchCode) {
                    return false;
                }
            }

            return true;
        });

        // 2. Group by file
        const groups = new Map<string, FileProblemsGroup>();

        for (const item of matching) {
            const key = item.filePath.toLowerCase();
            let group = groups.get(key);
            if (!group) {
                group = {
                    filePath: item.filePath,
                    fileName: item.fileName,
                    fileUri: item.fileUri,
                    errorCount: 0,
                    warningCount: 0,
                    infoCount: 0,
                    problems: []
                };
                groups.set(key, group);
            }

            if (item.severity === "error") group.errorCount++;
            else if (item.severity === "warning") group.warningCount++;
            else group.infoCount++;

            group.problems.push(item);
        }

        // 3. Sort problems within each file by line and column
        for (const group of groups.values()) {
            group.problems.sort((a, b) => {
                if (a.line !== b.line) return a.line - b.line;
                return a.column - b.column;
            });
        }

        // 4. Sort groups alphabetically by file name
        return Array.from(groups.values()).sort((a, b) =>
            a.fileName.localeCompare(b.fileName)
        );
    }
);

/*
|--------------------------------------------------------------------------
| Actions
|--------------------------------------------------------------------------
*/

let idCounter = 1;

export function setLspFileProblems(
    fileUri: string,
    rawItems: Array<{
        severity: DiagnosticSeverity;
        message: string;
        line: number;
        column: number;
        endLine?: number;
        endColumn?: number;
        source?: string;
        code?: string | number;
    }>
) {
    const filePath = uriToPath(fileUri);
    const fileName = filePath.split(/[\\/]/).pop() || filePath;
    const normalizedKey = filePath.toLowerCase();

    const newProblems: ProblemItem[] = rawItems.map((raw) => ({
        id: `lsp-${idCounter++}-${Date.now()}`,
        severity: raw.severity,
        message: raw.message,
        line: raw.line,
        column: raw.column,
        endLine: raw.endLine,
        endColumn: raw.endColumn,
        source: raw.source || "LSP",
        sourceType: "lsp",
        code: raw.code,
        fileUri,
        filePath,
        fileName
    }));

    problemsList.update((all) => {
        // Remove previous LSP problems for this file, keep compiler problems and other files
        const filtered = all.filter(
            (p) => !(p.sourceType === "lsp" && p.filePath.toLowerCase() === normalizedKey)
        );
        return [...filtered, ...newProblems];
    });
}

export function setCompilerProblems(items: ProblemItem[]) {
    problemsList.update((all) => {
        // Remove existing compiler problems, keep LSP problems
        const lspOnly = all.filter((p) => p.sourceType === "lsp");
        return [...lspOnly, ...items];
    });
}

export function clearFileProblems(filePath: string) {
    const key = filePath.toLowerCase();
    problemsList.update((all) => all.filter((p) => p.filePath.toLowerCase() !== key));
}

export function clearCompilerProblems() {
    problemsList.update((all) => all.filter((p) => p.sourceType !== "compiler"));
}

export function clearAllProblems() {
    problemsList.set([]);
}

/*
|--------------------------------------------------------------------------
| Run Workspace Type & Build Check
|--------------------------------------------------------------------------
*/

export async function runWorkspaceCheck(workspacePath: string | null) {
    if (!workspacePath) return;
    if (get(isCheckingWorkspace)) return;

    isCheckingWorkspace.set(true);
    try {
        if (!window.craftale?.compiler) {
            console.warn("[Problems] craftale.compiler API not available");
            return;
        }

        const res = await window.craftale.compiler.runCheck(workspacePath);
        if (res && res.problems) {
            const compilerProblems: ProblemItem[] = res.problems.map((p) => ({
                id: `comp-${idCounter++}-${Date.now()}`,
                severity: p.severity,
                message: p.message,
                line: p.line || 1,
                column: p.column || 1,
                source: p.source || "compiler",
                sourceType: "compiler",
                code: p.code,
                fileUri: pathToUri(p.filePath),
                filePath: p.filePath,
                fileName: p.filePath.split(/[\\/]/).pop() || p.filePath
            }));

            setCompilerProblems(compilerProblems);
        }
    } catch (err) {
        console.error("[Problems] Failed to run compiler check:", err);
    } finally {
        isCheckingWorkspace.set(false);
    }
}
