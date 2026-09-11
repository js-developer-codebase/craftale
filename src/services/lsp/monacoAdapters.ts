import * as monaco from "monaco-editor";
import { lspManager } from "./LspClientManager";
import {
    pathToUri,
    toLspPosition,
    toLspRange,
    toMonacoPosition,
    toMonacoRange,
    SUPPORTED_LANGUAGES,
    LANGUAGE_TO_SERVER
} from "./protocol";
import {
    setFileDiagnostics,
    clearFileDiagnostics,
    updateServerStatus,
    type DiagnosticItem
} from "../../stores/lsp";
import { setLspFileProblems } from "../../stores/problems";

/*
|--------------------------------------------------------------------------
| Registration State
|--------------------------------------------------------------------------
*/

let registered = false;
const disposables: monaco.IDisposable[] = [];

/*
|--------------------------------------------------------------------------
| Kind Converters
|--------------------------------------------------------------------------
*/

function toMonacoCompletionKind(kind?: number): monaco.languages.CompletionItemKind {
    if (!kind) return monaco.languages.CompletionItemKind.Text;
    // LSP and Monaco align closely, clamp to range
    if (kind >= 1 && kind <= 25) {
        return (kind - 1) as monaco.languages.CompletionItemKind;
    }
    return monaco.languages.CompletionItemKind.Property;
}

function toMonacoSymbolKind(kind?: number): monaco.languages.SymbolKind {
    if (!kind) return monaco.languages.SymbolKind.Variable;
    if (kind >= 1 && kind <= 26) {
        return (kind - 1) as monaco.languages.SymbolKind;
    }
    return monaco.languages.SymbolKind.Variable;
}

function toMonacoMarkerSeverity(severity?: number): monaco.MarkerSeverity {
    switch (severity) {
        case 1:
            return monaco.MarkerSeverity.Error;
        case 2:
            return monaco.MarkerSeverity.Warning;
        case 3:
            return monaco.MarkerSeverity.Info;
        case 4:
            return monaco.MarkerSeverity.Hint;
        default:
            return monaco.MarkerSeverity.Info;
    }
}

function toDiagnosticSeverity(severity?: number): "error" | "warning" | "info" | "hint" {
    switch (severity) {
        case 1:
            return "error";
        case 2:
            return "warning";
        case 3:
            return "info";
        case 4:
            return "hint";
        default:
            return "info";
    }
}

/*
|--------------------------------------------------------------------------
| Setup Diagnostics Listener
|--------------------------------------------------------------------------
*/

function setupDiagnosticsListener() {
    const servers = ["typescript", "html", "css", "json", "svelte"];

    for (const serverId of servers) {
        const client = lspManager.getClient(serverId);

        // Update server status in store
        client.onStatus((status, error) => {
            updateServerStatus(serverId, status, error);
        });

        // Listen for publishDiagnostics notifications
        client.onNotification("textDocument/publishDiagnostics", (params: {
            uri: string;
            diagnostics: Array<{
                range: { start: { line: number; character: number }; end: { line: number; character: number } };
                severity?: number;
                code?: string | number;
                source?: string;
                message: string;
            }>;
        }) => {
            if (!params || !params.uri) return;

            const uri = params.uri;
            const monacoUri = monaco.Uri.parse(uri);
            const model = monaco.editor.getModel(monacoUri);

            const markers: monaco.editor.IMarkerData[] = (params.diagnostics || []).map((diag) => {
                const range = toMonacoRange(diag.range);
                return {
                    severity: toMonacoMarkerSeverity(diag.severity),
                    message: diag.message,
                    startLineNumber: range.startLineNumber,
                    startColumn: range.startColumn,
                    endLineNumber: range.endLineNumber,
                    endColumn: range.endColumn,
                    source: diag.source || serverId,
                    code: diag.code !== undefined ? String(diag.code) : undefined
                };
            });

            if (model) {
                monaco.editor.setModelMarkers(model, `lsp-${serverId}`, markers);
            }

            const storeItems: DiagnosticItem[] = (params.diagnostics || []).map((diag) => ({
                severity: toDiagnosticSeverity(diag.severity),
                message: diag.message,
                line: diag.range.start.line + 1,
                column: diag.range.start.character + 1,
                endLine: diag.range.end.line + 1,
                endColumn: diag.range.end.character + 1,
                source: diag.source || serverId,
                code: diag.code
            }));

            setFileDiagnostics(uri, storeItems);
            setLspFileProblems(uri, storeItems);
        });
    }
}

/*
|--------------------------------------------------------------------------
| Register Providers for Supported Languages
|--------------------------------------------------------------------------
*/

export function registerMonacoLspAdapters() {
    if (registered) return;
    registered = true;

    // 1. Ensure Svelte language is registered in Monaco
    const allLangs = monaco.languages.getLanguages();
    if (!allLangs.some((l) => l.id === "svelte")) {
        monaco.languages.register({
            id: "svelte",
            extensions: [".svelte"],
            aliases: ["Svelte", "svelte"],
            mimetypes: ["text/x-svelte"]
        });
    }

    // 2. Disable default Monaco TS/JS semantic validation so our language server handles it
    if ((monaco.languages as any).typescript?.typescriptDefaults) {
        (monaco.languages as any).typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false
        });
        (monaco.languages as any).typescript.javascriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: true,
            noSyntaxValidation: false
        });
    }

    // 3. Setup diagnostics listener
    setupDiagnosticsListener();

    // 4. Register Monaco language providers for each supported language
    for (const languageId of SUPPORTED_LANGUAGES) {
        registerCompletionProvider(languageId);
        registerHoverProvider(languageId);
        registerDefinitionProvider(languageId);
        registerImplementationProvider(languageId);
        registerReferenceProvider(languageId);
        registerRenameProvider(languageId);
        registerSignatureHelpProvider(languageId);
        registerDocumentSymbolProvider(languageId);
        registerCodeActionProvider(languageId);
        registerFormattingProviders(languageId);
    }

    console.log("[LSP] Monaco LSP adapters registered for:", SUPPORTED_LANGUAGES);
}

/*
|--------------------------------------------------------------------------
| 1. Completion Provider
|--------------------------------------------------------------------------
*/
function registerCompletionProvider(languageId: string) {
    const disp = monaco.languages.registerCompletionItemProvider(languageId, {
        triggerCharacters: [".", '"', "'", "/", "@", "<", ":", "$", "-", "{"],
        async provideCompletionItems(model, position, context) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") {
                    return { suggestions: [] };
                }

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/completion", {
                    textDocument: { uri },
                    position: lspPos,
                    context: {
                        triggerKind: context.triggerKind === 1 ? 1 : 2,
                        triggerCharacter: context.triggerCharacter
                    }
                });

                if (!response) return { suggestions: [] };

                const rawItems = Array.isArray(response) ? response : response.items || [];
                const wordUntil = model.getWordUntilPosition(position);
                const defaultRange = new monaco.Range(
                    position.lineNumber,
                    wordUntil.startColumn,
                    position.lineNumber,
                    wordUntil.endColumn
                );

                const suggestions: monaco.languages.CompletionItem[] = rawItems.map((item: any) => {
                    const label = typeof item.label === "string" ? item.label : item.label?.label || "";
                    const insertText = item.insertText || label;
                    const isSnippet = item.insertTextFormat === 2;

                    let itemRange: monaco.IRange = defaultRange;
                    if (item.textEdit && item.textEdit.range) {
                        itemRange = toMonacoRange(item.textEdit.range);
                    }

                    const monacoItem: monaco.languages.CompletionItem = {
                        label: item.label,
                        kind: toMonacoCompletionKind(item.kind),
                        detail: item.detail,
                        documentation: item.documentation
                            ? typeof item.documentation === "string"
                                ? item.documentation
                                : { value: item.documentation.value }
                            : undefined,
                        insertText,
                        insertTextRules: isSnippet
                            ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                            : undefined,
                        range: itemRange,
                        sortText: item.sortText,
                        filterText: item.filterText || label
                    };

                    (monacoItem as any)._lspItem = item;
                    (monacoItem as any)._serverId = client.serverId;

                    return monacoItem;
                });

                return {
                    suggestions,
                    incomplete: !Array.isArray(response) && !!response.isIncomplete
                };
            } catch (err) {
                return { suggestions: [] };
            }
        },

        async resolveCompletionItem(item) {
            try {
                const lspItem = (item as any)._lspItem;
                const serverId = (item as any)._serverId;
                if (!lspItem || !serverId) return item;

                const client = lspManager.getClient(serverId);
                if (!client || client.status !== "ready") return item;

                const resolved = await client.sendRequest("completionItem/resolve", lspItem);
                if (resolved) {
                    if (resolved.detail) item.detail = resolved.detail;
                    if (resolved.documentation) {
                        item.documentation = typeof resolved.documentation === "string"
                            ? resolved.documentation
                            : { value: resolved.documentation.value };
                    }
                }
                return item;
            } catch {
                return item;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 2. Hover Provider
|--------------------------------------------------------------------------
*/
function registerHoverProvider(languageId: string) {
    const disp = monaco.languages.registerHoverProvider(languageId, {
        async provideHover(model, position) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/hover", {
                    textDocument: { uri },
                    position: lspPos
                });

                if (!response || !response.contents) return null;

                const contents: monaco.IMarkdownString[] = [];

                if (Array.isArray(response.contents)) {
                    for (const entry of response.contents) {
                        if (typeof entry === "string") {
                            contents.push({ value: entry });
                        } else if (entry && entry.value) {
                            contents.push({ value: entry.language ? `\`\`\`${entry.language}\n${entry.value}\n\`\`\`` : entry.value });
                        }
                    }
                } else if (typeof response.contents === "string") {
                    contents.push({ value: response.contents });
                } else if (response.contents.value) {
                    contents.push({ value: response.contents.value });
                }

                return {
                    contents,
                    range: response.range ? toMonacoRange(response.range) : undefined
                };
            } catch {
                return null;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 3. Definition Provider
|--------------------------------------------------------------------------
*/
function registerDefinitionProvider(languageId: string) {
    const disp = monaco.languages.registerDefinitionProvider(languageId, {
        async provideDefinition(model, position) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/definition", {
                    textDocument: { uri },
                    position: lspPos
                });

                if (!response) return null;

                return mapLocations(response);
            } catch {
                return null;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 4. Implementation Provider
|--------------------------------------------------------------------------
*/
function registerImplementationProvider(languageId: string) {
    const disp = monaco.languages.registerImplementationProvider(languageId, {
        async provideImplementation(model, position) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/implementation", {
                    textDocument: { uri },
                    position: lspPos
                });

                if (!response) return null;

                return mapLocations(response);
            } catch {
                return null;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 5. Reference Provider
|--------------------------------------------------------------------------
*/
function registerReferenceProvider(languageId: string) {
    const disp = monaco.languages.registerReferenceProvider(languageId, {
        async provideReferences(model, position, context) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return [];

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/references", {
                    textDocument: { uri },
                    position: lspPos,
                    context: {
                        includeDeclaration: context.includeDeclaration
                    }
                });

                if (!response || !Array.isArray(response)) return [];

                return response.map((loc: any) => ({
                    uri: monaco.Uri.parse(loc.uri),
                    range: toMonacoRange(loc.range)
                }));
            } catch {
                return [];
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 6. Rename Provider
|--------------------------------------------------------------------------
*/
function registerRenameProvider(languageId: string) {
    const disp = monaco.languages.registerRenameProvider(languageId, {
        async provideRenameEdits(model, position, newName) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/rename", {
                    textDocument: { uri },
                    position: lspPos,
                    newName
                });

                if (!response) return null;

                return mapWorkspaceEdit(response);
            } catch (err: any) {
                return {
                    edits: [],
                    rejectReason: err.message || "Rename failed"
                };
            }
        },

        async resolveRenameLocation(model, position) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/prepareRename", {
                    textDocument: { uri },
                    position: lspPos
                });

                if (!response) return null;

                if (response.range) {
                    return {
                        range: toMonacoRange(response.range),
                        text: response.placeholder || ""
                    };
                }

                return {
                    range: toMonacoRange(response),
                    text: ""
                };
            } catch {
                return null;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 7. Signature Help Provider
|--------------------------------------------------------------------------
*/
function registerSignatureHelpProvider(languageId: string) {
    const disp = monaco.languages.registerSignatureHelpProvider(languageId, {
        signatureHelpTriggerCharacters: ["(", ","],
        signatureHelpRetriggerCharacters: [","],
        async provideSignatureHelp(model, position) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return null;

                const uri = model.uri.toString();
                const lspPos = toLspPosition(position);

                const response = await client.sendRequest("textDocument/signatureHelp", {
                    textDocument: { uri },
                    position: lspPos
                });

                if (!response || !response.signatures || response.signatures.length === 0) {
                    return null;
                }

                const signatures: monaco.languages.SignatureInformation[] = response.signatures.map(
                    (sig: any) => ({
                        label: sig.label,
                        documentation: sig.documentation
                            ? typeof sig.documentation === "string"
                                ? sig.documentation
                                : { value: sig.documentation.value }
                            : undefined,
                        parameters: (sig.parameters || []).map((p: any) => ({
                            label: p.label,
                            documentation: p.documentation
                                ? typeof p.documentation === "string"
                                    ? p.documentation
                                    : { value: p.documentation.value }
                                : undefined
                        }))
                    })
                );

                return {
                    value: {
                        signatures,
                        activeSignature: response.activeSignature || 0,
                        activeParameter: response.activeParameter || 0
                    },
                    dispose: () => {}
                };
            } catch {
                return null;
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 8. Document Symbol Provider
|--------------------------------------------------------------------------
*/
function registerDocumentSymbolProvider(languageId: string) {
    const disp = monaco.languages.registerDocumentSymbolProvider(languageId, {
        async provideDocumentSymbols(model) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return [];

                const uri = model.uri.toString();

                const response = await client.sendRequest("textDocument/documentSymbol", {
                    textDocument: { uri }
                });

                if (!response || !Array.isArray(response)) return [];

                return mapDocumentSymbols(response);
            } catch {
                return [];
            }
        }
    });

    disposables.push(disp);
}

function mapDocumentSymbols(symbols: any[]): monaco.languages.DocumentSymbol[] {
    return symbols.map((sym) => {
        const range = toMonacoRange(sym.range || sym.location?.range);
        const selectionRange = sym.selectionRange
            ? toMonacoRange(sym.selectionRange)
            : range;

        const docSym: monaco.languages.DocumentSymbol = {
            name: sym.name,
            detail: sym.detail || "",
            kind: toMonacoSymbolKind(sym.kind),
            tags: [],
            range,
            selectionRange,
            children: sym.children ? mapDocumentSymbols(sym.children) : []
        };

        return docSym;
    });
}

/*
|--------------------------------------------------------------------------
| 9. Code Action Provider
|--------------------------------------------------------------------------
*/
function registerCodeActionProvider(languageId: string) {
    const disp = monaco.languages.registerCodeActionProvider(languageId, {
        async provideCodeActions(model, range, context) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") {
                    return { actions: [], dispose: () => {} };
                }

                const uri = model.uri.toString();
                const lspRange = toLspRange(range);

                const lspDiagnostics = (context.markers || []).map((m) => ({
                    range: toLspRange(m),
                    message: m.message,
                    severity: m.severity === monaco.MarkerSeverity.Error ? 1 : 2,
                    code: m.code ? String(m.code) : undefined,
                    source: m.source
                }));

                const response = await client.sendRequest("textDocument/codeAction", {
                    textDocument: { uri },
                    range: lspRange,
                    context: {
                        diagnostics: lspDiagnostics,
                        only: context.only ? [context.only] : undefined
                    }
                });

                if (!response || !Array.isArray(response)) {
                    return { actions: [], dispose: () => {} };
                }

                const actions: monaco.languages.CodeAction[] = response.map((action: any) => {
                    const edit = action.edit ? mapWorkspaceEdit(action.edit) : undefined;
                    return {
                        title: action.title,
                        kind: action.kind,
                        diagnostics: context.markers,
                        isPreferred: !!action.isPreferred,
                        edit,
                        command: action.command
                            ? {
                                  id: action.command.command,
                                  title: action.command.title,
                                  arguments: action.command.arguments
                              }
                            : undefined
                    };
                });

                return {
                    actions,
                    dispose: () => {}
                };
            } catch {
                return { actions: [], dispose: () => {} };
            }
        }
    });

    disposables.push(disp);
}

/*
|--------------------------------------------------------------------------
| 10. Formatting Providers (Document & Range)
|--------------------------------------------------------------------------
*/
function registerFormattingProviders(languageId: string) {
    // Document Formatting
    const dispDoc = monaco.languages.registerDocumentFormattingEditProvider(languageId, {
        async provideDocumentFormattingEdits(model, options) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return [];

                const uri = model.uri.toString();

                const response = await client.sendRequest("textDocument/formatting", {
                    textDocument: { uri },
                    options: {
                        tabSize: options.tabSize,
                        insertSpaces: options.insertSpaces
                    }
                });

                if (!response || !Array.isArray(response)) return [];

                return response.map((edit: any) => ({
                    range: toMonacoRange(edit.range),
                    text: edit.newText
                }));
            } catch {
                return [];
            }
        }
    });

    // Range Formatting
    const dispRange = monaco.languages.registerDocumentRangeFormattingEditProvider(languageId, {
        async provideDocumentRangeFormattingEdits(model, range, options) {
            try {
                const client = await lspManager.getClientForLanguage(languageId);
                if (!client || client.status !== "ready") return [];

                const uri = model.uri.toString();
                const lspRange = toLspRange(range);

                const response = await client.sendRequest("textDocument/rangeFormatting", {
                    textDocument: { uri },
                    range: lspRange,
                    options: {
                        tabSize: options.tabSize,
                        insertSpaces: options.insertSpaces
                    }
                });

                if (!response || !Array.isArray(response)) return [];

                return response.map((edit: any) => ({
                    range: toMonacoRange(edit.range),
                    text: edit.newText
                }));
            } catch {
                return [];
            }
        }
    });

    disposables.push(dispDoc, dispRange);
}

/*
|--------------------------------------------------------------------------
| 11. Workspace Symbols Helper
|--------------------------------------------------------------------------
*/
export async function queryWorkspaceSymbols(query: string): Promise<Array<{
    name: string;
    kind: monaco.languages.SymbolKind;
    containerName?: string;
    uri: string;
    range: monaco.Range;
}>> {
    const clients = lspManager.getAllClients().filter((c) => c.status === "ready");
    const results: Array<{
        name: string;
        kind: monaco.languages.SymbolKind;
        containerName?: string;
        uri: string;
        range: monaco.Range;
    }> = [];

    for (const client of clients) {
        try {
            const res = await client.sendRequest("workspace/symbol", { query });
            if (Array.isArray(res)) {
                for (const item of res) {
                    const uri = item.location?.uri || (item as any).uri;
                    const lspRange = item.location?.range || (item as any).range;
                    if (uri && lspRange) {
                        results.push({
                            name: item.name,
                            kind: toMonacoSymbolKind(item.kind),
                            containerName: item.containerName,
                            uri,
                            range: toMonacoRange(lspRange)
                        });
                    }
                }
            }
        } catch {
            // Ignore errors from specific servers during workspace symbols search
        }
    }

    return results;
}

/*
|--------------------------------------------------------------------------
| Helper: Map Locations / LocationLinks
|--------------------------------------------------------------------------
*/
function mapLocations(response: any): monaco.languages.Definition | null {
    if (Array.isArray(response)) {
        if (response.length === 0) return null;
        return response.map((loc: any) => {
            if (loc.targetUri) {
                // LocationLink
                return {
                    uri: monaco.Uri.parse(loc.targetUri),
                    range: toMonacoRange(loc.targetRange),
                    originSelectionRange: loc.originSelectionRange
                        ? toMonacoRange(loc.originSelectionRange)
                        : undefined
                };
            }
            return {
                uri: monaco.Uri.parse(loc.uri),
                range: toMonacoRange(loc.range)
            };
        });
    } else if (response && response.uri) {
        return {
            uri: monaco.Uri.parse(response.uri),
            range: toMonacoRange(response.range)
        };
    } else if (response && response.targetUri) {
        return {
            uri: monaco.Uri.parse(response.targetUri),
            range: toMonacoRange(response.targetRange)
        };
    }
    return null;
}

/*
|--------------------------------------------------------------------------
| Helper: Map WorkspaceEdit
|--------------------------------------------------------------------------
*/
function mapWorkspaceEdit(edit: any): monaco.languages.WorkspaceEdit {
    const edits: monaco.languages.IWorkspaceTextEdit[] = [];

    if (edit.changes) {
        for (const [uriStr, textEdits] of Object.entries<any[]>(edit.changes)) {
            const resource = monaco.Uri.parse(uriStr);
            for (const te of textEdits) {
                edits.push({
                    resource,
                    textEdit: {
                        range: toMonacoRange(te.range),
                        text: te.newText
                    },
                    versionId: undefined
                });
            }
        }
    }

    if (edit.documentChanges && Array.isArray(edit.documentChanges)) {
        for (const change of edit.documentChanges) {
            if (change.textDocument && change.edits) {
                const resource = monaco.Uri.parse(change.textDocument.uri);
                for (const te of change.edits) {
                    edits.push({
                        resource,
                        textEdit: {
                            range: toMonacoRange(te.range),
                            text: te.newText
                        },
                        versionId: change.textDocument.version
                    });
                }
            }
        }
    }

    return { edits };
}
