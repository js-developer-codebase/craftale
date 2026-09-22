/*
|--------------------------------------------------------------------------
| Git Conflict Parser Utility
|--------------------------------------------------------------------------
| Detects and parses standard and diff3 Git conflict markers (<<<<<<<, =======, >>>>>>>)
| and provides resolution utilities.
|--------------------------------------------------------------------------
*/

export interface ConflictBlock {
    id: string;
    startLine: number; // 1-indexed, line of <<<<<<<
    middleLine: number; // 1-indexed, line of =======
    endLine: number; // 1-indexed, line of >>>>>>>
    baseLine?: number; // 1-indexed, line of ||||||| if diff3
    currentLabel: string;
    incomingLabel: string;
    baseLabel?: string;
    currentContent: string;
    incomingContent: string;
    baseContent?: string;
    fullMatch: string;
}

export type ConflictResolutionChoice = "current" | "incoming" | "both";

/**
 * Parses all conflict marker blocks in a document.
 */
export function parseConflicts(text: string): ConflictBlock[] {
    if (!text || !text.includes("<<<<<<<")) {
        return [];
    }

    const lines = text.split(/\r?\n/);
    const blocks: ConflictBlock[] = [];
    let i = 0;
    let blockCounter = 0;

    while (i < lines.length) {
        const line = lines[i];
        if (line.startsWith("<<<<<<<")) {
            const startLine = i + 1;
            const currentLabel = line.replace(/^<{7}\s*/, "").trim() || "Current Change (HEAD)";
            let middleLine = -1;
            let baseLine = -1;
            let endLine = -1;
            let baseLabel = "";
            let incomingLabel = "";

            const currentLines: string[] = [];
            const baseLines: string[] = [];
            const incomingLines: string[] = [];

            let mode: "current" | "base" | "incoming" = "current";

            let j = i + 1;
            while (j < lines.length) {
                const inner = lines[j];
                if (inner.startsWith("|||||||")) {
                    baseLine = j + 1;
                    baseLabel = inner.replace(/^\|{7}\s*/, "").trim() || "Base";
                    mode = "base";
                } else if (inner.startsWith("=======")) {
                    middleLine = j + 1;
                    mode = "incoming";
                } else if (inner.startsWith(">>>>>>>")) {
                    endLine = j + 1;
                    incomingLabel = inner.replace(/^>{7}\s*/, "").trim() || "Incoming Change";
                    break;
                } else {
                    if (mode === "current") {
                        currentLines.push(inner);
                    } else if (mode === "base") {
                        baseLines.push(inner);
                    } else if (mode === "incoming") {
                        incomingLines.push(inner);
                    }
                }
                j++;
            }

            if (middleLine !== -1 && endLine !== -1) {
                const fullMatch = lines.slice(i, j + 1).join("\n");
                blocks.push({
                    id: `conflict-${++blockCounter}-${startLine}`,
                    startLine,
                    middleLine,
                    endLine,
                    baseLine: baseLine !== -1 ? baseLine : undefined,
                    currentLabel,
                    incomingLabel,
                    baseLabel: baseLabel || undefined,
                    currentContent: currentLines.join("\n"),
                    incomingContent: incomingLines.join("\n"),
                    baseContent: baseLines.length > 0 ? baseLines.join("\n") : undefined,
                    fullMatch
                });
                i = j + 1;
                continue;
            }
        }
        i++;
    }

    return blocks;
}

/**
 * Replaces a single conflict block in the document with the chosen resolution.
 */
export function resolveConflict(
    text: string,
    block: ConflictBlock,
    choice: ConflictResolutionChoice
): string {
    const lines = text.split(/\r?\n/);
    const startIdx = block.startLine - 1;
    const endIdx = block.endLine; // slice end (exclusive)

    let replacement: string[];
    if (choice === "current") {
        replacement = block.currentContent.length > 0 ? block.currentContent.split(/\r?\n/) : [];
    } else if (choice === "incoming") {
        replacement = block.incomingContent.length > 0 ? block.incomingContent.split(/\r?\n/) : [];
    } else {
        // both
        const c = block.currentContent.length > 0 ? block.currentContent.split(/\r?\n/) : [];
        const i = block.incomingContent.length > 0 ? block.incomingContent.split(/\r?\n/) : [];
        replacement = [...c, ...i];
    }

    const newLines = [
        ...lines.slice(0, startIdx),
        ...replacement,
        ...lines.slice(endIdx)
    ];

    return newLines.join("\n");
}
