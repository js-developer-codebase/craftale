import { LspClient, type ClientStatus } from "./LspClient";
import {
    getLanguageIdFromPath,
    getServerIdFromLanguageId,
    pathToUri,
    SUPPORTED_LANGUAGES
} from "./protocol";

export interface DocumentRecord {
    filePath: string;
    uri: string;
    languageId: string;
    serverId: string;
    version: number;
    content: string;
}

class LspClientManagerClass {
    private clients = new Map<string, LspClient>();
    private openDocuments = new Map<string, DocumentRecord>(); // normalized path -> record
    private workspacePath: string | null = null;
    private initialized = false;
    private unsubIpcMessage: (() => void) | null = null;
    private unsubIpcStatus: (() => void) | null = null;

    private normalize(p: string): string {
        return p.replace(/\\/g, "/").toLowerCase();
    }

    public init(workspacePath: string | null) {
        this.workspacePath = workspacePath;

        if (this.initialized) return;
        this.initialized = true;

        if (typeof window !== "undefined" && window.craftale?.lsp) {
            this.unsubIpcMessage = window.craftale.lsp.onMessage(({ serverId, message }) => {
                const client = this.clients.get(serverId);
                if (client) {
                    client.handleMessage(message);
                }
            });

            this.unsubIpcStatus = window.craftale.lsp.onStatusChange(({ serverId, status, error }) => {
                console.log(`[LSP Manager] Server ${serverId} status: ${status}`, error || "");
                const client = this.clients.get(serverId);
                if (client && status === "stopped" && client.status === "ready") {
                    // Server crashed or exited unexpectedly
                    console.warn(`[LSP Manager] Server ${serverId} exited unexpectedly`);
                }
            });
        }
    }

    public async setWorkspace(newWorkspace: string | null) {
        if (this.workspacePath === newWorkspace) return;
        this.workspacePath = newWorkspace;

        if (!newWorkspace) {
            await this.shutdownAll();
            return;
        }

        // Restart active clients in the new workspace
        for (const [id, client] of this.clients.entries()) {
            if (client.status === "ready") {
                await client.shutdown();
                await client.startAndInitialize(newWorkspace);
            }
        }

        // Re-sync all currently open documents
        for (const doc of this.openDocuments.values()) {
            const client = this.clients.get(doc.serverId);
            if (client && client.status === "ready") {
                doc.version = 1;
                client.didOpen(doc.uri, doc.languageId, doc.version, doc.content);
            }
        }
    }

    public getClient(serverId: string): LspClient {
        let client = this.clients.get(serverId);
        if (!client) {
            client = new LspClient(serverId);
            this.clients.set(serverId, client);
        }
        return client;
    }

    public async ensureClientForServer(serverId: string): Promise<LspClient | null> {
        const client = this.getClient(serverId);
        if (client.status === "ready") {
            return client;
        }

        if (client.status === "starting") {
            // Wait up to 10 seconds for starting to finish
            const startTime = Date.now();
            while (client.status === "starting" && Date.now() - startTime < 10000) {
                await new Promise((r) => setTimeout(r, 100));
            }
            return client.status === "ready" ? client : null;
        }

        const ws = this.workspacePath || (typeof window !== "undefined" ? "" : "");
        const success = await client.startAndInitialize(ws);
        return success ? client : null;
    }

    public async getClientForLanguage(languageId: string): Promise<LspClient | null> {
        const serverId = getServerIdFromLanguageId(languageId);
        if (!serverId) return null;
        return this.ensureClientForServer(serverId);
    }

    public async getClientForPath(filePath: string): Promise<LspClient | null> {
        const langId = getLanguageIdFromPath(filePath);
        return this.getClientForLanguage(langId);
    }

    public getAllClients(): LspClient[] {
        return Array.from(this.clients.values());
    }

    /*
    |--------------------------------------------------------------------------
    | Document Synchronization
    |--------------------------------------------------------------------------
    */
    public async notifyDocumentOpen(filePath: string, languageId: string, content: string) {
        if (!filePath) return;
        const key = this.normalize(filePath);
        const serverId = getServerIdFromLanguageId(languageId);
        if (!serverId) return;

        const uri = pathToUri(filePath);
        const record: DocumentRecord = {
            filePath,
            uri,
            languageId,
            serverId,
            version: 1,
            content
        };
        this.openDocuments.set(key, record);

        const client = await this.ensureClientForServer(serverId);
        if (client && client.status === "ready") {
            client.didOpen(uri, languageId, record.version, content);
        }
    }

    public notifyDocumentChange(filePath: string, content: string) {
        if (!filePath) return;
        const key = this.normalize(filePath);
        const record = this.openDocuments.get(key);
        if (!record) return;

        record.version++;
        record.content = content;

        const client = this.clients.get(record.serverId);
        if (client && client.status === "ready") {
            client.didChange(record.uri, record.version, content);
        }
    }

    public notifyDocumentSave(filePath: string, content?: string) {
        if (!filePath) return;
        const key = this.normalize(filePath);
        const record = this.openDocuments.get(key);
        if (!record) return;

        if (content !== undefined) {
            record.content = content;
        }

        const client = this.clients.get(record.serverId);
        if (client && client.status === "ready") {
            client.didSave(record.uri, content);
        }
    }

    public notifyDocumentClose(filePath: string) {
        if (!filePath) return;
        const key = this.normalize(filePath);
        const record = this.openDocuments.get(key);
        if (!record) return;

        this.openDocuments.delete(key);

        const client = this.clients.get(record.serverId);
        if (client && client.status === "ready") {
            client.didClose(record.uri);
        }
    }

    /*
    |--------------------------------------------------------------------------
    | Server Control
    |--------------------------------------------------------------------------
    */
    public async restartServer(serverId: string): Promise<boolean> {
        const client = this.clients.get(serverId);
        if (client) {
            await client.shutdown();
        }

        const newClient = new LspClient(serverId);
        this.clients.set(serverId, newClient);

        const ws = this.workspacePath || "";
        const started = await newClient.startAndInitialize(ws);

        if (started) {
            // Re-open all documents belonging to this server
            for (const doc of this.openDocuments.values()) {
                if (doc.serverId === serverId) {
                    doc.version = 1;
                    newClient.didOpen(doc.uri, doc.languageId, doc.version, doc.content);
                }
            }
        }

        return started;
    }

    public async shutdownAll() {
        for (const client of this.clients.values()) {
            await client.shutdown();
        }
        this.clients.clear();
        this.openDocuments.clear();

        if (this.unsubIpcMessage) {
            this.unsubIpcMessage();
            this.unsubIpcMessage = null;
        }
        if (this.unsubIpcStatus) {
            this.unsubIpcStatus();
            this.unsubIpcStatus = null;
        }
        this.initialized = false;
    }
}

export const lspManager = new LspClientManagerClass();
