<script lang="ts">

    import { onMount, tick } from "svelte";
    import {
        quickOpenState,
        closeQuickOpen,
        mruFiles,
        activeDocumentSymbols,
        recordNavigationPoint,
        requestJump,
        type QuickOpenMode
    } from "../stores/navigation";
    import {
        workspacePath,
        openedFiles,
        activeFile,
        openFile,
        activateFile,
        pathsEqual
    } from "../stores/workspace";
    import {
        getSymbolIcon,
        getSymbolKindLabel,
        type DocumentSymbolItem,
        type SymbolKind
    } from "../utils/symbols";

    interface Props {
        onJumpToLine?: (line: number, column?: number, preview?: boolean) => void;
        onRestoreCursor?: () => void;
    }

    let { onJumpToLine, onRestoreCursor }: Props = $props();

    interface FileResult {
        name: string;
        path: string;
        relativePath: string;
        extension: string;
        isMru?: boolean;
        isOpen?: boolean;
    }

    let inputElement = $state<HTMLInputElement | null>(null);
    let query = $state("");
    let selectedIndex = $state(0);
    let listElement = $state<HTMLDivElement | null>(null);

    let allWorkspaceFiles = $state<FileResult[]>([]);
    let isScanningFiles = $state(false);

    /*
    |--------------------------------------------------------------------------
    | Active Mode Derived from Query Prefix
    |--------------------------------------------------------------------------
    */

    let currentMode = $derived.by<QuickOpenMode>(() => {

        const q = query.trimStart();

        if (q.startsWith(":")) return "line";

        if (q.startsWith("@")) return "symbol";

        return "file";

    });

    /*
    |--------------------------------------------------------------------------
    | Watch Visibility & Reset
    |--------------------------------------------------------------------------
    */

    $effect(() => {

        if ($quickOpenState.visible) {

            if ($quickOpenState.mode === "line") {

                query = ":";

            } else if ($quickOpenState.mode === "symbol") {

                query = "@";

            } else {

                query = $quickOpenState.initialQuery || "";

            }

            selectedIndex = 0;

            loadWorkspaceFiles();

            void tick().then(() => {

                if (inputElement) {

                    inputElement.focus();

                    inputElement.setSelectionRange(query.length, query.length);

                }

            });

        } else {

            query = "";

            selectedIndex = 0;

        }

    });

    /*
    |--------------------------------------------------------------------------
    | Load Workspace Files
    |--------------------------------------------------------------------------
    */

    async function loadWorkspaceFiles() {

        if (!$workspacePath || !window.craftale?.filesystem?.listFiles) return;

        isScanningFiles = true;

        try {

            const files = await window.craftale.filesystem.listFiles($workspacePath);

            allWorkspaceFiles = files;

        } catch (err) {

            console.error("[QUICK OPEN] Failed to list files:", err);

        } finally {

            isScanningFiles = false;

        }

    }

    /*
    |--------------------------------------------------------------------------
    | Filtered File Results
    |--------------------------------------------------------------------------
    */

    let filteredFiles = $derived.by<FileResult[]>(() => {

        if (currentMode !== "file") return [];

        const q = query.trim().toLowerCase();

        if (!q) {

            /* Show MRU and currently opened files first */
            const openMap = new Set($openedFiles.map((f) => f.path.toLowerCase()));

            const results: FileResult[] = [];

            const seen = new Set<string>();


            for (const mruPath of $mruFiles) {

                const lower = mruPath.toLowerCase();

                if (!seen.has(lower)) {

                    seen.add(lower);

                    const name = mruPath.split(/[\\/]/).pop() || mruPath;

                    const rel = $workspacePath ? mruPath.replace($workspacePath, "").replace(/^[\\/]/, "") : name;

                    results.push({
                        name,
                        path: mruPath,
                        relativePath: rel.replace(/\\/g, "/"),
                        extension: name.split(".").pop() || "",
                        isMru: true,
                        isOpen: openMap.has(lower)
                    });

                }

            }

            for (const openFileItem of $openedFiles) {

                const lower = openFileItem.path.toLowerCase();

                if (!seen.has(lower)) {

                    seen.add(lower);

                    const rel = $workspacePath ? openFileItem.path.replace($workspacePath, "").replace(/^[\\/]/, "") : openFileItem.name;

                    results.push({
                        name: openFileItem.name,
                        path: openFileItem.path,
                        relativePath: rel.replace(/\\/g, "/"),
                        extension: openFileItem.name.split(".").pop() || "",
                        isMru: false,
                        isOpen: true
                    });

                }

            }

            return results.slice(0, 30);

        }

        /* Filter by search query with scoring */

        const scored: { item: FileResult; score: number }[] = [];

        for (const file of allWorkspaceFiles) {

            const nameLower = file.name.toLowerCase();

            const pathLower = file.relativePath.toLowerCase();


            if (nameLower === q) {

                scored.push({ item: file, score: 100 });

            } else if (nameLower.startsWith(q)) {

                scored.push({ item: file, score: 80 });

            } else if (nameLower.includes(q)) {

                scored.push({ item: file, score: 60 });

            } else if (pathLower.includes(q)) {

                scored.push({ item: file, score: 40 });

            } else if (fuzzyMatch(q, nameLower)) {

                scored.push({ item: file, score: 20 });

            }

        }

        scored.sort((a, b) => b.score - a.score);

        return scored.slice(0, 40).map((s) => s.item);

    });

    function fuzzyMatch(needle: string, haystack: string): boolean {

        let nIdx = 0;

        let hIdx = 0;

        while (nIdx < needle.length && hIdx < haystack.length) {

            if (needle[nIdx] === haystack[hIdx]) {

                nIdx++;

            }

            hIdx++;

        }

        return nIdx === needle.length;

    }

    /*
    |--------------------------------------------------------------------------
    | Parsed Line & Column
    |--------------------------------------------------------------------------
    */

    let lineResult = $derived.by<{ line: number; column: number; valid: boolean } | null>(() => {

        if (currentMode !== "line") return null;

        const stripped = query.replace(/^:/, "").trim();

        if (!stripped) {

            return { line: 1, column: 1, valid: false };

        }

        const parts = stripped.split(":");

        const line = parseInt(parts[0], 10);

        const column = parts.length > 1 ? parseInt(parts[1], 10) : 1;


        if (!isNaN(line) && line > 0) {

            return {
                line,
                column: !isNaN(column) && column > 0 ? column : 1,
                valid: true
            };

        }

        return { line: 1, column: 1, valid: false };

    });

    /* Live preview target line as user types in line mode */
    $effect(() => {

        if (currentMode === "line" && lineResult?.valid && onJumpToLine) {

            onJumpToLine(lineResult.line, lineResult.column, true);

        }

    });

    /*
    |--------------------------------------------------------------------------
    | Filtered Symbols
    |--------------------------------------------------------------------------
    */

    let filteredSymbols = $derived.by<{ symbol: DocumentSymbolItem; category?: string }[]>(() => {

        if (currentMode !== "symbol") return [];

        const raw = query.replace(/^@/, "").trim();

        const isCategorized = raw.startsWith(":");

        const filterText = (isCategorized ? raw.replace(/^:/, "") : raw).toLowerCase();

        const symbols = $activeDocumentSymbols;

        if (!filterText) {

            return symbols.map((s) => ({
                symbol: s,
                category: getSymbolKindLabel(s.kind)
            }));

        }

        const matches: { symbol: DocumentSymbolItem; category?: string }[] = [];

        for (const sym of symbols) {

            const nameLower = sym.name.toLowerCase();

            const containerLower = (sym.containerName || "").toLowerCase();

            const kindLabel = getSymbolKindLabel(sym.kind).toLowerCase();


            if (isCategorized) {

                if (kindLabel.startsWith(filterText) || nameLower.includes(filterText)) {

                    matches.push({ symbol: sym, category: getSymbolKindLabel(sym.kind) });

                }

            } else {

                if (nameLower.includes(filterText) || containerLower.includes(filterText)) {

                    matches.push({ symbol: sym, category: getSymbolKindLabel(sym.kind) });

                }

            }

        }

        return matches;

    });

    /*
    |--------------------------------------------------------------------------
    | Active Results Count for Navigation
    |--------------------------------------------------------------------------
    */

    let currentItemCount = $derived.by(() => {

        if (currentMode === "file") return filteredFiles.length;

        if (currentMode === "symbol") return filteredSymbols.length;

        if (currentMode === "line") return lineResult?.valid ? 1 : 0;

        return 0;

    });

    /*
    |--------------------------------------------------------------------------
    | Keydown Navigation in List
    |--------------------------------------------------------------------------
    */

    function handleKeyDown(event: KeyboardEvent) {

        if (!$quickOpenState.visible) return;

        if (event.key === "Escape") {

            event.preventDefault();

            if (onRestoreCursor) onRestoreCursor();

            closeQuickOpen();

            return;

        }

        if (event.key === "ArrowDown") {

            event.preventDefault();

            if (currentItemCount > 0) {

                selectedIndex = (selectedIndex + 1) % currentItemCount;

                scrollSelectedIntoView();

            }

            return;

        }

        if (event.key === "ArrowUp") {

            event.preventDefault();

            if (currentItemCount > 0) {

                selectedIndex = (selectedIndex - 1 + currentItemCount) % currentItemCount;

                scrollSelectedIntoView();

            }

            return;

        }

        if (event.key === "Enter") {

            event.preventDefault();

            submitSelection();

            return;

        }

    }

    function scrollSelectedIntoView() {

        if (!listElement) return;

        const activeEl = listElement.querySelector(".quick-open-item.selected") as HTMLElement | null;

        if (activeEl) {

            activeEl.scrollIntoView({ block: "nearest" });

        }

    }

    /*
    |--------------------------------------------------------------------------
    | Action Submission
    |--------------------------------------------------------------------------
    */

    async function submitSelection() {

        if (currentMode === "file") {

            const selected = filteredFiles[selectedIndex];

            if (!selected) return;

            closeQuickOpen();

            /* Check if already open */
            const already = $openedFiles.find((f) => pathsEqual(f.path, selected.path));

            if (already) {

                activateFile(selected.path);

            } else {

                try {

                    const content = await window.craftale.filesystem.readFile(selected.path);

                    openFile(
                        {
                            name: selected.name,
                            path: selected.path,
                            content
                        },
                        { preview: false }
                    );

                } catch (err) {

                    console.error("[QUICK OPEN] Failed to open file:", err);

                }

            }

        } else if (currentMode === "line") {

            if (lineResult?.valid) {

                requestJump(lineResult.line, lineResult.column, undefined, false);

                if (onJumpToLine) {

                    onJumpToLine(lineResult.line, lineResult.column, false);

                }

            }

            closeQuickOpen();

        } else if (currentMode === "symbol") {

            const item = filteredSymbols[selectedIndex];

            if (item) {

                requestJump(item.symbol.line, item.symbol.column, undefined, false);

                if (onJumpToLine) {

                    onJumpToLine(item.symbol.line, item.symbol.column, false);

                }

            }

            closeQuickOpen();

        }

    }

    /* Helper for file icons */
    function getFileIcon(ext: string): string {

        switch (ext) {

            case "ts": return "🔷";

            case "js": return "🟨";

            case "svelte": return "🟧";

            case "json": return "📋";

            case "css": return "🎨";

            case "html": return "🌐";

            case "md": return "📝";

            case "py": return "🐍";

            default: return "📄";

        }

    }

</script>

<svelte:window onkeydown={handleKeyDown} />

{#if $quickOpenState.visible}

    <div
        class="quick-open-backdrop"
        role="presentation"
        onclick={(e) => {
            if (e.target === e.currentTarget) {
                if (onRestoreCursor) onRestoreCursor();
                closeQuickOpen();
            }
        }}
    >

        <div
            class="quick-open-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Quick Open"
        >

            <!-- Search Input Box -->

            <div class="quick-open-header">

                <span class="search-icon">
                    {#if currentMode === "line"}
                        :
                    {:else if currentMode === "symbol"}
                        @
                    {:else}
                        🔍
                    {/if}
                </span>

                <input
                    bind:this={inputElement}
                    type="text"
                    class="quick-open-input"
                    bind:value={query}
                    placeholder={
                        currentMode === "line"
                            ? "Type a line number to navigate to (e.g. 42 or 42:10)..."
                            : currentMode === "symbol"
                                ? "Type symbol name, or @: to group by category..."
                                : "Search files by name (type : for line, @ for symbol)..."
                    }
                />

                {#if isScanningFiles}
                    <span class="spinner" title="Indexing workspace files...">◌</span>
                {/if}

            </div>


            <!-- Results List -->

            <div
                bind:this={listElement}
                class="quick-open-results"
                role="listbox"
            >

                {#if currentMode === "file"}

                    {#if filteredFiles.length === 0}

                        <div class="empty-message">
                            No matching files found.
                        </div>

                    {:else}

                        {#each filteredFiles as file, index (file.path)}

                            <div
                                class="quick-open-item"
                                class:selected={selectedIndex === index}
                                role="option"
                                aria-selected={selectedIndex === index}
                                onclick={() => {
                                    selectedIndex = index;
                                    void submitSelection();
                                }}
                                onmouseenter={() => {
                                    selectedIndex = index;
                                }}
                            >

                                <span class="item-icon">
                                    {getFileIcon(file.extension)}
                                </span>

                                <div class="item-text">

                                    <span class="item-title">
                                        {file.name}
                                    </span>

                                    <span class="item-subtitle" title={file.relativePath}>
                                        {file.relativePath}
                                    </span>

                                </div>

                                {#if file.isOpen}
                                    <span class="item-badge open" title="Currently open in editor">open</span>
                                {:else if file.isMru}
                                    <span class="item-badge recent" title="Recently viewed">recent</span>
                                {/if}

                            </div>

                        {/each}

                    {/if}

                {:else if currentMode === "line"}

                    {#if lineResult?.valid}

                        <div
                            class="quick-open-item selected"
                            role="option"
                            aria-selected="true"
                            onclick={() => void submitSelection()}
                        >

                            <span class="item-icon">📍</span>

                            <div class="item-text">

                                <span class="item-title">
                                    Go to Line <strong>{lineResult.line}</strong>
                                    {#if lineResult.column > 1}
                                        : Column <strong>{lineResult.column}</strong>
                                    {/if}
                                </span>

                                <span class="item-subtitle">
                                    Press Enter to confirm, Escape to cancel
                                </span>

                            </div>

                            <span class="item-badge line">jump</span>

                        </div>

                    {:else}

                        <div class="empty-message">
                            Type a line number between 1 and the total lines in file.
                        </div>

                    {/if}

                {:else if currentMode === "symbol"}

                    {#if filteredSymbols.length === 0}

                        <div class="empty-message">
                            No symbols found in this file.
                        </div>

                    {:else}

                        {#each filteredSymbols as item, index (item.symbol.id || `${item.symbol.name}-${item.symbol.line}`)}

                            {@const iconMeta = getSymbolIcon(item.symbol.kind)}

                            <div
                                class="quick-open-item"
                                class:selected={selectedIndex === index}
                                role="option"
                                aria-selected={selectedIndex === index}
                                onclick={() => {
                                    selectedIndex = index;
                                    void submitSelection();
                                }}
                                onmouseenter={() => {
                                    selectedIndex = index;
                                }}
                            >

                                <span
                                    class="symbol-icon-badge"
                                    style="color: {iconMeta.color}; background: {iconMeta.bg};"
                                    title={item.symbol.kind}
                                >
                                    {iconMeta.text}
                                </span>

                                <div class="item-text">

                                    <span class="item-title">
                                        {item.symbol.name}

                                        {#if item.symbol.containerName}
                                            <span class="item-container">({item.symbol.containerName})</span>
                                        {/if}
                                    </span>

                                    {#if item.symbol.detail}
                                        <span class="item-subtitle" title={item.symbol.detail}>
                                            {item.symbol.detail}
                                        </span>
                                    {/if}

                                </div>

                                <span class="symbol-line" title="Line number">
                                    :{item.symbol.line}
                                </span>

                            </div>

                        {/each}

                    {/if}

                {/if}

            </div>


            <!-- Footer Shortcuts Hint -->

            <div class="quick-open-footer">

                <span class="hint">
                    <kbd>↑</kbd> <kbd>↓</kbd> to navigate
                </span>

                <span class="hint">
                    <kbd>↵</kbd> to select
                </span>

                <span class="hint">
                    <kbd>esc</kbd> to dismiss
                </span>

                <div class="spacer"></div>

                <span class="mode-hints">
                    <span class="mode-tag" class:active={currentMode === "file"}>Files</span>
                    <span class="mode-tag" class:active={currentMode === "line"}>:Line</span>
                    <span class="mode-tag" class:active={currentMode === "symbol"}>@Symbol</span>
                </span>

            </div>

        </div>

    </div>

{/if}

<style>

    /*
    |--------------------------------------------------------------------------
    | Backdrop
    |--------------------------------------------------------------------------
    */

    .quick-open-backdrop {

        position: fixed;

        inset: 0;

        background: rgba(0, 0, 0, 0.45);

        backdrop-filter: blur(2px);

        display: flex;

        justify-content: center;

        align-items: flex-start;

        padding-top: 50px;

        z-index: 9999;

        animation: fadeIn 0.12s cubic-bezier(0.16, 1, 0.3, 1);

    }

    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }


    /*
    |--------------------------------------------------------------------------
    | Modal Box
    |--------------------------------------------------------------------------
    */

    .quick-open-modal {

        width: 600px;

        max-width: 90vw;

        max-height: 520px;

        background: #252526;

        border: 1px solid #3c3c3c;

        border-radius: 8px;

        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05);

        display: flex;

        flex-direction: column;

        overflow: hidden;

        animation: slideDown 0.15s cubic-bezier(0.16, 1, 0.3, 1);

    }

    @keyframes slideDown {
        from {
            opacity: 0;
            transform: translateY(-12px) scale(0.98);
        }
        to {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Header & Input
    |--------------------------------------------------------------------------
    */

    .quick-open-header {

        display: flex;

        align-items: center;

        padding: 10px 14px;

        background: #1e1e1e;

        border-bottom: 1px solid #333333;

        gap: 10px;

    }

    .search-icon {

        font-size: 14px;

        color: #858585;

        user-select: none;

        min-width: 16px;

        text-align: center;

        font-weight: 700;

    }

    .quick-open-input {

        flex: 1;

        background: transparent;

        border: none;

        outline: none;

        color: #cccccc;

        font-size: 14px;

        font-family: inherit;

    }

    .quick-open-input::placeholder {

        color: #6e6e6e;

    }

    .spinner {

        color: #3b82f6;

        font-size: 14px;

        animation: spin 1s linear infinite;

    }

    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }


    /*
    |--------------------------------------------------------------------------
    | Results List
    |--------------------------------------------------------------------------
    */

    .quick-open-results {

        flex: 1;

        overflow-y: auto;

        max-height: 380px;

        padding: 6px;

    }

    .quick-open-results::-webkit-scrollbar {

        width: 6px;

    }

    .quick-open-results::-webkit-scrollbar-thumb {

        background: #3e3e42;

        border-radius: 3px;

    }

    .empty-message {

        padding: 24px;

        text-align: center;

        color: #777777;

        font-size: 13px;

    }


    /*
    |--------------------------------------------------------------------------
    | Item Row
    |--------------------------------------------------------------------------
    */

    .quick-open-item {

        display: flex;

        align-items: center;

        gap: 10px;

        padding: 7px 10px;

        border-radius: 5px;

        cursor: pointer;

        user-select: none;

        transition: background 0.08s ease;

    }

    .quick-open-item.selected {

        background: #04395e;

    }

    .quick-open-item:hover:not(.selected) {

        background: #2a2d2e;

    }

    .item-icon {

        font-size: 14px;

        width: 18px;

        text-align: center;

        flex-shrink: 0;

    }

    .item-text {

        flex: 1;

        display: flex;

        flex-direction: column;

        overflow: hidden;

        gap: 2px;

    }

    .item-title {

        font-size: 13px;

        color: #e2e8f0;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

    }

    .item-container {

        font-size: 11px;

        color: #94a3b8;

        margin-left: 6px;

    }

    .item-subtitle {

        font-size: 11px;

        color: #71717a;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

    }

    .quick-open-item.selected .item-subtitle {

        color: #a1a1aa;

    }

    .item-badge {

        font-size: 10px;

        padding: 2px 6px;

        border-radius: 10px;

        text-transform: uppercase;

        font-weight: 600;

        letter-spacing: 0.4px;

    }

    .item-badge.open {

        background: rgba(59, 130, 246, 0.2);

        color: #60a5fa;

    }

    .item-badge.recent {

        background: rgba(148, 163, 184, 0.15);

        color: #94a3b8;

    }

    .item-badge.line {

        background: rgba(74, 222, 128, 0.2);

        color: #4ade80;

    }

    .symbol-icon-badge {

        width: 18px;

        height: 18px;

        border-radius: 4px;

        display: flex;

        align-items: center;

        justify-content: center;

        font-size: 10px;

        font-weight: 700;

        flex-shrink: 0;

    }

    .symbol-line {

        font-size: 11px;

        color: #64748b;

        font-family: monospace;

    }


    /*
    |--------------------------------------------------------------------------
    | Footer Hints
    |--------------------------------------------------------------------------
    */

    .quick-open-footer {

        display: flex;

        align-items: center;

        padding: 6px 14px;

        background: #1c1c1c;

        border-top: 1px solid #2e2e2e;

        font-size: 11px;

        color: #71717a;

        gap: 12px;

    }

    .hint kbd {

        background: #2d2d30;

        border: 1px solid #454545;

        border-radius: 3px;

        padding: 1px 4px;

        font-family: monospace;

        font-size: 10px;

        color: #a1a1aa;

    }

    .spacer {

        flex: 1;

    }

    .mode-hints {

        display: flex;

        gap: 6px;

    }

    .mode-tag {

        padding: 1px 5px;

        border-radius: 3px;

        font-size: 10px;

        background: #27272a;

        color: #71717a;

    }

    .mode-tag.active {

        background: #0284c7;

        color: #ffffff;

        font-weight: 600;

    }

</style>
