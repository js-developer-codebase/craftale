import { writable, derived } from "svelte/store";

export interface LspServerInfo {
    id: string;
    name: string;
    languages: string[];
    status: "stopped" | "starting" | "ready" | "error";
    error?: string;
}

export interface DiagnosticItem {
    severity: "error" | "warning" | "info" | "hint";
    message: string;
    line: number;
    column: number;
    endLine?: number;
    endColumn?: number;
    source?: string;
    code?: string | number;
}

const INITIAL_SERVERS: Record<string, LspServerInfo> = {
    typescript: {
        id: "typescript",
        name: "TypeScript / JS",
        languages: ["typescript", "javascript", "jsx", "tsx"],
        status: "stopped"
    },
    html: {
        id: "html",
        name: "HTML",
        languages: ["html"],
        status: "stopped"
    },
    css: {
        id: "css",
        name: "CSS / SCSS",
        languages: ["css", "scss", "less"],
        status: "stopped"
    },
    json: {
        id: "json",
        name: "JSON",
        languages: ["json", "jsonc"],
        status: "stopped"
    },
    svelte: {
        id: "svelte",
        name: "Svelte",
        languages: ["svelte"],
        status: "stopped"
    }
};

export const lspServers = writable<Record<string, LspServerInfo>>(INITIAL_SERVERS);

export function updateServerStatus(serverId: string, status: "stopped" | "starting" | "ready" | "error", error?: string) {
    lspServers.update((servers) => {
        const existing = servers[serverId] || {
            id: serverId,
            name: serverId,
            languages: [],
            status
        };
        return {
            ...servers,
            [serverId]: {
                ...existing,
                status,
                error
            }
        };
    });
}

/*
|--------------------------------------------------------------------------
| Diagnostics Store
|--------------------------------------------------------------------------
|
| fileUri -> DiagnosticItem[]
|
*/

export const lspFileDiagnostics = writable<Record<string, DiagnosticItem[]>>({});

export function setFileDiagnostics(fileUri: string, items: DiagnosticItem[]) {
    lspFileDiagnostics.update((all) => {
        if (items.length === 0) {
            const copy = { ...all };
            delete copy[fileUri];
            return copy;
        }
        return {
            ...all,
            [fileUri]: items
        };
    });
}

export function clearFileDiagnostics(fileUri: string) {
    lspFileDiagnostics.update((all) => {
        const copy = { ...all };
        delete copy[fileUri];
        return copy;
    });
}

export const lspDiagnosticsSummary = derived(lspFileDiagnostics, ($diagnostics) => {
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let fileCount = 0;

    for (const items of Object.values($diagnostics)) {
        if (items.length > 0) {
            fileCount++;
            for (const item of items) {
                if (item.severity === "error") errorCount++;
                else if (item.severity === "warning") warningCount++;
                else infoCount++;
            }
        }
    }

    return { errorCount, warningCount, infoCount, fileCount };
});
