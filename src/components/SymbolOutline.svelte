<script lang="ts">

    import {
        activeDocumentSymbols,
        currentEnclosingSymbol,
        requestJump
    } from "../stores/navigation";
    import {
        activeFile
    } from "../stores/workspace";
    import {
        getSymbolIcon,
        getSymbolKindLabel,
        type DocumentSymbolItem
    } from "../utils/symbols";

    interface Props {
        onSelectSymbol?: (symbol: DocumentSymbolItem) => void;
    }

    let { onSelectSymbol }: Props = $props();

    let filterText = $state("");
    let sortBy = $state<"position" | "name">("position");
    let isExpanded = $state(true);

    function handleSymbolClick(sym: DocumentSymbolItem) {
        requestJump(sym.line, sym.column, $activeFile?.path);
        onSelectSymbol?.(sym);
    }

    /*
    |--------------------------------------------------------------------------
    | Filtered & Sorted Symbols
    |--------------------------------------------------------------------------
    */

    let displaySymbols = $derived.by<DocumentSymbolItem[]>(() => {

        let list = [...$activeDocumentSymbols];

        const query = filterText.trim().toLowerCase();

        if (query) {

            list = list.filter((sym) => {

                const n = sym.name.toLowerCase();

                const c = (sym.containerName || "").toLowerCase();

                const k = getSymbolKindLabel(sym.kind).toLowerCase();

                return n.includes(query) || c.includes(query) || k.includes(query);

            });

        }

        if (sortBy === "name") {

            list.sort((a, b) => a.name.localeCompare(b.name));

        } else {

            list.sort((a, b) => a.line - b.line);

        }

        return list;

    });

    function toggleSort() {

        sortBy = sortBy === "position" ? "name" : "position";

    }

    function toggleCollapse() {

        isExpanded = !isExpanded;

    }

</script>

<div class="symbol-outline" class:collapsed={!isExpanded}>

    <!-- Outline Header Bar -->

    <div
        class="outline-header"
        role="button"
        tabindex="0"
        onclick={toggleCollapse}
        onkeydown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                toggleCollapse();
            }
        }}
    >

        <span class="collapse-icon">
            {isExpanded ? "▾" : "▸"}
        </span>

        <span class="header-title">OUTLINE</span>

        {#if $activeFile}
            <span class="file-hint" title={$activeFile.name}>
                ({displaySymbols.length})
            </span>
        {/if}

        <div class="header-actions" onclick={(e) => e.stopPropagation()} role="presentation">

            <button
                type="button"
                class="header-btn"
                class:active={sortBy === "name"}
                title={sortBy === "position" ? "Sort by Name" : "Sort by Position"}
                aria-label="Sort Symbols"
                onclick={toggleSort}
            >
                {sortBy === "position" ? "🔤" : "📍"}
            </button>

        </div>

    </div>


    {#if isExpanded}

        <!-- Filter Input -->

        <div class="outline-filter-box">

            <input
                type="text"
                class="outline-filter-input"
                placeholder="Filter symbols by name..."
                bind:value={filterText}
            />

            {#if filterText}
                <button
                    type="button"
                    class="clear-filter-btn"
                    title="Clear filter"
                    onclick={() => (filterText = "")}
                >
                    ×
                </button>
            {/if}

        </div>


        <!-- Symbols Tree List -->

        <div class="outline-list" role="tree">

            {#if !$activeFile}

                <div class="outline-empty">
                    No active file.
                </div>

            {:else if displaySymbols.length === 0}

                <div class="outline-empty">
                    {filterText ? "No matching symbols." : "No symbols found in file."}
                </div>

            {:else}

                {#each displaySymbols as sym (sym.id || `${sym.name}-${sym.line}`)}

                    {@const iconMeta = getSymbolIcon(sym.kind)}

                    {@const isActive = $currentEnclosingSymbol?.name === sym.name}

                    <div
                        class="outline-item"
                        class:active={isActive}
                        role="treeitem"
                        tabindex="0"
                        aria-selected={isActive}
                        title={`${sym.name} (${getSymbolKindLabel(sym.kind)}) - Line ${sym.line}`}
                        onclick={() => handleSymbolClick(sym)}
                        onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSymbolClick(sym);
                            }
                        }}
                    >

                        <span
                            class="symbol-badge"
                            style="color: {iconMeta.color}; background: {iconMeta.bg};"
                        >
                            {iconMeta.text}
                        </span>

                        <span class="symbol-name">
                            {sym.name}
                        </span>

                        {#if sym.containerName}
                            <span class="symbol-container">
                                ({sym.containerName})
                            </span>
                        {/if}

                        <span class="symbol-line">
                            :{sym.line}
                        </span>

                    </div>

                {/each}

            {/if}

        </div>

    {/if}

</div>

<style>

    /*
    |--------------------------------------------------------------------------
    | Outline Panel
    |--------------------------------------------------------------------------
    */

    .symbol-outline {

        display: flex;

        flex-direction: column;

        border-top: 1px solid #2d2d2d;

        background: #181818;

        min-height: 32px;

        max-height: 400px;

        overflow: hidden;

    }

    .symbol-outline.collapsed {

        max-height: 32px;

    }


    /*
    |--------------------------------------------------------------------------
    | Header
    |--------------------------------------------------------------------------
    */

    .outline-header {

        height: 32px;

        min-height: 32px;

        background: #1f1f1f;

        display: flex;

        align-items: center;

        padding: 0 10px;

        gap: 6px;

        cursor: pointer;

        user-select: none;

    }

    .outline-header:hover {

        background: #242424;

    }

    .collapse-icon {

        font-size: 11px;

        color: #71717a;

        width: 12px;

    }

    .header-title {

        font-size: 11px;

        font-weight: 700;

        letter-spacing: 0.5px;

        color: #bbbbbb;

    }

    .file-hint {

        font-size: 10px;

        color: #64748b;

    }

    .header-actions {

        margin-left: auto;

        display: flex;

        align-items: center;

        gap: 4px;

    }

    .header-btn {

        background: transparent;

        border: none;

        color: #888888;

        padding: 2px 4px;

        border-radius: 3px;

        cursor: pointer;

        font-size: 11px;

    }

    .header-btn:hover {

        background: #333333;

        color: #ffffff;

    }


    /*
    |--------------------------------------------------------------------------
    | Filter Input
    |--------------------------------------------------------------------------
    */

    .outline-filter-box {

        padding: 4px 8px;

        background: #181818;

        position: relative;

        display: flex;

        align-items: center;

        border-bottom: 1px solid #262626;

    }

    .outline-filter-input {

        width: 100%;

        background: #202020;

        border: 1px solid #333333;

        border-radius: 3px;

        color: #cccccc;

        font-size: 11px;

        padding: 3px 6px;

        outline: none;

        font-family: inherit;

    }

    .outline-filter-input:focus {

        border-color: #007acc;

    }

    .clear-filter-btn {

        position: absolute;

        right: 12px;

        background: transparent;

        border: none;

        color: #71717a;

        font-size: 14px;

        cursor: pointer;

        padding: 0;

    }

    .clear-filter-btn:hover {

        color: #e2e8f0;

    }


    /*
    |--------------------------------------------------------------------------
    | List
    |--------------------------------------------------------------------------
    */

    .outline-list {

        flex: 1;

        overflow-y: auto;

        padding: 4px 6px;

        display: flex;

        flex-direction: column;

        gap: 1px;

        max-height: 280px;

    }

    .outline-list::-webkit-scrollbar {

        width: 5px;

    }

    .outline-list::-webkit-scrollbar-thumb {

        background: #333333;

        border-radius: 3px;

    }

    .outline-empty {

        padding: 14px;

        text-align: center;

        color: #64748b;

        font-size: 11px;

    }

    .outline-item {

        display: flex;

        align-items: center;

        gap: 6px;

        padding: 3px 6px;

        border-radius: 4px;

        cursor: pointer;

        user-select: none;

        transition: background 0.08s ease;

        font-size: 11px;

    }

    .outline-item:hover {

        background: #242424;

    }

    .outline-item.active {

        background: #04395e;

        color: #ffffff;

    }

    .symbol-badge {

        width: 16px;

        height: 16px;

        border-radius: 3px;

        display: flex;

        align-items: center;

        justify-content: center;

        font-size: 9px;

        font-weight: 700;

        flex-shrink: 0;

    }

    .symbol-name {

        color: #cccccc;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

        flex: 1;

    }

    .outline-item.active .symbol-name {

        color: #ffffff;

        font-weight: 600;

    }

    .symbol-container {

        font-size: 10px;

        color: #64748b;

    }

    .symbol-line {

        font-size: 10px;

        color: #64748b;

        font-family: monospace;

    }

</style>
