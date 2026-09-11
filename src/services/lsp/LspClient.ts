import { pathToUri } from "./protocol";

export interface PendingRequest {
    resolve: (result: any) => void;
    reject: (error: any) => void;
    timer: any;
    method: string;
}

export type ClientStatus = "stopped" | "starting" | "ready" | "error";

export class LspClient {
    public readonly serverId: string;
    public status: ClientStatus = "stopped";
    public serverCapabilities: any = null;
    public workspacePath: string | null = null;

    private nextRequestId = 1;
    private pendingRequests = new Map<number | string, PendingRequest>();
    private notificationHandlers = new Map<string, Set<(params: any) => void>>();
    private statusListeners = new Set<(status: ClientStatus, error?: string) => void>();
    private openDocuments = new Map<string, { version: number; languageId: string }>();

    constructor(serverId: string) {
        this.serverId = serverId;
    }

    public onStatus(listener: (status: ClientStatus, error?: string) => void): () => void {
        this.statusListeners.add(listener);
        listener(this.status);
        return () => this.statusListeners.delete(listener);
    }

    private setStatus(status: ClientStatus, error?: string) {
        this.status = status;
        for (const listener of this.statusListeners) {
            try {
                listener(status, error);
            } catch (err) {
                console.error("[LSP] Status listener error:", err);
            }
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Handle Incoming Messages from Main Process
    |--------------------------------------------------------------------------
    */
    public handleMessage(message: any) {
        if (!message) return;

        // 1. Response to our pending request
        if (message.id !== undefined && (message.result !== undefined || message.error !== undefined)) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                clearTimeout(pending.timer);
                this.pendingRequests.delete(message.id);
                if (message.error) {
                    console.warn(`[LSP ${this.serverId}] Error response for ${pending.method}:`, message.error);
                    pending.reject(message.error);
                } else {
                    pending.resolve(message.result);
                }
            }
            return;
        }

        // 2. Server Request to Client (has method and id)
        if (message.method && message.id !== undefined) {
            this.handleServerRequest(message.id, message.method, message.params);
            return;
        }

        // 3. Server Notification to Client (has method, no id)
        if (message.method) {
            this.handleServerNotification(message.method, message.params);
        }
    }

    private handleServerRequest(id: number | string, method: string, params: any) {
        // Handle common client-side requests from language servers
        if (method === "workspace/configuration") {
            const items = params?.items || [];
            const result = items.map(() => ({}));
            void this.sendRaw({ jsonrpc: "2.0", id, result });
            return;
        }

        if (method === "workspace/workspaceFolders") {
            const result = this.workspacePath
                ? [{ uri: pathToUri(this.workspacePath), name: "workspace" }]
                : [];
            void this.sendRaw({ jsonrpc: "2.0", id, result });
            return;
        }

        if (method === "client/registerCapability") {
            void this.sendRaw({ jsonrpc: "2.0", id, result: null });
            return;
        }

        if (method === "client/unregisterCapability") {
            void this.sendRaw({ jsonrpc: "2.0", id, result: null });
            return;
        }

        // Default empty response for unhandled server requests
        void this.sendRaw({ jsonrpc: "2.0", id, result: null });
    }

    private handleServerNotification(method: string, params: any) {
        const handlers = this.notificationHandlers.get(method);
        if (handlers) {
            for (const handler of handlers) {
                try {
                    handler(params);
                } catch (err) {
                    console.error(`[LSP ${this.serverId}] Notification handler error for ${method}:`, err);
                }
            }
        }
    }

    public onNotification(method: string, handler: (params: any) => void): () => void {
        let handlers = this.notificationHandlers.get(method);
        if (!handlers) {
            handlers = new Set();
            this.notificationHandlers.set(method, handlers);
        }
        handlers.add(handler);
        return () => {
            handlers?.delete(handler);
            if (handlers && handlers.size === 0) {
                this.notificationHandlers.delete(method);
            }
        };
    }

    /*
    |--------------------------------------------------------------------------
    | Send Request / Notification
    |--------------------------------------------------------------------------
    */
    public async sendRequest<T = any>(method: string, params?: any, timeoutMs = 15000): Promise<T> {
        if (this.status !== "ready" && method !== "initialize") {
            throw new Error(`LSP server '${this.serverId}' is not ready (status: ${this.status})`);
        }

        const id = this.nextRequestId++;
        const message = {
            jsonrpc: "2.0",
            id,
            method,
            params: params !== undefined ? params : {}
        };

        return new Promise<T>((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`LSP request '${method}' timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.pendingRequests.set(id, { resolve, reject, timer, method });

            this.sendRaw(message).catch((err) => {
                clearTimeout(timer);
                this.pendingRequests.delete(id);
                reject(err);
            });
        });
    }

    public async sendNotification(method: string, params?: any): Promise<void> {
        const message = {
            jsonrpc: "2.0",
            method,
            params: params !== undefined ? params : {}
        };
        await this.sendRaw(message);
    }

    private async sendRaw(message: any): Promise<void> {
        if (!window.craftale?.lsp) {
            throw new Error("Electron LSP bridge not available");
        }
        const res = await window.craftale.lsp.sendMessage(this.serverId, message);
        if (!res.success) {
            throw new Error(res.error || `Failed to send LSP message to ${this.serverId}`);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Server Lifecycle: Start & Initialize
    |--------------------------------------------------------------------------
    */
    public async startAndInitialize(workspacePath: string): Promise<boolean> {
        if (this.status === "ready" && this.workspacePath === workspacePath) {
            return true;
        }

        this.workspacePath = workspacePath;
        this.setStatus("starting");

        if (!window.craftale?.lsp) {
            this.setStatus("error", "craftale.lsp not found in window");
            return false;
        }

        try {
            const startRes = await window.craftale.lsp.startServer(this.serverId, workspacePath);
            if (!startRes.success) {
                this.setStatus("error", startRes.error);
                return false;
            }

            const rootUri = pathToUri(workspacePath);
            const folderName = workspacePath.split(/[\\/]/).pop() || "workspace";

            const initParams = {
                processId: null,
                rootPath: workspacePath,
                rootUri,
                workspaceFolders: [
                    {
                        uri: rootUri,
                        name: folderName
                    }
                ],
                capabilities: {
                    workspace: {
                        applyEdit: true,
                        workspaceEdit: {
                            documentChanges: true,
                            resourceOperations: ["create", "rename", "delete"]
                        },
                        didChangeConfiguration: { dynamicRegistration: false },
                        didChangeWatchedFiles: { dynamicRegistration: false },
                        symbol: {
                            dynamicRegistration: false,
                            symbolKind: {
                                valueSet: [
                                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                                    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26
                                ]
                            }
                        },
                        workspaceFolders: true,
                        configuration: true
                    },
                    textDocument: {
                        synchronization: {
                            dynamicRegistration: false,
                            willSave: false,
                            willSaveWaitUntil: false,
                            didSave: true
                        },
                        completion: {
                            dynamicRegistration: false,
                            completionItem: {
                                snippetSupport: true,
                                commitCharactersSupport: true,
                                documentationFormat: ["markdown", "plaintext"],
                                deprecatedSupport: true,
                                preselectSupport: true,
                                tagSupport: { valueSet: [1] }
                            },
                            completionItemKind: {
                                valueSet: [
                                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                                    16, 17, 18, 19, 20, 21, 22, 23, 24, 25
                                ]
                            },
                            contextSupport: true
                        },
                        hover: {
                            dynamicRegistration: false,
                            contentFormat: ["markdown", "plaintext"]
                        },
                        signatureHelp: {
                            dynamicRegistration: false,
                            signatureInformation: {
                                documentationFormat: ["markdown", "plaintext"],
                                parameterInformation: { labelOffsetSupport: true }
                            }
                        },
                        definition: {
                            dynamicRegistration: false,
                            linkSupport: true
                        },
                        implementation: {
                            dynamicRegistration: false,
                            linkSupport: true
                        },
                        references: {
                            dynamicRegistration: false
                        },
                        documentSymbol: {
                            dynamicRegistration: false,
                            hierarchicalDocumentSymbolSupport: true,
                            symbolKind: {
                                valueSet: [
                                    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
                                    16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26
                                ]
                            }
                        },
                        codeAction: {
                            dynamicRegistration: false,
                            codeActionLiteralSupport: {
                                codeActionKind: {
                                    valueSet: [
                                        "",
                                        "quickfix",
                                        "refactor",
                                        "refactor.extract",
                                        "refactor.inline",
                                        "refactor.rewrite",
                                        "source",
                                        "source.organizeImports"
                                    ]
                                }
                            }
                        },
                        formatting: { dynamicRegistration: false },
                        rangeFormatting: { dynamicRegistration: false },
                        rename: {
                            dynamicRegistration: false,
                            prepareSupport: true
                        },
                        publishDiagnostics: {
                            relatedInformation: true,
                            tagSupport: { valueSet: [1, 2] },
                            versionSupport: true
                        }
                    }
                },
                initializationOptions: {}
            };

            const result = await this.sendRequest("initialize", initParams, 20000);
            this.serverCapabilities = result?.capabilities || {};
            await this.sendNotification("initialized", {});

            this.setStatus("ready");
            console.log(`[LSP ${this.serverId}] Initialized with capabilities:`, this.serverCapabilities);
            return true;
        } catch (err: any) {
            console.error(`[LSP ${this.serverId}] Initialization failed:`, err);
            this.setStatus("error", err.message);
            return false;
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Document Synchronization
    |--------------------------------------------------------------------------
    */
    public didOpen(uri: string, languageId: string, version: number, text: string) {
        if (this.status !== "ready") return;
        this.openDocuments.set(uri, { version, languageId });
        void this.sendNotification("textDocument/didOpen", {
            textDocument: {
                uri,
                languageId,
                version,
                text
            }
        });
    }

    public didChange(uri: string, version: number, content: string) {
        if (this.status !== "ready") return;
        const entry = this.openDocuments.get(uri);
        if (!entry) {
            return;
        }
        entry.version = version;
        void this.sendNotification("textDocument/didChange", {
            textDocument: {
                uri,
                version
            },
            contentChanges: [
                {
                    text: content
                }
            ]
        });
    }

    public didSave(uri: string, text?: string) {
        if (this.status !== "ready") return;
        void this.sendNotification("textDocument/didSave", {
            textDocument: {
                uri
            },
            ...(text !== undefined ? { text } : {})
        });
    }

    public didClose(uri: string) {
        if (this.status !== "ready") return;
        if (this.openDocuments.has(uri)) {
            this.openDocuments.delete(uri);
            void this.sendNotification("textDocument/didClose", {
                textDocument: {
                    uri
                }
            });
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Shutdown
    |--------------------------------------------------------------------------
    */
    public async shutdown(): Promise<void> {
        if (this.status === "stopped") return;

        try {
            if (this.status === "ready") {
                await this.sendRequest("shutdown", null, 3000);
                await this.sendNotification("exit", null);
            }
        } catch (e) {
            // ignore timeout during shutdown
        } finally {
            this.setStatus("stopped");
            this.pendingRequests.forEach((req) => {
                clearTimeout(req.timer);
                req.reject(new Error("LSP client shut down"));
            });
            this.pendingRequests.clear();
            this.openDocuments.clear();

            if (window.craftale?.lsp) {
                await window.craftale.lsp.stopServer(this.serverId);
            }
        }
    }
}
