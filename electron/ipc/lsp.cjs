const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/*
|--------------------------------------------------------------------------
| Stdio Framing Parser
|--------------------------------------------------------------------------
|
| Handles Language Server Protocol framing over stdio:
| Headers separated by \r\n, followed by \r\n, followed by content JSON.
|
*/

class StdioFramingParser {
    constructor(onMessage) {
        this.onMessage = onMessage;
        this.buffer = Buffer.alloc(0);
    }

    push(chunk) {
        this.buffer = Buffer.concat([this.buffer, chunk]);

        while (true) {
            const headerEndIndex = this.buffer.indexOf("\r\n\r\n");
            if (headerEndIndex === -1) {
                break;
            }

            const headerString = this.buffer.slice(0, headerEndIndex).toString("utf8");
            const contentLengthMatch = headerString.match(/Content-Length:\s*(\d+)/i);

            if (!contentLengthMatch) {
                console.warn("[LSP Parser] Invalid header without Content-Length, recovering:", headerString);
                this.buffer = this.buffer.slice(headerEndIndex + 4);
                continue;
            }

            const contentLength = parseInt(contentLengthMatch[1], 10);
            const messageStartIndex = headerEndIndex + 4;
            const messageEndIndex = messageStartIndex + contentLength;

            if (this.buffer.length < messageEndIndex) {
                // Wait for the complete payload
                break;
            }

            const bodySlice = this.buffer.slice(messageStartIndex, messageEndIndex);
            this.buffer = this.buffer.slice(messageEndIndex);

            try {
                const json = JSON.parse(bodySlice.toString("utf8"));
                this.onMessage(json);
            } catch (err) {
                console.error("[LSP Parser] JSON parse error:", err, bodySlice.toString("utf8"));
            }
        }
    }

    clear() {
        this.buffer = Buffer.alloc(0);
    }
}

function formatLspMessage(messageObj) {
    const jsonStr = typeof messageObj === "string" ? messageObj : JSON.stringify(messageObj);
    const bodyBuffer = Buffer.from(jsonStr, "utf8");
    const headerBuffer = Buffer.from(`Content-Length: ${bodyBuffer.length}\r\n\r\n`, "utf8");
    return Buffer.concat([headerBuffer, bodyBuffer]);
}

/*
|--------------------------------------------------------------------------
| Server Configurations
|--------------------------------------------------------------------------
*/

const LANGUAGE_SERVERS = {
    typescript: {
        name: "TypeScript / JavaScript Language Server",
        relativeScript: "node_modules/typescript-language-server/lib/cli.mjs",
        args: ["--stdio"]
    },
    html: {
        name: "HTML Language Server",
        relativeScript: "node_modules/vscode-langservers-extracted/bin/vscode-html-language-server",
        args: ["--stdio"]
    },
    css: {
        name: "CSS / SCSS / LESS Language Server",
        relativeScript: "node_modules/vscode-langservers-extracted/bin/vscode-css-language-server",
        args: ["--stdio"]
    },
    json: {
        name: "JSON Language Server",
        relativeScript: "node_modules/vscode-langservers-extracted/bin/vscode-json-language-server",
        args: ["--stdio"]
    },
    svelte: {
        name: "Svelte Language Server",
        relativeScript: "node_modules/svelte-language-server/bin/server.js",
        args: ["--stdio"]
    }
};

const LANGUAGE_ID_TO_SERVER = {
    javascript: "typescript",
    typescript: "typescript",
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

/*
|--------------------------------------------------------------------------
| LSP Manager State
|--------------------------------------------------------------------------
*/

let currentWindow = null;
const activeServers = new Map(); // serverId -> { process, parser, workspacePath, status, config }

function resolveServerScript(relativeScript) {
    const candidate1 = path.resolve(__dirname, "../../", relativeScript);
    if (fs.existsSync(candidate1)) return candidate1;

    try {
        const { app } = require("electron");
        if (app) {
            const candidate2 = path.resolve(app.getAppPath(), relativeScript);
            if (fs.existsSync(candidate2)) return candidate2;
        }
    } catch (e) {
        // ignore
    }

    return candidate1;
}

function sendToRenderer(channel, data) {
    if (currentWindow && !currentWindow.isDestroyed()) {
        currentWindow.webContents.send(channel, data);
    }
}

/*
|--------------------------------------------------------------------------
| Initialize Window Reference
|--------------------------------------------------------------------------
*/

function initialize(window) {
    currentWindow = window;
}

/*
|--------------------------------------------------------------------------
| Start Language Server
|--------------------------------------------------------------------------
*/

async function startServer(languageId, workspacePath) {
    const serverId = LANGUAGE_ID_TO_SERVER[languageId] || languageId;
    const config = LANGUAGE_SERVERS[serverId];

    if (!config) {
        return {
            success: false,
            error: `No language server configured for language ID '${languageId}'`
        };
    }

    const scriptPath = resolveServerScript(config.relativeScript);
    if (!fs.existsSync(scriptPath)) {
        return {
            success: false,
            error: `Language server script not found at ${scriptPath}`
        };
    }

    // Check if server is already running for this workspace
    const existing = activeServers.get(serverId);
    if (existing && existing.status === "running") {
        if (existing.workspacePath === workspacePath) {
            return {
                success: true,
                serverId,
                alreadyRunning: true
            };
        } else {
            // Workspace changed, restart server
            await stopServer(serverId);
        }
    }

    try {
        sendToRenderer("lsp:status", {
            serverId,
            status: "starting"
        });

        const cwd = workspacePath && fs.existsSync(workspacePath) ? workspacePath : path.resolve(__dirname, "../../");

        const child = spawn(process.execPath, [scriptPath, ...config.args], {
            cwd,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: "1"
            },
            stdio: ["pipe", "pipe", "pipe"],
            windowsHide: true
        });

        const parser = new StdioFramingParser((message) => {
            sendToRenderer("lsp:message", {
                serverId,
                message
            });
        });

        child.stdout.on("data", (chunk) => {
            parser.push(chunk);
        });

        child.stderr.on("data", (chunk) => {
            const text = chunk.toString("utf8");
            // Only log non-trivial messages
            if (text.trim()) {
                console.log(`[LSP ${serverId} stderr]`, text.trim());
            }
        });

        child.on("error", (err) => {
            console.error(`[LSP ${serverId}] Process error:`, err);
            const current = activeServers.get(serverId);
            if (current && current.process === child) {
                activeServers.delete(serverId);
                sendToRenderer("lsp:status", {
                    serverId,
                    status: "error",
                    error: err.message
                });
            }
        });

        child.on("exit", (code, signal) => {
            console.log(`[LSP ${serverId}] Exited with code ${code}, signal ${signal}`);
            const current = activeServers.get(serverId);
            if (current && current.process === child) {
                activeServers.delete(serverId);
                sendToRenderer("lsp:status", {
                    serverId,
                    status: "stopped",
                    code,
                    signal
                });
            }
        });

        activeServers.set(serverId, {
            process: child,
            parser,
            workspacePath,
            status: "running",
            config
        });

        sendToRenderer("lsp:status", {
            serverId,
            status: "running"
        });

        return {
            success: true,
            serverId
        };
    } catch (err) {
        console.error(`[LSP ${serverId}] Failed to spawn:`, err);
        sendToRenderer("lsp:status", {
            serverId,
            status: "error",
            error: err.message
        });
        return {
            success: false,
            error: err.message
        };
    }
}

/*
|--------------------------------------------------------------------------
| Stop Language Server
|--------------------------------------------------------------------------
*/

async function stopServer(serverId) {
    const entry = activeServers.get(serverId);
    if (!entry) {
        return { success: true };
    }

    try {
        const { process: child } = entry;
        activeServers.delete(serverId);

        if (child && !child.killed && child.exitCode === null) {
            await new Promise((resolve) => {
                let finished = false;
                const finish = () => {
                    if (!finished) {
                        finished = true;
                        resolve();
                    }
                };

                const timer = setTimeout(() => {
                    try {
                        if (process.platform === "win32" && child.pid) {
                            const { execSync } = require("child_process");
                            execSync(`taskkill /F /T /PID ${child.pid}`, { stdio: "ignore" });
                        } else if (!child.killed) {
                            child.kill("SIGKILL");
                        }
                    } catch (e) {
                        // ignore
                    }
                    finish();
                }, 1500);

                child.once("exit", () => {
                    clearTimeout(timer);
                    finish();
                });

                try {
                    child.kill("SIGTERM");
                } catch (e) {
                    clearTimeout(timer);
                    finish();
                }
            });
        }

        sendToRenderer("lsp:status", {
            serverId,
            status: "stopped"
        });

        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}

/*
|--------------------------------------------------------------------------
| Restart Language Server
|--------------------------------------------------------------------------
*/

async function restartServer(languageId, workspacePath) {
    const serverId = LANGUAGE_ID_TO_SERVER[languageId] || languageId;
    await stopServer(serverId);
    return await startServer(languageId, workspacePath);
}

/*
|--------------------------------------------------------------------------
| Stop All Servers
|--------------------------------------------------------------------------
*/

async function stopAllServers() {
    const promises = [];
    for (const serverId of activeServers.keys()) {
        promises.push(stopServer(serverId));
    }
    await Promise.all(promises);
    return { success: true };
}

/*
|--------------------------------------------------------------------------
| Send Message to Language Server
|--------------------------------------------------------------------------
*/

async function sendMessage(serverId, message) {
    const entry = activeServers.get(serverId);
    if (!entry || !entry.process || entry.process.killed) {
        return {
            success: false,
            error: `Server '${serverId}' is not running`
        };
    }

    try {
        const payload = formatLspMessage(message);
        entry.process.stdin.write(payload);
        return { success: true };
    } catch (err) {
        return {
            success: false,
            error: err.message
        };
    }
}

/*
|--------------------------------------------------------------------------
| Get Active Servers Status
|--------------------------------------------------------------------------
*/

function getServersStatus() {
    const list = {};
    for (const [id, entry] of activeServers.entries()) {
        list[id] = {
            name: entry.config?.name || id,
            status: entry.status,
            workspacePath: entry.workspacePath,
            pid: entry.process?.pid
        };
    }
    return list;
}

/*
|--------------------------------------------------------------------------
| Register IPC Handlers
|--------------------------------------------------------------------------
*/

if (ipcMain) {
    ipcMain.handle("lsp:start-server", async (_event, { languageId, workspacePath }) => {
        return await startServer(languageId, workspacePath);
    });

    ipcMain.handle("lsp:stop-server", async (_event, { serverId }) => {
        return await stopServer(serverId);
    });

    ipcMain.handle("lsp:restart-server", async (_event, { serverId, workspacePath }) => {
        return await restartServer(serverId, workspacePath);
    });

    ipcMain.handle("lsp:stop-all", async () => {
        return await stopAllServers();
    });

    ipcMain.handle("lsp:send-message", async (_event, { serverId, message }) => {
        return await sendMessage(serverId, message);
    });

    ipcMain.handle("lsp:get-servers-status", async () => {
        return getServersStatus();
    });
}

module.exports = {
    initialize,
    startServer,
    stopServer,
    restartServer,
    stopAllServers,
    sendMessage,
    getServersStatus
};
