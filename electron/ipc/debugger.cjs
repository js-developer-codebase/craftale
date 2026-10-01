const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");
const net = require("net");
const http = require("http");
const { pathToFileURL } = require("url");

/*
|--------------------------------------------------------------------------
| V8 Inspector Protocol Debugger Manager
|--------------------------------------------------------------------------
| Connects to Node.js / V8 Inspector via Chrome DevTools Protocol (CDP)
| over WebSocket for interactive step-debugging, breakpoints, call stacks,
| scopes, variable inspection, and REPL evaluation.
|--------------------------------------------------------------------------
*/

class DebugSessionManager {
    constructor() {
        this.activeProcess = null;
        this.ws = null;
        this.currentSender = null;
        this.reqId = 1;
        this.pendingRequests = new Map();
        this.currentSessionConfig = null;
        this.activeBreakpoints = new Map(); // filePath -> cdpBreakpointIds[]
        this.scriptParsedMap = new Map(); // scriptId -> { url, ... }
        this.isPaused = false;
        this.pausedFrames = [];
        this.hasResumedFromEntry = false;
        this.storedBreakpoints = {};
        this.currentWsUrl = null;
    }

    initialize(window) {
        // window reference if needed
    }

    sendEvent(type, payload) {
        if (this.currentSender && !this.currentSender.isDestroyed()) {
            this.currentSender.send("debugger:event", { type, ...payload });
        }
    }

    async getFreePort() {
        return new Promise((resolve, reject) => {
            const srv = net.createServer();
            srv.listen(0, "127.0.0.1", () => {
                const port = srv.address().port;
                srv.close((err) => {
                    if (err) reject(err);
                    else resolve(port);
                });
            });
        });
    }

    sendCdp(method, params = {}) {
        return new Promise((resolve, reject) => {
            if (!this.ws || this.ws.readyState !== 1) { // 1 = OPEN
                return reject(new Error("Debugger WebSocket is not connected"));
            }

            const id = this.reqId++;
            const timer = setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    reject(new Error(`CDP request ${method} (id: ${id}) timed out`));
                }
            }, 10000);

            this.pendingRequests.set(id, { resolve, reject, timer });

            try {
                this.ws.send(JSON.stringify({ id, method, params }));
            } catch (err) {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(err);
            }
        });
    }

    async connectWebSocket(wsUrl) {
        return new Promise((resolve, reject) => {
            try {
                console.log(`[DEBUGGER] Connecting WebSocket to ${wsUrl}`);
                const ws = new globalThis.WebSocket(wsUrl);
                this.ws = ws;

                const connectTimer = setTimeout(() => {
                    reject(new Error("Timeout connecting to debugger WebSocket"));
                }, 8000);

                ws.onopen = async () => {
                    clearTimeout(connectTimer);
                    console.log("[DEBUGGER] WebSocket connected successfully");

                    try {
                        // Enable Debugger and Runtime domains
                        await this.sendCdp("Debugger.enable");
                        await this.sendCdp("Runtime.enable");
                        await this.sendCdp("Debugger.setPauseOnExceptions", { state: "uncaught" });
                        resolve();
                    } catch (e) {
                        reject(e);
                    }
                };

                ws.onmessage = (event) => {
                    this.handleCdpMessage(event.data);
                };

                ws.onerror = (err) => {
                    clearTimeout(connectTimer);
                    console.error("[DEBUGGER] WebSocket error:", err);
                    this.sendEvent("error", { message: err.message || "Debugger WebSocket error" });
                };

                ws.onclose = () => {
                    console.log("[DEBUGGER] WebSocket closed");
                    this.cleanupSession();
                    this.sendEvent("stopped", {});
                };
            } catch (e) {
                reject(e);
            }
        });
    }

    handleCdpMessage(data) {
        let msg;
        try {
            msg = JSON.parse(data);
        } catch {
            return;
        }

        // Response to pending request
        if (msg.id && this.pendingRequests.has(msg.id)) {
            const { resolve, reject, timer } = this.pendingRequests.get(msg.id);
            clearTimeout(timer);
            this.pendingRequests.delete(msg.id);

            if (msg.error) {
                reject(new Error(msg.error.message || "CDP error"));
            } else {
                resolve(msg.result);
            }
            return;
        }

        // Events
        if (msg.method) {
            console.log("[CDP EVENT]", msg.method, msg.method === "Debugger.paused" ? msg.params?.reason : "");
            this.handleCdpEvent(msg.method, msg.params);
        }
    }

    handleCdpEvent(method, params) {
        switch (method) {
            case "Debugger.paused": {
                this.isPaused = true;
                const reason = params.reason || "other";
                console.log("[CDP Debugger.paused] Reason:", reason, "hitBreakpoints:", params.hitBreakpoints);

                // Handle initial pause on entry when stopOnEntry is false
                if (!this.hasResumedFromEntry) {
                    if (reason === "Break on start" || (!params.hitBreakpoints || params.hitBreakpoints.length === 0)) {
                        if (this.currentSessionConfig?.stopOnEntry) {
                            this.hasResumedFromEntry = true;
                        } else {
                            // Waiting for breakpoints to be set & resume() to be called by start() or attachWs()
                            console.log("[DEBUGGER] Paused at entry, waiting for initial resume");
                            return;
                        }
                    } else {
                        this.hasResumedFromEntry = true;
                    }
                }

                const rawFrames = params.callFrames || [];
                const formattedFrames = rawFrames.map((frame, index) => {
                    let fileUrl = frame.url || "";
                    if (!fileUrl && frame.location && frame.location.scriptId) {
                        const parsed = this.scriptParsedMap.get(frame.location.scriptId);
                        if (parsed && parsed.url) {
                            fileUrl = parsed.url;
                        }
                    }

                    let filePath = fileUrl;
                    if (filePath.startsWith("file:///")) {
                        filePath = decodeURIComponent(filePath.replace(/^file:\/\/\//, ""));
                        // Windows drive letter normalization: C:/...
                        if (/^[a-zA-Z]:\//.test(filePath)) {
                            filePath = filePath.replace(/\//g, "\\");
                        }
                    }

                    return {
                        id: frame.callFrameId,
                        index,
                        functionName: frame.functionName || "(anonymous)",
                        url: fileUrl,
                        filePath,
                        fileName: path.basename(filePath) || "(eval)",
                        lineNumber: (frame.location?.lineNumber ?? 0) + 1, // 1-indexed
                        columnNumber: (frame.location?.columnNumber ?? 0) + 1,
                        scopeChain: (frame.scopeChain || []).map((s) => ({
                            type: s.type, // 'local' | 'closure' | 'global' | 'catch' | 'block'
                            name: s.name || s.type,
                            objectId: s.object?.objectId,
                            description: s.object?.description
                        })),
                        thisObj: frame.this
                    };
                });

                this.pausedFrames = formattedFrames;

                this.sendEvent("paused", {
                    reason: params.reason || "breakpoint",
                    callFrames: formattedFrames,
                    hitBreakpoints: params.hitBreakpoints || []
                });
                break;
            }

            case "Debugger.resumed": {
                this.isPaused = false;
                this.pausedFrames = [];
                this.sendEvent("resumed", {});
                break;
            }

            case "Debugger.scriptParsed": {
                if (params.scriptId && params.url) {
                    this.scriptParsedMap.set(params.scriptId, params);
                }
                break;
            }

            case "Runtime.consoleAPICalled": {
                const args = (params.args || []).map((a) => {
                    if (a.value !== undefined) return String(a.value);
                    if (a.description) return a.description;
                    if (a.className) return `[${a.className}]`;
                    return a.type || "unknown";
                });

                this.sendEvent("console", {
                    logType: params.type || "log",
                    text: args.join(" "),
                    timestamp: params.timestamp || Date.now()
                });
                break;
            }

            case "Runtime.exceptionThrown": {
                const desc = params.exceptionDetails?.exception?.description ||
                             params.exceptionDetails?.text ||
                             "Uncaught Exception";

                this.sendEvent("exception", {
                    text: desc,
                    lineNumber: (params.exceptionDetails?.lineNumber ?? 0) + 1,
                    url: params.exceptionDetails?.url || ""
                });
                break;
            }
        }
    }

    async start(sender, config) {
        this.cleanupSession();
        this.currentSender = sender;
        this.currentSessionConfig = config;

        const port = config.port || await this.getFreePort();
        const programPath = config.programPath;

        if (!programPath || !fs.existsSync(programPath)) {
            throw new Error(`Target script does not exist: "${programPath}"`);
        }

        const cwd = config.cwd || path.dirname(programPath);
        const args = config.args || [];
        const isTypeScript = programPath.endsWith(".ts") || programPath.endsWith(".tsx");

        // Prepare spawn command
        let runtime = "node";
        let spawnArgs = [`--inspect-brk=${port}`];

        if (isTypeScript) {
            // Check if tsx or ts-node is available
            spawnArgs.push(programPath, ...args);
        } else {
            spawnArgs.push(programPath, ...args);
        }

        console.log(`[DEBUGGER] Spawning: ${runtime} ${spawnArgs.join(" ")} (cwd: ${cwd})`);

        return new Promise((resolve, reject) => {
            let started = false;
            let wsUrl = null;

            try {
                this.activeProcess = spawn(runtime, spawnArgs, {
                    cwd,
                    env: { ...process.env, ...(config.env || {}) },
                    stdio: ["pipe", "pipe", "pipe"],
                    windowsHide: true
                });
            } catch (err) {
                return reject(err);
            }

            const proc = this.activeProcess;

            // Capture stderr to find ws:// URL
            proc.stderr.on("data", async (chunk) => {
                const text = chunk.toString();
                this.sendEvent("stderr", { text });

                if (!started) {
                    const match = text.match(/ws:\/\/[^\s\r\n]+/);
                    if (match) {
                        started = true;
                        wsUrl = match[0];
                        try {
                            await this.connectWebSocket(wsUrl);

                            // Apply initial breakpoints if any
                            if (config.breakpoints) {
                                await this.syncBreakpoints(config.breakpoints);
                            }

                            // Signal V8 to start execution
                            await this.sendCdp("Runtime.runIfWaitingForDebugger");

                            // If not stopping on entry, resume
                            if (!config.stopOnEntry) {
                                await this.resume();
                            }

                            resolve({
                                success: true,
                                port,
                                pid: proc.pid,
                                program: programPath
                            });
                        } catch (err) {
                            reject(err);
                        }
                    }
                }
            });

            proc.stdout.on("data", (chunk) => {
                const text = chunk.toString();
                this.sendEvent("stdout", { text });
            });

            proc.on("error", (err) => {
                console.error("[DEBUGGER] Process error:", err);
                if (!started) {
                    reject(err);
                } else {
                    this.sendEvent("error", { message: err.message });
                }
            });

            proc.on("close", (code) => {
                console.log(`[DEBUGGER] Process exited with code ${code}`);
                this.cleanupSession();
                this.sendEvent("stopped", { code });
            });

            // Fallback timeout if ws URL isn't captured within 7s
            setTimeout(() => {
                if (!started) {
                    this.cleanupSession();
                    reject(new Error("Timeout waiting for Node debugger to start on port " + port));
                }
            }, 7000);
        });
    }

    async attach(sender, host = "127.0.0.1", port = 9229) {
        this.cleanupSession();
        this.currentSender = sender;

        return new Promise((resolve, reject) => {
            const req = http.get(`http://${host}:${port}/json/list`, (res) => {
                let data = "";
                res.on("data", (d) => { data += d; });
                res.on("end", async () => {
                    try {
                        const list = JSON.parse(data);
                        if (!list || list.length === 0 || !list[0].webSocketDebuggerUrl) {
                            return reject(new Error("No debuggable target found at port " + port));
                        }
                        const wsUrl = list[0].webSocketDebuggerUrl;
                        await this.connectWebSocket(wsUrl);
                        resolve({ success: true, port, wsUrl });
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on("error", (err) => {
                reject(new Error(`Failed to connect to debugger at ${host}:${port} - ${err.message}`));
            });
        });
    }

    async syncBreakpoints(breakpointsMap) {
        this.storedBreakpoints = breakpointsMap;

        // Only send CDP commands if connected
        if (!this.ws || this.ws.readyState !== 1) {
            console.log("[DEBUGGER] Breakpoints stored (no active session yet)");
            return;
        }

        // Clear previous
        for (const [bpKey, bpId] of this.activeBreakpoints.entries()) {
            try {
                await this.sendCdp("Debugger.removeBreakpoint", { breakpointId: bpId });
            } catch {}
        }
        this.activeBreakpoints.clear();

        // Set each breakpoint: { [filePath]: [lines...] }
        for (const [filePath, lines] of Object.entries(breakpointsMap)) {
            let fileUrl = "";
            try {
                fileUrl = pathToFileURL(filePath).href;
            } catch {
                fileUrl = filePath;
            }

            const fileName = path.basename(filePath);
            const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const urlRegex = `.*${escapedName}`;

            for (const line of lines) {
                // 1. Exact fileUrl
                try {
                    const res = await this.sendCdp("Debugger.setBreakpointByUrl", {
                        url: fileUrl,
                        lineNumber: line - 1, // 0-indexed in CDP
                        columnNumber: 0
                    });
                    console.log("[DEBUGGER SET BP URL SUCCESS]", filePath, line, res);
                    if (res && res.breakpointId) {
                        this.activeBreakpoints.set(`${filePath}:${line}:url`, res.breakpointId);
                    }
                } catch (err1) {
                    console.warn("[DEBUGGER SET BP URL FAILED]", err1.message);
                }

                // 2. Regex fallback for drive letter casing and relative paths
                try {
                    const res = await this.sendCdp("Debugger.setBreakpointByUrl", {
                        urlRegex,
                        lineNumber: line - 1,
                        columnNumber: 0
                    });
                    console.log("[DEBUGGER SET BP REGEX SUCCESS]", filePath, line, res);
                    if (res && res.breakpointId) {
                        this.activeBreakpoints.set(`${filePath}:${line}:regex`, res.breakpointId);
                    }
                } catch (e) {
                    console.error(`[DEBUGGER] Failed to set breakpoint at ${filePath}:${line}:`, e);
                }
            }
        }
    }

    async resume() {
        this.hasResumedFromEntry = true;
        try {
            await this.sendCdp("Debugger.resume");
            this.isPaused = false;
            return true;
        } catch {
            return false;
        }
    }

    async pause() {
        if (this.isPaused) return false;
        await this.sendCdp("Debugger.pause");
        return true;
    }

    async stepOver() {
        if (!this.isPaused) return false;
        await this.sendCdp("Debugger.stepOver");
        return true;
    }

    async stepInto() {
        if (!this.isPaused) return false;
        await this.sendCdp("Debugger.stepInto");
        return true;
    }

    async stepOut() {
        if (!this.isPaused) return false;
        await this.sendCdp("Debugger.stepOut");
        return true;
    }

    async evaluate(expression, callFrameId) {
        if (!this.ws || this.ws.readyState !== 1) {
            throw new Error("Debugger is not connected");
        }

        if (callFrameId) {
            const res = await this.sendCdp("Debugger.evaluateOnCallFrame", {
                callFrameId,
                expression,
                returnByValue: false,
                generatePreview: true
            });
            return res.result;
        } else {
            const res = await this.sendCdp("Runtime.evaluate", {
                expression,
                returnByValue: false,
                generatePreview: true
            });
            return res.result;
        }
    }

    async getProperties(objectId) {
        if (!this.ws || this.ws.readyState !== 1) {
            throw new Error("Debugger is not connected");
        }

        const res = await this.sendCdp("Runtime.getProperties", {
            objectId,
            ownProperties: true,
            generatePreview: true
        });

        return (res.result || []).map((prop) => ({
            name: prop.name,
            value: prop.value ? {
                type: prop.value.type,
                subtype: prop.value.subtype,
                value: prop.value.value,
                description: prop.value.description,
                objectId: prop.value.objectId,
                hasChildren: prop.value.type === "object" && prop.value.subtype !== "null"
            } : undefined,
            isEnumerable: prop.enumerable
        }));
    }

    cleanupSession() {
        // Clear pending timeouts
        for (const [id, req] of this.pendingRequests.entries()) {
            clearTimeout(req.timer);
            req.reject(new Error("Debug session closed"));
        }
        this.pendingRequests.clear();

        if (this.ws) {
            try {
                this.ws.close();
            } catch {}
            this.ws = null;
        }

        if (this.activeProcess) {
            try {
                this.activeProcess.kill("SIGKILL");
            } catch {}
            this.activeProcess = null;
        }

        this.isPaused = false;
        this.pausedFrames = [];
        this.activeBreakpoints.clear();
        this.scriptParsedMap.clear();
        this.hasResumedFromEntry = false;
        this.currentWsUrl = null;
    }

    async attachWs(wsUrl, sender) {
        if (this.currentWsUrl === wsUrl && this.ws && this.ws.readyState === 1) {
            return { success: true, wsUrl };
        }
        this.cleanupSession();
        this.currentSender = sender;
        this.currentWsUrl = wsUrl;
        this.currentSessionConfig = { breakpoints: this.storedBreakpoints, stopOnEntry: false };
        await this.connectWebSocket(wsUrl);
        if (this.storedBreakpoints && Object.keys(this.storedBreakpoints).length > 0) {
            await this.syncBreakpoints(this.storedBreakpoints);
        }
        await this.sendCdp("Runtime.runIfWaitingForDebugger");
        await this.resume();
        this.sendEvent("started", { wsUrl });
        return { success: true, wsUrl };
    }

    stop() {
        this.cleanupSession();
        this.sendEvent("stopped", {});
        return true;
    }
}

const sessionManager = new DebugSessionManager();

/*
|--------------------------------------------------------------------------
| IPC Registration
|--------------------------------------------------------------------------
*/

function handleIpc(channel, handler) {
    if (ipcMain && ipcMain.handle) {
        ipcMain.handle(channel, handler);
    }
}

handleIpc("debugger:start", async (event, config) => {
    try {
        return await sessionManager.start(event.sender, config);
    } catch (err) {
        return { success: false, error: err.message };
    }
});

handleIpc("debugger:attach", async (event, host, port) => {
    try {
        return await sessionManager.attach(event.sender, host, port);
    } catch (err) {
        return { success: false, error: err.message };
    }
});

handleIpc("debugger:stop", async () => {
    return sessionManager.stop();
});

handleIpc("debugger:resume", async () => {
    return await sessionManager.resume();
});

handleIpc("debugger:pause", async () => {
    return await sessionManager.pause();
});

handleIpc("debugger:step-over", async () => {
    return await sessionManager.stepOver();
});

handleIpc("debugger:step-into", async () => {
    return await sessionManager.stepInto();
});

handleIpc("debugger:step-out", async () => {
    return await sessionManager.stepOut();
});

handleIpc("debugger:set-breakpoints", async (event, breakpointsMap) => {
    try {
        await sessionManager.syncBreakpoints(breakpointsMap);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

handleIpc("debugger:evaluate", async (event, expression, callFrameId) => {
    try {
        const result = await sessionManager.evaluate(expression, callFrameId);
        return { success: true, result };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

handleIpc("debugger:get-properties", async (event, objectId) => {
    try {
        const properties = await sessionManager.getProperties(objectId);
        return { success: true, properties };
    } catch (err) {
        return { success: false, error: err.message };
    }
});

module.exports = {
    initialize: (win) => sessionManager.initialize(win),
    sessionManager
};
