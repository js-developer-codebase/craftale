/*
|--------------------------------------------------------------------------
| Document Symbols Utility
|--------------------------------------------------------------------------
| Extracts symbols (classes, interfaces, functions, methods, variables,
| markdown headings, etc.) from source files across various languages
| for Quick Open (Go to Symbol), Breadcrumbs, and Sidebar Outline.
|--------------------------------------------------------------------------
*/

export type SymbolKind =
    | "class"
    | "interface"
    | "type"
    | "enum"
    | "function"
    | "method"
    | "constructor"
    | "variable"
    | "constant"
    | "property"
    | "heading"
    | "module";

export interface DocumentSymbolItem {
    id: string;
    name: string;
    kind: SymbolKind;
    containerName?: string;
    line: number;       // 1-based
    column: number;     // 1-based
    endLine: number;    // 1-based
    endColumn: number;  // 1-based
    children?: DocumentSymbolItem[];
    detail?: string;
}

/*
|--------------------------------------------------------------------------
| Symbol Display Meta
|--------------------------------------------------------------------------
*/

export function getSymbolKindLabel(kind: SymbolKind): string {

    switch (kind) {

        case "class": return "Classes";

        case "interface": return "Interfaces";

        case "type": return "Types";

        case "enum": return "Enums";

        case "function": return "Functions";

        case "method": return "Methods";

        case "constructor": return "Constructors";

        case "variable": return "Variables";

        case "constant": return "Constants";

        case "property": return "Properties";

        case "heading": return "Headings";

        case "module": return "Modules";

        default: return "Other";

    }

}

export function getSymbolIcon(kind: SymbolKind): { text: string; color: string; bg: string } {

    switch (kind) {

        case "class":
            return { text: "C", color: "#f59e0b", bg: "rgba(245, 158, 11, 0.15)" };

        case "interface":
            return { text: "I", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" };

        case "type":
            return { text: "T", color: "#a855f7", bg: "rgba(168, 85, 247, 0.15)" };

        case "enum":
            return { text: "E", color: "#fb923c", bg: "rgba(251, 146, 60, 0.15)" };

        case "function":
            return { text: "ƒ", color: "#a78bfa", bg: "rgba(167, 139, 250, 0.15)" };

        case "method":
            return { text: "m", color: "#60a5fa", bg: "rgba(96, 165, 250, 0.15)" };

        case "constructor":
            return { text: "c", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)" };

        case "variable":
            return { text: "v", color: "#38bdf8", bg: "rgba(56, 189, 248, 0.15)" };

        case "constant":
            return { text: "K", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" };

        case "property":
            return { text: "p", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };

        case "heading":
            return { text: "#", color: "#4ade80", bg: "rgba(74, 222, 128, 0.15)" };

        case "module":
            return { text: "M", color: "#f43f5e", bg: "rgba(244, 63, 94, 0.15)" };

        default:
            return { text: "•", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" };

    }

}

/*
|--------------------------------------------------------------------------
| Universal Parser
|--------------------------------------------------------------------------
*/

export function parseDocumentSymbols(content: string, fileName: string): DocumentSymbolItem[] {

    if (!content) return [];

    const ext = fileName.split(".").pop()?.toLowerCase() || "";

    const lines = content.split(/\r?\n/);


    if (ext === "md" || ext === "markdown") {

        return parseMarkdownSymbols(lines);

    }


    if (ext === "py") {

        return parsePythonSymbols(lines);

    }


    if (ext === "json") {

        return parseJsonSymbols(lines);

    }


    if (ext === "css" || ext === "scss" || ext === "less") {

        return parseCssSymbols(lines);

    }


    /* Default: JavaScript / TypeScript / Svelte / C / Go / Rust / Java */

    return parseJsTsSymbols(lines);

}

/*
|--------------------------------------------------------------------------
| JavaScript / TypeScript / Svelte Parser
|--------------------------------------------------------------------------
*/

function parseJsTsSymbols(lines: string[]): DocumentSymbolItem[] {

    const symbols: DocumentSymbolItem[] = [];

    let currentClass: string | null = null;

    let classBraceDepth = 0;

    let currentBraceDepth = 0;


    for (let i = 0; i < lines.length; i++) {

        const rawLine = lines[i];

        const lineNum = i + 1;

        const trimmed = rawLine.trim();


        /* Track brace depth */

        const openBraces = (rawLine.match(/\{/g) || []).length;

        const closeBraces = (rawLine.match(/\}/g) || []).length;

        currentBraceDepth += openBraces - closeBraces;


        if (currentClass && currentBraceDepth <= classBraceDepth) {

            currentClass = null;

        }


        /* Skip single line comments and empty lines */

        if (!trimmed || trimmed.startsWith("//") || trimmed.startsWith("/*") || trimmed.startsWith("*")) {

            continue;

        }


        /* Class: class Foo, export class Foo, abstract class Foo */

        const classMatch = rawLine.match(/(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);

        if (classMatch) {

            const name = classMatch[1];

            const col = rawLine.indexOf(name) + 1;

            currentClass = name;

            classBraceDepth = currentBraceDepth;

            symbols.push({
                id: `class-${name}-${lineNum}`,
                name,
                kind: "class",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }


        /* Interface: interface Foo, export interface Foo */

        const interfaceMatch = rawLine.match(/(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);

        if (interfaceMatch) {

            const name = interfaceMatch[1];

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `interface-${name}-${lineNum}`,
                name,
                kind: "interface",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }


        /* Type: type Foo =, export type Foo = */

        const typeMatch = rawLine.match(/(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*(?:<[^>]+>)?\s*=/);

        if (typeMatch) {

            const name = typeMatch[1];

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `type-${name}-${lineNum}`,
                name,
                kind: "type",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }


        /* Enum: enum Foo, export enum Foo */

        const enumMatch = rawLine.match(/(?:export\s+)?(?:const\s+)?enum\s+([A-Za-z0-9_$]+)/);

        if (enumMatch) {

            const name = enumMatch[1];

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `enum-${name}-${lineNum}`,
                name,
                kind: "enum",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }


        /* Function: function foo(...), export function foo(...) */

        const funcMatch = rawLine.match(/(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s*(\*?\s*[A-Za-z0-9_$]+)\s*\(/);

        if (funcMatch) {

            const name = funcMatch[1].replace(/^\*\s*/, "");

            if (name) {

                const col = rawLine.indexOf(name) + 1;

                symbols.push({
                    id: `fn-${name}-${lineNum}`,
                    name,
                    kind: "function",
                    containerName: currentClass ?? undefined,
                    line: lineNum,
                    column: Math.max(1, col),
                    endLine: lineNum,
                    endColumn: col + name.length,
                    detail: trimmed
                });

                continue;

            }

        }


        /* Method / Constructor in Class: constructor(...), public foo(...), async foo(...) */

        if (currentClass) {

            const methodMatch = rawLine.match(/(?:public|private|protected|static|async|\s)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^;{]+)?\s*\{/);

            if (methodMatch) {

                const name = methodMatch[1];

                if (name !== "if" && name !== "for" && name !== "while" && name !== "switch" && name !== "catch") {

                    const col = rawLine.indexOf(name) + 1;

                    symbols.push({
                        id: `method-${currentClass}-${name}-${lineNum}`,
                        name,
                        kind: name === "constructor" ? "constructor" : "method",
                        containerName: currentClass,
                        line: lineNum,
                        column: Math.max(1, col),
                        endLine: lineNum,
                        endColumn: col + name.length,
                        detail: trimmed
                    });

                    continue;

                }

            }

        }


        /* Arrow / Expression Function: const foo = (...) => or const foo = async (...) => */

        const arrowMatch = rawLine.match(/(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);

        if (arrowMatch) {

            const name = arrowMatch[1];

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `arrow-${name}-${lineNum}`,
                name,
                kind: "function",
                containerName: currentClass ?? undefined,
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }


        /* Constant / Variable: export const FOO = or const FOO = */

        const constMatch = rawLine.match(/(?:export\s+)?(const|let)\s+([A-Za-z0-9_$]+)\s*[:=]/);

        if (constMatch) {

            const isConst = constMatch[1] === "const";

            const name = constMatch[2];

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `var-${name}-${lineNum}`,
                name,
                kind: isConst ? "constant" : "variable",
                containerName: currentClass ?? undefined,
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }

    }

    return symbols;

}

/*
|--------------------------------------------------------------------------
| Python Parser
|--------------------------------------------------------------------------
*/

function parsePythonSymbols(lines: string[]): DocumentSymbolItem[] {

    const symbols: DocumentSymbolItem[] = [];

    let currentClass: string | null = null;

    let classIndent = 0;


    for (let i = 0; i < lines.length; i++) {

        const rawLine = lines[i];

        const lineNum = i + 1;

        const trimmed = rawLine.trim();


        if (!trimmed || trimmed.startsWith("#")) continue;

        const indent = rawLine.search(/\S/);


        if (currentClass && indent <= classIndent && !trimmed.startsWith("def ")) {

            currentClass = null;

        }


        const classMatch = rawLine.match(/^(\s*)class\s+([A-Za-z0-9_]+)/);

        if (classMatch) {

            classIndent = classMatch[1].length;

            currentClass = classMatch[2];

            const col = rawLine.indexOf(currentClass) + 1;

            symbols.push({
                id: `py-class-${currentClass}-${lineNum}`,
                name: currentClass,
                kind: "class",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + currentClass.length,
                detail: trimmed
            });

            continue;

        }


        const defMatch = rawLine.match(/^(\s*)(?:async\s+)?def\s+([A-Za-z0-9_]+)/);

        if (defMatch) {

            const name = defMatch[2];

            const col = rawLine.indexOf(name) + 1;

            const isMethod = currentClass !== null && defMatch[1].length > classIndent;

            symbols.push({
                id: `py-def-${name}-${lineNum}`,
                name,
                kind: isMethod ? "method" : "function",
                containerName: isMethod ? (currentClass ?? undefined) : undefined,
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: trimmed
            });

            continue;

        }

    }

    return symbols;

}

/*
|--------------------------------------------------------------------------
| Markdown Parser
|--------------------------------------------------------------------------
*/

function parseMarkdownSymbols(lines: string[]): DocumentSymbolItem[] {

    const symbols: DocumentSymbolItem[] = [];


    for (let i = 0; i < lines.length; i++) {

        const rawLine = lines[i];

        const lineNum = i + 1;

        const trimmed = rawLine.trim();


        const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

        if (headingMatch) {

            const level = headingMatch[1].length;

            const name = headingMatch[2].replace(/[#\s]+$/, "");

            const col = rawLine.indexOf(name) + 1;

            symbols.push({
                id: `md-h${level}-${name}-${lineNum}`,
                name: `${headingMatch[1]} ${name}`,
                kind: "heading",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length,
                detail: `Level ${level}`
            });

        }

    }

    return symbols;

}

/*
|--------------------------------------------------------------------------
| JSON Parser
|--------------------------------------------------------------------------
*/

function parseJsonSymbols(lines: string[]): DocumentSymbolItem[] {

    const symbols: DocumentSymbolItem[] = [];


    for (let i = 0; i < lines.length; i++) {

        const rawLine = lines[i];

        const lineNum = i + 1;

        const trimmed = rawLine.trim();


        const keyMatch = trimmed.match(/^"([^"]+)"\s*:/);

        if (keyMatch) {

            const name = keyMatch[1];

            const col = rawLine.indexOf(`"${name}"`) + 1;

            symbols.push({
                id: `json-${name}-${lineNum}`,
                name,
                kind: "property",
                line: lineNum,
                column: Math.max(1, col),
                endLine: lineNum,
                endColumn: col + name.length + 2,
                detail: trimmed
            });

        }

    }

    return symbols;

}

/*
|--------------------------------------------------------------------------
| CSS / SCSS Parser
|--------------------------------------------------------------------------
*/

function parseCssSymbols(lines: string[]): DocumentSymbolItem[] {

    const symbols: DocumentSymbolItem[] = [];


    for (let i = 0; i < lines.length; i++) {

        const rawLine = lines[i];

        const lineNum = i + 1;

        const trimmed = rawLine.trim();


        if (trimmed.endsWith("{") && !trimmed.startsWith("/*")) {

            const selector = trimmed.slice(0, -1).trim();

            if (selector) {

                symbols.push({
                    id: `css-${selector.slice(0, 20)}-${lineNum}`,
                    name: selector,
                    kind: selector.startsWith("@") ? "module" : "property",
                    line: lineNum,
                    column: Math.max(1, rawLine.indexOf(selector) + 1),
                    endLine: lineNum,
                    endColumn: rawLine.length,
                    detail: selector
                });

            }

        }

    }

    return symbols;

}

/*
|--------------------------------------------------------------------------
| Find Symbol Enclosing Cursor Line
|--------------------------------------------------------------------------
*/

export function findEnclosingSymbol(
    symbols: DocumentSymbolItem[],
    cursorLine: number
): DocumentSymbolItem | null {

    let candidate: DocumentSymbolItem | null = null;


    for (const sym of symbols) {

        if (sym.line <= cursorLine) {

            if (!candidate || sym.line > candidate.line) {

                candidate = sym;

            }

        }

    }

    return candidate;

}
