<script lang="ts">

    import {
        activeFile,
        workspacePath,
        openFile,
        activateFile,
        pathsEqual
    } from "../stores/workspace";
    import {
        currentEnclosingSymbol,
        activeDocumentSymbols,
        canNavigateBack,
        canNavigateForward,
        stepBack,
        stepForward,
        requestJump,
        type LocationEntry
    } from "../stores/navigation";
    import {
        getSymbolIcon,
        type DocumentSymbolItem
    } from "../utils/symbols";

    interface Props {
        onJumpToSymbol?: (symbol: DocumentSymbolItem) => void;
        onNavigateLocation?: (location: LocationEntry) => void;
    }

    let { onJumpToSymbol, onNavigateLocation }: Props = $props();

    /*
    |--------------------------------------------------------------------------
    | Active Crumb Path Segments
    |--------------------------------------------------------------------------
    */

    interface BreadcrumbSegment {
        id: string;
        name: string;
        path: string;
        type: "workspace" | "folder" | "file" | "symbol";
        symbol?: DocumentSymbolItem;
    }

    let segments = $derived.by<BreadcrumbSegment[]>(() => {

        if (!$activeFile || !$workspacePath) return [];

        const root = $workspacePath;

        const fileP = $activeFile.path;

        const segs: BreadcrumbSegment[] = [];

        /* Root workspace crumb */

        const rootName = root.split(/[\\/]/).pop() || root;

        segs.push({
            id: "root",
            name: rootName,
            path: root,
            type: "workspace"
        });

        /* Subdirectory crumbs */

        const rel = fileP.replace(root, "").replace(/^[\\/]/, "");

        const parts = rel.split(/[\\/]/);

        let accumulated = root;

        for (let i = 0; i < parts.length - 1; i++) {

            const part = parts[i];

            accumulated = `${accumulated}/${part}`.replace(/\\/g, "/");

            segs.push({
                id: `dir-${i}-${part}`,
                name: part,
                path: accumulated,
                type: "folder"
            });

        }

        /* File crumb */

        segs.push({
            id: `file-${$activeFile.name}`,
            name: $activeFile.name,
            path: fileP,
            type: "file"
        });

        /* Current enclosing symbol crumb */

        if ($currentEnclosingSymbol) {

            segs.push({
                id: `sym-${$currentEnclosingSymbol.id}`,
                name: $currentEnclosingSymbol.name,
                path: fileP,
                type: "symbol",
                symbol: $currentEnclosingSymbol
            });

        }

        return segs;

    });

    /*
    |--------------------------------------------------------------------------
    | Popover Dropdown State
    |--------------------------------------------------------------------------
    */

    let openPopoverId = $state<string | null>(null);

    let popoverItems = $state<{ name: string; path: string; isDir: boolean }[]>([]);

    let popoverSymbols = $state<DocumentSymbolItem[]>([]);

    let loadingPopover = $state(false);


    async function toggleSegmentPopover(event: MouseEvent, seg: BreadcrumbSegment) {

        event.stopPropagation();

        if (openPopoverId === seg.id) {

            openPopoverId = null;

            return;

        }

        openPopoverId = seg.id;

        if (seg.type === "symbol") {

            popoverSymbols = $activeDocumentSymbols;

            return;

        }

        /* Fetch directory items */

        loadingPopover = true;

        popoverItems = [];

        try {

            const targetDir = seg.type === "file"
                ? seg.path.replace(/[\\/][^\\/]+$/, "")
                : seg.path;

            const entries = await window.craftale.filesystem.readDirectory(targetDir);

            popoverItems = entries.map((e) => ({
                name: e.name,
                path: e.path,
                isDir: e.type === "directory"
            }));

        } catch (err) {

            console.error("[BREADCRUMBS] Failed to read directory:", err);

        } finally {

            loadingPopover = false;

        }

    }

    async function selectPopoverFile(item: { name: string; path: string; isDir: boolean }) {

        openPopoverId = null;

        if (item.isDir) return;

        try {

            const content = await window.craftale.filesystem.readFile(item.path);

            openFile(
                {
                    name: item.name,
                    path: item.path,
                    content
                },
                { preview: true }
            );

        } catch (err) {

            console.error("[BREADCRUMBS] Failed to open file:", err);

        }

    }

    function selectPopoverSymbol(sym: DocumentSymbolItem) {

        openPopoverId = null;

        requestJump(sym.line, sym.column, $activeFile?.path);

        if (onJumpToSymbol) {

            onJumpToSymbol(sym);

        }

    }

    function closePopover() {

        openPopoverId = null;

    }

    /*
    |--------------------------------------------------------------------------
    | Back / Forward Navigation Handlers
    |--------------------------------------------------------------------------
    */

    function handleNavBack() {

        if (!$canNavigateBack) return;

        const target = stepBack();

        if (target) {

            requestJump(target.line, target.column, target.path);

            if (onNavigateLocation) {

                onNavigateLocation(target);

            }

        }

    }

    function handleNavForward() {

        if (!$canNavigateForward) return;

        const target = stepForward();

        if (target) {

            requestJump(target.line, target.column, target.path);

            if (onNavigateLocation) {

                onNavigateLocation(target);

            }

        }

    }

</script>

<svelte:window onclick={closePopover} />

{#if $activeFile}

    <div class="breadcrumbs-bar" role="navigation" aria-label="Code Breadcrumbs">

        <!-- History Back / Forward Buttons -->

        <div class="history-controls">

            <button
                type="button"
                class="history-btn"
                class:disabled={!$canNavigateBack}
                disabled={!$canNavigateBack}
                title="Go Back (Alt + LeftArrow)"
                aria-label="Go Back"
                onclick={handleNavBack}
            >
                ←
            </button>

            <button
                type="button"
                class="history-btn"
                class:disabled={!$canNavigateForward}
                disabled={!$canNavigateForward}
                title="Go Forward (Alt + RightArrow)"
                aria-label="Go Forward"
                onclick={handleNavForward}
            >
                →
            </button>

        </div>


        <!-- Breadcrumb Segments -->

        <div class="crumbs-list">

            {#each segments as seg, idx (seg.id)}

                {#if idx > 0}
                    <span class="crumb-separator">&gt;</span>
                {/if}

                <div class="crumb-item-wrapper">

                    <button
                        type="button"
                        class="crumb-btn"
                        class:active={openPopoverId === seg.id}
                        class:is-symbol={seg.type === "symbol"}
                        onclick={(e) => void toggleSegmentPopover(e, seg)}
                        title={`Click to reveal contents of ${seg.name}`}
                    >

                        {#if seg.type === "workspace" || seg.type === "folder"}
                            <span class="crumb-icon">📁</span>
                        {:else if seg.type === "file"}
                            <span class="crumb-icon">📄</span>
                        {:else if seg.type === "symbol" && seg.symbol}
                            {@const iconMeta = getSymbolIcon(seg.symbol.kind)}
                            <span
                                class="symbol-badge"
                                style="color: {iconMeta.color}; background: {iconMeta.bg};"
                            >
                                {iconMeta.text}
                            </span>
                        {/if}

                        <span class="crumb-label">{seg.name}</span>

                        <span class="crumb-chevron">▾</span>

                    </button>


                    <!-- Dropdown Popover Menu -->

                    {#if openPopoverId === seg.id}

                        <div
                            class="crumb-popover"
                            role="menu"
                            onclick={(e) => e.stopPropagation()}
                        >

                            {#if seg.type === "symbol"}

                                {#if popoverSymbols.length === 0}

                                    <div class="popover-empty">No symbols in this file</div>

                                {:else}

                                    <div class="popover-list">

                                        {#each popoverSymbols as sym (sym.id || `${sym.name}-${sym.line}`)}

                                            {@const sIcon = getSymbolIcon(sym.kind)}

                                            <button
                                                type="button"
                                                class="popover-item"
                                                class:active={pathsEqual(seg.path, $activeFile.path) && $currentEnclosingSymbol?.name === sym.name}
                                                onclick={() => selectPopoverSymbol(sym)}
                                            >

                                                <span
                                                    class="symbol-badge"
                                                    style="color: {sIcon.color}; background: {sIcon.bg};"
                                                >
                                                    {sIcon.text}
                                                </span>

                                                <span class="popover-item-name">{sym.name}</span>

                                                {#if sym.containerName}
                                                    <span class="popover-item-container">({sym.containerName})</span>
                                                {/if}

                                                <span class="popover-line">:{sym.line}</span>

                                            </button>

                                        {/each}

                                    </div>

                                {/if}

                            {:else}

                                {#if loadingPopover}

                                    <div class="popover-empty">Loading...</div>

                                {:else if popoverItems.length === 0}

                                    <div class="popover-empty">Folder is empty</div>

                                {:else}

                                    <div class="popover-list">

                                        {#each popoverItems as item (item.path)}

                                            <button
                                                type="button"
                                                class="popover-item"
                                                class:is-active-file={pathsEqual(item.path, $activeFile.path)}
                                                onclick={() => void selectPopoverFile(item)}
                                            >

                                                <span class="popover-icon">
                                                    {item.isDir ? "📁" : "📄"}
                                                </span>

                                                <span class="popover-item-name">{item.name}</span>

                                            </button>

                                        {/each}

                                    </div>

                                {/if}

                            {/if}

                        </div>

                    {/if}

                </div>

            {/each}

        </div>

    </div>

{/if}

<style>

    /*
    |--------------------------------------------------------------------------
    | Breadcrumbs Bar
    |--------------------------------------------------------------------------
    */

    .breadcrumbs-bar {

        height: 24px;

        min-height: 24px;

        background: #1e1e1e;

        border-bottom: 1px solid #282828;

        display: flex;

        align-items: center;

        padding: 0 8px;

        gap: 8px;

        font-size: 11px;

        color: #94a3b8;

        user-select: none;

        z-index: 10;

        position: relative;

    }


    /*
    |--------------------------------------------------------------------------
    | History Navigation Controls
    |--------------------------------------------------------------------------
    */

    .history-controls {

        display: flex;

        align-items: center;

        gap: 2px;

        flex-shrink: 0;

        border-right: 1px solid #333333;

        padding-right: 6px;

    }

    .history-btn {

        background: transparent;

        border: none;

        color: #cccccc;

        width: 20px;

        height: 18px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 3px;

        cursor: pointer;

        font-size: 12px;

        transition: background 0.1s ease, color 0.1s ease;

    }

    .history-btn:hover:not(.disabled) {

        background: #333333;

        color: #ffffff;

    }

    .history-btn.disabled {

        color: #555555;

        cursor: default;

    }


    /*
    |--------------------------------------------------------------------------
    | Crumbs List
    |--------------------------------------------------------------------------
    */

    .crumbs-list {

        display: flex;

        align-items: center;

        overflow-x: auto;

        white-space: nowrap;

        flex: 1;

        gap: 2px;

    }

    .crumbs-list::-webkit-scrollbar {

        display: none;

    }

    .crumb-separator {

        color: #52525b;

        font-size: 9px;

        margin: 0 1px;

    }

    .crumb-item-wrapper {

        position: relative;

        display: inline-flex;

        align-items: center;

    }

    .crumb-btn {

        background: transparent;

        border: none;

        color: #94a3b8;

        display: inline-flex;

        align-items: center;

        gap: 4px;

        padding: 1px 4px;

        border-radius: 3px;

        font-size: 11px;

        cursor: pointer;

        font-family: inherit;

        transition: background 0.1s ease, color 0.1s ease;

    }

    .crumb-btn:hover,
    .crumb-btn.active {

        background: #2a2d2e;

        color: #ffffff;

    }

    .crumb-btn.is-symbol {

        color: #c084fc;

    }

    .crumb-icon {

        font-size: 10px;

    }

    .crumb-chevron {

        font-size: 8px;

        color: #64748b;

        margin-left: 1px;

    }

    .symbol-badge {

        width: 14px;

        height: 14px;

        border-radius: 3px;

        display: inline-flex;

        align-items: center;

        justify-content: center;

        font-size: 9px;

        font-weight: 700;

    }


    /*
    |--------------------------------------------------------------------------
    | Popover Dropdown
    |--------------------------------------------------------------------------
    */

    .crumb-popover {

        position: absolute;

        top: calc(100% + 2px);

        left: 0;

        min-width: 200px;

        max-width: 320px;

        max-height: 280px;

        background: #252526;

        border: 1px solid #3c3c3c;

        border-radius: 6px;

        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);

        overflow-y: auto;

        padding: 4px;

        z-index: 100;

        animation: popoverFade 0.1s ease;

    }

    @keyframes popoverFade {
        from { opacity: 0; transform: translateY(-4px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .popover-empty {

        padding: 12px;

        text-align: center;

        color: #71717a;

        font-size: 11px;

    }

    .popover-list {

        display: flex;

        flex-direction: column;

        gap: 1px;

    }

    .popover-item {

        background: transparent;

        border: none;

        display: flex;

        align-items: center;

        gap: 8px;

        padding: 4px 8px;

        border-radius: 4px;

        color: #cccccc;

        font-size: 11px;

        cursor: pointer;

        text-align: left;

        width: 100%;

        font-family: inherit;

        user-select: none;

    }

    .popover-item:hover {

        background: #2a2d2e;

        color: #ffffff;

    }

    .popover-item.active,
    .popover-item.is-active-file {

        background: #04395e;

        color: #ffffff;

    }

    .popover-icon {

        font-size: 11px;

        width: 14px;

        text-align: center;

    }

    .popover-item-name {

        flex: 1;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

    }

    .popover-item-container {

        font-size: 10px;

        color: #64748b;

    }

    .popover-line {

        font-size: 10px;

        color: #64748b;

        font-family: monospace;

    }

</style>
