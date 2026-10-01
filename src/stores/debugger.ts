/*
|--------------------------------------------------------------------------
| Debugger State Management Store
|--------------------------------------------------------------------------
| Manages active debug sessions, breakpoints, paused call frames,
| scopes, variable inspection trees, watch expressions, and debug console logs.
|--------------------------------------------------------------------------
*/

import { writable, derived, get } from "svelte/store";
import { requestJump, openSidebarView } from "./navigation";
import { activeFile, workspacePath } from "./workspace";
import { notify } from "./notifications";

export type DebugSessionStatus = "inactive" | "launching" | "running" | "paused" | "stopped";

export interface DebugScope {
    type: string; // 'local' | 'closure' | 'global' | 'catch' | 'block'
    name: string;
    objectId?: string;
    description?: string;
}

export interface DebugCallFrame {
    id: string;
    index: number;
    functionName: string;
    url: string;
    filePath: string;
    fileName: string;
    lineNumber: number; // 1-indexed
    columnNumber: number; // 1-indexed
    scopeChain: DebugScope[];
    thisObj?: any;
}

export interface DebugVariable {
    name: string;
    value: string;
    type?: string;
    subtype?: string;
    objectId?: string;
    hasChildren?: boolean;
    children?: DebugVariable[];
    isExpanded?: boolean;
    isLoading?: boolean;
}

export interface DebugWatchExpression {
    id: string;
    expression: string;
    value?: string;
    type?: string;
    error?: boolean;
}

export interface DebugConsoleLog {
    id: string;
    type: "stdout" | "stderr" | "log" | "warn" | "error" | "info" | "result";
    text: string;
    timestamp: number;
}

export interface BreakpointItem {
    filePath: string;
    fileName: string;
    line: number;
    enabled: boolean;
}

/*
|--------------------------------------------------------------------------
| Core Stores
|--------------------------------------------------------------------------
*/

export const debugStatus = writable<DebugSessionStatus>("inactive");
export const activePort = writable<number | null>(null);
export const activeProgram = writable<string | null>(null);

// Breakpoints: Map<filePath, Set<lineNumber>>
export const breakpoints = writable<Map<string, Set<number>>>(new Map());

// Derived flat list of breakpoints for UI
export const allBreakpoints = derived(breakpoints, ($bps) => {
    const list: BreakpointItem[] = [];
    for (const [filePath, lines] of $bps.entries()) {
        const parts = filePath.replace(/\\/g, "/").split("/");
        const fileName = parts[parts.length - 1] || filePath;
        for (const line of Array.from(lines).sort((a, b) => a - b)) {
            list.push({
                filePath,
                fileName,
                line,
                enabled: true
            });
        }
    }
    return list;
});

// Call stack frames
export const callFrames = writable<DebugCallFrame[]>([]);
export const selectedFrameIndex = writable<number>(0);

export const selectedFrame = derived(
    [callFrames, selectedFrameIndex],
    ([$frames, $idx]) => $frames[$idx] || null
);

// Scopes & Variables for selected frame: Map<scopeName, DebugVariable[]>
export const scopeVariables = writable<Map<string, DebugVariable[]>>(new Map());

// Watch expressions
export const watchExpressions = writable<DebugWatchExpression[]>([]);

// Console logs
export const debugLogs = writable<DebugConsoleLog[]>([]);

// Active execution location when paused
export const activeExecutionLocation = derived(selectedFrame, ($frame) => {
    if (!$frame || !$frame.filePath) return null;
    return {
        filePath: $frame.filePath,
        line: $frame.lineNumber,
        column: $frame.columnNumber
    };
});

let isIpcListenerRegistered = false;
let nextLogId = 1;
let nextWatchId = 1;

/*
|--------------------------------------------------------------------------
| Initialize Debugger IPC Event Subscriptions
|--------------------------------------------------------------------------
*/

export function initializeDebuggerEvents() {
    if (isIpcListenerRegistered || !window.craftale?.debugger) return;
    isIpcListenerRegistered = true;

    // Sync any existing breakpoints to backend immediately
    void syncBreakpointsToBackend();

    window.craftale.debugger.onEvent(async (event) => {
        switch (event.type) {
            case "started": {
                debugStatus.set("running");
                appendDebugLog("info", `Debugger attached to process (${event.wsUrl || ""})`);
                break;
            }

            case "paused": {
                clearHoverCache();
                debugStatus.set("paused");
                const frames = (event.callFrames || []) as DebugCallFrame[];
                callFrames.set(frames);
                selectedFrameIndex.set(0);

                // Reveal debug sidebar
                openSidebarView("debug");

                if (frames.length > 0) {
                    const top = frames[0];
                    // Jump editor to paused location
                    if (top.filePath && top.lineNumber > 0) {
                        requestJump(top.lineNumber, top.columnNumber || 1, top.filePath);
                    }
                    // Fetch variables for top frame
                    void fetchScopeVariables(top);
                    // Update watch expressions
                    void refreshWatchExpressions(top.id);
                }
                break;
            }

            case "resumed": {
                clearHoverCache();
                debugStatus.set("running");
                callFrames.set([]);
                scopeVariables.set(new Map());
                break;
            }

            case "stdout": {
                if (event.text) {
                    appendDebugLog("stdout", event.text);
                }
                break;
            }

            case "stderr": {
                if (event.text) {
                    appendDebugLog("stderr", event.text);
                }
                break;
            }

            case "console": {
                appendDebugLog(event.logType || "log", event.text || "");
                break;
            }

            case "exception": {
                appendDebugLog("error", `⚠️ ${event.text} (line ${event.lineNumber})`);
                break;
            }

            case "stopped": {
                clearHoverCache();
                debugStatus.set("inactive");
                activePort.set(null);
                callFrames.set([]);
                scopeVariables.set(new Map());
                appendDebugLog("info", "Debug session terminated.");
                break;
            }

            case "error": {
                appendDebugLog("error", `[Debugger Error] ${event.message}`);
                notify.error(`Debugger error: ${event.message}`);
                break;
            }
        }
    });
}

function appendDebugLog(type: DebugConsoleLog["type"], text: string) {
    debugLogs.update((logs) => [
        ...logs,
        {
            id: `log-${nextLogId++}`,
            type,
            text,
            timestamp: Date.now()
        }
    ]);
}

/*
|--------------------------------------------------------------------------
| Breakpoints Management
|--------------------------------------------------------------------------
*/

export function toggleBreakpoint(filePath: string, line: number) {
    if (!filePath || line < 1) return;

    breakpoints.update((map) => {
        const next = new Map(map);
        const set = new Set(next.get(filePath) || []);
        if (set.has(line)) {
            set.delete(line);
            if (set.size === 0) {
                next.delete(filePath);
            } else {
                next.set(filePath, set);
            }
        } else {
            set.add(line);
            next.set(filePath, set);
        }
        return next;
    });

    void syncBreakpointsToBackend();
}

export function removeBreakpoint(filePath: string, line: number) {
    breakpoints.update((map) => {
        const next = new Map(map);
        const set = new Set(next.get(filePath) || []);
        set.delete(line);
        if (set.size === 0) {
            next.delete(filePath);
        } else {
            next.set(filePath, set);
        }
        return next;
    });

    void syncBreakpointsToBackend();
}

export function clearAllBreakpoints() {
    breakpoints.set(new Map());
    void syncBreakpointsToBackend();
}

function getSerializableBreakpoints(): Record<string, number[]> {
    const map = get(breakpoints);
    const obj: Record<string, number[]> = {};
    for (const [file, lines] of map.entries()) {
        obj[file] = Array.from(lines);
    }
    return obj;
}

async function syncBreakpointsToBackend() {
    if (window.craftale?.debugger) {
        await window.craftale.debugger.setBreakpoints(getSerializableBreakpoints());
    }
}

/*
|--------------------------------------------------------------------------
| Debug Control Actions
|--------------------------------------------------------------------------
*/

export async function startDebugging(targetPath?: string, options: { stopOnEntry?: boolean } = {}) {
    initializeDebuggerEvents();

    let programPath = targetPath;
    if (!programPath) {
        const file = get(activeFile);
        if (file && (file.name.endsWith(".js") || file.name.endsWith(".ts") || file.name.endsWith(".mjs") || file.name.endsWith(".cjs"))) {
            programPath = file.path;
        }
    }

    if (!programPath) {
        notify.warning("Please open or select a JavaScript or TypeScript file to debug.");
        return;
    }

    debugStatus.set("launching");
    activeProgram.set(programPath);
    appendDebugLog("info", `Launching debugger for: ${programPath}`);

    try {
        const res = await window.craftale.debugger.start({
            programPath,
            cwd: get(workspacePath) || undefined,
            stopOnEntry: options.stopOnEntry ?? false,
            breakpoints: getSerializableBreakpoints()
        });

        if (res.success) {
            debugStatus.set("running");
            activePort.set(res.port ?? null);
            appendDebugLog("info", `Debugger connected on port ${res.port} (PID: ${res.pid})`);
        } else {
            debugStatus.set("inactive");
            appendDebugLog("error", `Failed to start debugger: ${res.error}`);
            notify.error(`Failed to start debugger: ${res.error}`);
        }
    } catch (e: any) {
        debugStatus.set("inactive");
        appendDebugLog("error", `Exception starting debugger: ${e.message}`);
        notify.error(`Exception starting debugger: ${e.message}`);
    }
}

export async function attachDebugging(host = "127.0.0.1", port = 9229) {
    initializeDebuggerEvents();
    debugStatus.set("launching");
    appendDebugLog("info", `Attaching debugger to ${host}:${port}...`);

    try {
        const res = await window.craftale.debugger.attach(host, port);
        if (res.success) {
            debugStatus.set("running");
            activePort.set(port);
            appendDebugLog("info", `Attached to debugger on ${host}:${port}`);
            await syncBreakpointsToBackend();
        } else {
            debugStatus.set("inactive");
            appendDebugLog("error", `Attach failed: ${res.error}`);
            notify.error(`Attach failed: ${res.error}`);
        }
    } catch (e: any) {
        debugStatus.set("inactive");
        appendDebugLog("error", `Attach error: ${e.message}`);
        notify.error(`Attach error: ${e.message}`);
    }
}

export async function stopDebugging() {
    if (!window.craftale?.debugger) return;
    await window.craftale.debugger.stop();
    debugStatus.set("inactive");
    activePort.set(null);
    callFrames.set([]);
    scopeVariables.set(new Map());
}

export async function resumeDebugging() {
    if (get(debugStatus) !== "paused" || !window.craftale?.debugger) return;
    await window.craftale.debugger.resume();
}

export async function pauseDebugging() {
    if (get(debugStatus) !== "running" || !window.craftale?.debugger) return;
    await window.craftale.debugger.pause();
}

export async function stepOver() {
    if (get(debugStatus) !== "paused" || !window.craftale?.debugger) return;
    await window.craftale.debugger.stepOver();
}

export async function stepInto() {
    if (get(debugStatus) !== "paused" || !window.craftale?.debugger) return;
    await window.craftale.debugger.stepInto();
}

export async function stepOut() {
    if (get(debugStatus) !== "paused" || !window.craftale?.debugger) return;
    await window.craftale.debugger.stepOut();
}

export async function restartDebugging() {
    const prog = get(activeProgram);
    await stopDebugging();
    setTimeout(() => {
        void startDebugging(prog || undefined);
    }, 400);
}

/*
|--------------------------------------------------------------------------
| Frame Selection & Scope Variables
|--------------------------------------------------------------------------
*/

export function selectFrame(index: number) {
    const frames = get(callFrames);
    if (index >= 0 && index < frames.length) {
        selectedFrameIndex.set(index);
        const frame = frames[index];
        if (frame.filePath && frame.lineNumber > 0) {
            requestJump(frame.lineNumber, frame.columnNumber || 1, frame.filePath);
        }
        void fetchScopeVariables(frame);
        void refreshWatchExpressions(frame.id);
    }
}

export async function fetchScopeVariables(frame: DebugCallFrame) {
    if (!window.craftale?.debugger || !frame) return;

    const newMap = new Map<string, DebugVariable[]>();

    for (const scope of frame.scopeChain) {
        if (!scope.objectId) continue;

        try {
            const res = await window.craftale.debugger.getProperties(scope.objectId);
            if (res.success && res.properties) {
                const vars: DebugVariable[] = res.properties.map((p) => {
                    const val = p.value;
                    let displayVal = "undefined";
                    if (val) {
                        if (val.value !== undefined) {
                            displayVal = typeof val.value === "string" ? `"${val.value}"` : String(val.value);
                        } else if (val.description) {
                            displayVal = val.description;
                        }
                    }

                    return {
                        name: p.name,
                        value: displayVal,
                        type: val?.type,
                        subtype: val?.subtype,
                        objectId: val?.objectId,
                        hasChildren: val?.hasChildren ?? false,
                        isExpanded: false
                    };
                });
                newMap.set(scope.name || scope.type, vars);
            }
        } catch (e) {
            console.error("[DEBUGGER] Failed to fetch scope properties:", e);
        }
    }

    scopeVariables.set(newMap);
}

export async function expandVariable(variable: DebugVariable) {
    if (!variable.objectId || !window.craftale?.debugger) return;

    if (variable.isExpanded) {
        variable.isExpanded = false;
        scopeVariables.update((m) => new Map(m));
        return;
    }

    variable.isLoading = true;
    scopeVariables.update((m) => new Map(m));

    try {
        const res = await window.craftale.debugger.getProperties(variable.objectId);
        if (res.success && res.properties) {
            variable.children = res.properties.map((p) => {
                const val = p.value;
                let displayVal = "undefined";
                if (val) {
                    if (val.value !== undefined) {
                        displayVal = typeof val.value === "string" ? `"${val.value}"` : String(val.value);
                    } else if (val.description) {
                        displayVal = val.description;
                    }
                }

                return {
                    name: p.name,
                    value: displayVal,
                    type: val?.type,
                    subtype: val?.subtype,
                    objectId: val?.objectId,
                    hasChildren: val?.hasChildren ?? false,
                    isExpanded: false
                };
            });
            variable.isExpanded = true;
        }
    } catch (e) {
        console.error("[DEBUGGER] Failed to expand variable:", e);
    } finally {
        variable.isLoading = false;
        scopeVariables.update((m) => new Map(m));
    }
}

/*
|--------------------------------------------------------------------------
| Watch Expressions & REPL Evaluator
|--------------------------------------------------------------------------
*/

export function addWatchExpression(expression: string) {
    const trimmed = expression.trim();
    if (!trimmed) return;

    const item: DebugWatchExpression = {
        id: `watch-${nextWatchId++}`,
        expression: trimmed,
        value: "not available"
    };

    watchExpressions.update((list) => [...list, item]);

    const frame = get(selectedFrame);
    if (frame) {
        void refreshWatchExpressions(frame.id);
    }
}

export function removeWatchExpression(id: string) {
    watchExpressions.update((list) => list.filter((w) => w.id !== id));
}

export async function refreshWatchExpressions(callFrameId?: string) {
    if (!window.craftale?.debugger) return;

    const list = get(watchExpressions);
    if (list.length === 0) return;

    const updated: DebugWatchExpression[] = [];

    for (const item of list) {
        try {
            const res = await window.craftale.debugger.evaluate(item.expression, callFrameId);
            if (res.success && res.result) {
                const r = res.result;
                let val = "undefined";
                if (r.value !== undefined) {
                    val = typeof r.value === "string" ? `"${r.value}"` : String(r.value);
                } else if (r.description) {
                    val = r.description;
                }
                updated.push({
                    ...item,
                    value: val,
                    type: r.type,
                    error: false
                });
            } else {
                updated.push({
                    ...item,
                    value: res.error || "ReferenceError",
                    error: true
                });
            }
        } catch (e: any) {
            updated.push({
                ...item,
                value: e.message || "Error",
                error: true
            });
        }
    }

    watchExpressions.set(updated);
}

export async function evaluateRepl(expression: string): Promise<string> {
    const trimmed = expression.trim();
    if (!trimmed || !window.craftale?.debugger) return "";

    appendDebugLog("result", `> ${trimmed}`);

    const frame = get(selectedFrame);
    try {
        const res = await window.craftale.debugger.evaluate(trimmed, frame?.id);
        if (res.success && res.result) {
            const r = res.result;
            let val = "undefined";
            if (r.value !== undefined) {
                val = typeof r.value === "string" ? `"${r.value}"` : String(r.value);
            } else if (r.description) {
                val = r.description;
            }
            appendDebugLog("result", `< ${val}`);
            return val;
        } else {
            const err = res.error || "Evaluation failed";
            appendDebugLog("error", err);
            return err;
        }
    } catch (e: any) {
        const err = e.message || "Evaluation error";
        appendDebugLog("error", err);
        return err;
    }
}

export function clearDebugLogs() {
    debugLogs.set([]);
}

/*
|--------------------------------------------------------------------------
| Debug Hover Variable Evaluator
|--------------------------------------------------------------------------
*/

const hoverCache = new Map<string, any>();

export function clearHoverCache() {
    hoverCache.clear();
}

export function formatDebugHoverValue(expression: string, result: any): string {
    if (!result) return "";

    const type = result.type;
    const subtype = result.subtype;
    const val = result.value;

    if (subtype === "null") {
        return `\`\`\`javascript\n${expression}: null\n\`\`\`\n*🐞 Debugger value*`;
    }
    if (type === "undefined") {
        return `\`\`\`javascript\n${expression}: undefined\n\`\`\`\n*🐞 Debugger value*`;
    }
    if (type === "string") {
        return `\`\`\`javascript\n${expression}: "${val}"\n\`\`\`\n*🐞 Debugger value*`;
    }
    if (type === "number" || type === "boolean") {
        return `\`\`\`javascript\n${expression}: ${val}\n\`\`\`\n*🐞 Debugger value*`;
    }
    if (type === "symbol" || type === "bigint") {
        return `\`\`\`javascript\n${expression}: ${result.description || val}\n\`\`\`\n*🐞 Debugger value*`;
    }
    if (type === "function") {
        const fnDesc = result.description || "function()";
        const firstLine = fnDesc.split("\n")[0];
        return `\`\`\`javascript\n${expression}: ${firstLine}\n\`\`\`\n*🐞 Debugger value*`;
    }

    // Object or Array
    if (type === "object") {
        if (result.preview && Array.isArray(result.preview.properties)) {
            const props = result.preview.properties;
            const isArray = subtype === "array";

            if (isArray) {
                const elements = props.map((p: any) =>
                    p.value !== undefined
                        ? (p.type === "string" ? `"${p.value}"` : String(p.value))
                        : (p.description || p.type)
                );
                if (elements.length <= 6) {
                    return `\`\`\`javascript\n${expression}: [${elements.join(", ")}]\n\`\`\`\n*🐞 Debugger value*`;
                } else {
                    return `\`\`\`javascript\n${expression}: Array(${elements.length}) [\n  ${elements.slice(0, 10).join(",\n  ")}\n  ...\n]\n\`\`\`\n*🐞 Debugger value*`;
                }
            } else {
                // Object with preview properties
                const formatted = props.map((p: any) => {
                    let propVal = p.value !== undefined ? p.value : (p.description || p.type);
                    if (p.type === "string") propVal = `"${propVal}"`;
                    return `  ${p.name}: ${propVal}`;
                });
                return `\`\`\`javascript\n${expression}: {\n${formatted.join(",\n")}\n}\n\`\`\`\n*🐞 Debugger value*`;
            }
        }

        // Fallback description
        return `\`\`\`javascript\n${expression}: ${result.description || "{...}"}\n\`\`\`\n*🐞 Debugger value*`;
    }

    return `\`\`\`javascript\n${expression}: ${result.description || String(val)}\n\`\`\`\n*🐞 Debugger value*`;
}

export interface DebugHoverInfo {
    expression: string;
    formatted: string;
    type?: string;
}

export async function evaluateForHover(expression: string): Promise<DebugHoverInfo | null> {
    const trimmed = expression.trim();
    if (!trimmed || !window.craftale?.debugger) return null;

    if (get(debugStatus) !== "paused") return null;

    const frame = get(selectedFrame);
    if (!frame || !frame.id) return null;

    // Check cache
    const cacheKey = `${frame.id}:${trimmed}`;
    if (hoverCache.has(cacheKey)) {
        const cached = hoverCache.get(cacheKey);
        if (!cached) return null;
        return {
            expression: trimmed,
            formatted: formatDebugHoverValue(trimmed, cached),
            type: cached.type
        };
    }

    try {
        const res = await window.craftale.debugger.evaluate(trimmed, frame.id);
        if (!res || !res.success || !res.result) {
            hoverCache.set(cacheKey, null);
            return null;
        }

        const r = res.result;

        // If evaluation produced a ReferenceError or other error, it's not a valid variable in scope
        if (r.subtype === "error" || r.className?.includes("Error")) {
            hoverCache.set(cacheKey, null);
            return null;
        }

        hoverCache.set(cacheKey, r);

        return {
            expression: trimmed,
            formatted: formatDebugHoverValue(trimmed, r),
            type: r.type
        };
    } catch {
        hoverCache.set(cacheKey, null);
        return null;
    }
}
