<script lang="ts">
    import { onMount, tick } from "svelte";
    import {
        searchQuery,
        replaceQuery,
        isReplaceOpen,
        isRegex,
        isCaseSensitive,
        matchWholeWord,
        includePattern,
        excludePattern,
        isDetailsOpen,
        onlyOpenEditors,
        preserveCase,
        isSearching,
        isReplacing,
        searchError,
        searchResults,
        totalMatches,
        totalFiles,
        searchDurationMs,
        searchTruncated,
        collapsedFiles,
        activeMatchSelection,
        replaceConfirmModal,
        runWorkspaceSearch,
        triggerSearchDebounced,
        clearSearch,
        toggleFileCollapse,
        collapseAllFiles,
        expandAllFiles,
        navigateNextMatch,
        navigatePrevMatch,
        selectMatch,
        replaceOneMatch,
        replaceAllInFile,
        promptReplaceWorkspace,
        confirmReplaceWorkspace,
        cancelReplaceWorkspace,
        dismissMatch,
        dismissFile
    } from "../stores/search";
    import { workspacePath, openedFiles, activeFile } from "../stores/workspace";

    let searchInputEl = $state<HTMLInputElement | null>(null);
    let replaceInputEl = $state<HTMLInputElement | null>(null);

    function handleSearchInput() {
        triggerSearchDebounced(300);
    }

    function handleSearchKeyDown(e: KeyboardEvent) {
        if (e.altKey && !e.ctrlKey && !e.metaKey) {
            if (e.key.toLowerCase() === "c") {
                e.preventDefault();
                toggleOption("case");
                return;
            }
            if (e.key.toLowerCase() === "w") {
                e.preventDefault();
                toggleOption("word");
                return;
            }
            if (e.key.toLowerCase() === "r") {
                e.preventDefault();
                toggleOption("regex");
                return;
            }
        }

        if (e.key === "Enter") {
            e.preventDefault();
            void runWorkspaceSearch();
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            navigateNextMatch();
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            navigatePrevMatch();
        } else if (e.key === "F4") {
            e.preventDefault();
            if (e.shiftKey) {
                navigatePrevMatch();
            } else {
                navigateNextMatch();
            }
        } else if (e.key === "Escape") {
            clearSearch();
        }
    }

    function handleReplaceKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            if (e.ctrlKey || e.metaKey || e.altKey) {
                promptReplaceWorkspace();
            } else {
                const sel = $activeMatchSelection;
                if (sel) {
                    void replaceOneMatch(sel.fileIndex, sel.matchIndex);
                } else {
                    promptReplaceWorkspace();
                }
            }
        }
    }

    function toggleOption(opt: "regex" | "case" | "word") {
        if (opt === "regex") {
            isRegex.update((v) => !v);
        } else if (opt === "case") {
            isCaseSensitive.update((v) => !v);
        } else if (opt === "word") {
            matchWholeWord.update((v) => !v);
        }
        triggerSearchDebounced(150);
    }

    function getFileIcon(fileName: string): string {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        switch (ext) {
            case "ts":
            case "tsx":
                return "🔷";
            case "js":
            case "jsx":
            case "mjs":
            case "cjs":
                return "🟨";
            case "svelte":
                return "🟧";
            case "json":
                return "📋";
            case "css":
            case "scss":
                return "🎨";
            case "html":
                return "🌐";
            case "md":
                return "📝";
            case "py":
                return "🐍";
            default:
                return "📄";
        }
    }

    function getDirDisplay(relativePath: string): string {
        const parts = relativePath.split("/");
        if (parts.length <= 1) return "";
        return parts.slice(0, -1).join("/");
    }

    export function focusSearchInput(selectText = true) {
        tick().then(() => {
            if (searchInputEl) {
                searchInputEl.focus();
                if (selectText) {
                    searchInputEl.select();
                }
            }
        });
    }

    export function focusReplaceInput() {
        isReplaceOpen.set(true);
        tick().then(() => {
            if (replaceInputEl) {
                replaceInputEl.focus();
                replaceInputEl.select();
            }
        });
    }
</script>

<div class="workspace-search" role="region" aria-label="Search">
    <!-- Header -->
    <div class="search-header">
        <span class="header-title">SEARCH</span>

        <div class="header-actions">
            <!-- Refresh Search -->
            <button
                type="button"
                class="icon-btn"
                title="Refresh (Enter)"
                disabled={$isSearching || !$searchQuery.trim()}
                onclick={() => runWorkspaceSearch()}
                aria-label="Refresh"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M13.65 2.35A7.958 7.958 0 0 0 8 0a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24l-2.24 2.24h6V0l-2.35 2.35z"/>
                </svg>
            </button>

            <!-- Clear Search -->
            <button
                type="button"
                class="icon-btn"
                title="Clear Search"
                disabled={!$searchQuery && $searchResults.length === 0}
                onclick={clearSearch}
                aria-label="Clear Search"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>

            <!-- Previous Match (Shift+F4) -->
            <button
                type="button"
                class="icon-btn"
                title="Previous Match (Shift+F4)"
                disabled={$totalMatches === 0}
                onclick={navigatePrevMatch}
                aria-label="Previous Match"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M8 3.5a.5.5 0 0 0-.354.146l-4 4a.5.5 0 0 0 .708.708L7.5 5.207V12.5a.5.5 0 0 0 1 0V5.207l3.146 3.147a.5.5 0 0 0 .708-.708l-4-4A.5.5 0 0 0 8 3.5z"/>
                </svg>
            </button>

            <!-- Next Match (F4) -->
            <button
                type="button"
                class="icon-btn"
                title="Next Match (F4)"
                disabled={$totalMatches === 0}
                onclick={navigateNextMatch}
                aria-label="Next Match"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M8 12.5a.5.5 0 0 0 .354-.146l4-4a.5.5 0 0 0-.708-.708L8.5 10.793V3.5a.5.5 0 0 0-1 0v7.293L4.354 7.646a.5.5 0 1 0-.708.708l4 4a.5.5 0 0 0 .354.146z"/>
                </svg>
            </button>

            <!-- Collapse / Expand All -->
            <button
                type="button"
                class="icon-btn"
                title={$collapsedFiles.size === $totalFiles ? "Expand All" : "Collapse All"}
                disabled={$searchResults.length === 0}
                onclick={() => {
                    if ($collapsedFiles.size === $totalFiles) {
                        expandAllFiles();
                    } else {
                        collapseAllFiles();
                    }
                }}
                aria-label="Toggle Expand"
            >
                {#if $collapsedFiles.size === $totalFiles}
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <path d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8zM8 1a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-1 0v-13A.5.5 0 0 1 8 1z"/>
                    </svg>
                {:else}
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <path d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8z"/>
                    </svg>
                {/if}
            </button>
        </div>
    </div>

    <!-- Inputs Container -->
    <div class="search-inputs">
        <!-- Search Row -->
        <div class="input-row search-row">
            <!-- Replace Toggle Chevron -->
            <button
                type="button"
                class="toggle-replace-chevron"
                title="Toggle Replace"
                onclick={() => isReplaceOpen.update((v) => !v)}
                aria-label="Toggle Replace"
            >
                <span class="chevron" class:expanded={$isReplaceOpen}>▸</span>
            </button>

            <div class="input-wrapper">
                <input
                    bind:this={searchInputEl}
                    type="text"
                    class="search-field"
                    placeholder="Search"
                    bind:value={$searchQuery}
                    oninput={handleSearchInput}
                    onkeydown={handleSearchKeyDown}
                />

                <div class="input-toggles">
                    <!-- Case Sensitive (Alt+C) -->
                    <button
                        type="button"
                        class="toggle-btn"
                        class:active={$isCaseSensitive}
                        title="Match Case (Alt+C)"
                        onclick={() => toggleOption("case")}
                    >
                        Aa
                    </button>

                    <!-- Match Whole Word (Alt+W) -->
                    <button
                        type="button"
                        class="toggle-btn"
                        class:active={$matchWholeWord}
                        title="Match Whole Word (Alt+W)"
                        onclick={() => toggleOption("word")}
                    >
                        |ab|
                    </button>

                    <!-- Use Regular Expression (Alt+R) -->
                    <button
                        type="button"
                        class="toggle-btn"
                        class:active={$isRegex}
                        title="Use Regular Expression (Alt+R)"
                        onclick={() => toggleOption("regex")}
                    >
                        .*
                    </button>
                </div>
            </div>
        </div>

        <!-- Replace Row (Collapsible) -->
        {#if $isReplaceOpen}
            <div class="input-row replace-row">
                <div class="spacer-chevron"></div>

                <div class="input-wrapper">
                    <input
                        bind:this={replaceInputEl}
                        type="text"
                        class="search-field"
                        placeholder="Replace"
                        bind:value={$replaceQuery}
                        onkeydown={handleReplaceKeyDown}
                    />

                    <div class="input-toggles">
                        <!-- Replace All Button -->
                        <button
                            type="button"
                            class="toggle-btn replace-all-btn"
                            class:disabled={$totalMatches === 0}
                            title="Replace All (Ctrl+Alt+Enter)"
                            disabled={$totalMatches === 0 || $isReplacing}
                            onclick={promptReplaceWorkspace}
                        >
                            ⮂ All
                        </button>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Include / Exclude Filters Toggle Details -->
        <div class="details-toggle-bar">
            <button
                type="button"
                class="details-btn"
                onclick={() => isDetailsOpen.update((v) => !v)}
            >
                <span class="chevron" class:expanded={$isDetailsOpen}>▸</span>
                <span>files to include / exclude</span>
            </button>
        </div>

        <!-- Include / Exclude Inputs (Collapsible) -->
        {#if $isDetailsOpen}
            <div class="details-panel">
                <div class="filter-group">
                    <label for="search-include-input" class="filter-label">files to include</label>
                    <input
                        id="search-include-input"
                        type="text"
                        class="filter-field"
                        placeholder="e.g. *.ts, src/**"
                        bind:value={$includePattern}
                        oninput={() => triggerSearchDebounced(300)}
                    />
                </div>

                <div class="filter-group">
                    <label for="search-exclude-input" class="filter-label">files to exclude</label>
                    <input
                        id="search-exclude-input"
                        type="text"
                        class="filter-field"
                        placeholder="e.g. node_modules, dist"
                        bind:value={$excludePattern}
                        oninput={() => triggerSearchDebounced(300)}
                    />
                </div>

                <div class="filter-options">
                    <button
                        type="button"
                        class="quick-filter-btn"
                        class:active={$onlyOpenEditors}
                        onclick={() => {
                            onlyOpenEditors.update((v) => !v);
                            void runWorkspaceSearch();
                        }}
                    >
                        { $onlyOpenEditors ? "✓ Open Editors Only" : "○ Open Editors Only" }
                    </button>

                    {#if $activeFile}
                        {@const currentFileName = $activeFile.name}
                        {@const isCurrentFiltered = $includePattern.trim() === currentFileName}
                        <button
                            type="button"
                            class="quick-filter-btn"
                            class:active={isCurrentFiltered}
                            onclick={() => {
                                if (isCurrentFiltered) {
                                    includePattern.set("");
                                } else {
                                    includePattern.set(currentFileName);
                                }
                                void runWorkspaceSearch();
                            }}
                            title={`Filter search to ${currentFileName}`}
                        >
                            { isCurrentFiltered ? `✓ Only ${currentFileName}` : `Filter to ${currentFileName}` }
                        </button>
                    {/if}
                </div>
            </div>
        {/if}
    </div>

    <!-- Error Banner -->
    {#if $searchError}
        <div class="search-error-banner" role="alert">
            <span class="error-icon">⚠️</span>
            <span class="error-text">{$searchError}</span>
        </div>
    {/if}

    <!-- Status & Summary Bar -->
    {#if $searchQuery.trim()}
        <div class="search-summary">
            {#if $isSearching}
                <div class="summary-loading">
                    <span class="spinner"></span>
                    <span>Searching workspace...</span>
                </div>
            {:else if $searchResults.length > 0}
                <div class="summary-text">
                    <strong>{$totalMatches}</strong> {$totalMatches === 1 ? "result" : "results"} in <strong>{$totalFiles}</strong> {$totalFiles === 1 ? "file" : "files"}
                    <span class="duration">({$searchDurationMs}ms)</span>
                    {#if $searchTruncated}
                        <span class="truncated-badge" title="Results capped at 5000">truncated</span>
                    {/if}
                </div>
            {:else}
                <div class="summary-empty">
                    No results found.
                </div>
            {/if}
        </div>
    {/if}

    <!-- Search Results Tree -->
    <div class="search-results-list" role="tree">
        {#each $searchResults as file, fileIndex (file.path)}
            {@const isCollapsed = $collapsedFiles.has(file.path)}

            <!-- File Header Node -->
            <div
                class="file-node"
                role="treeitem"
                aria-expanded={!isCollapsed}
                tabindex="0"
                onclick={() => toggleFileCollapse(file.path)}
                onkeydown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        toggleFileCollapse(file.path);
                    }
                }}
            >
                <span class="file-chevron" class:expanded={!isCollapsed}>
                    ▸
                </span>

                <span class="file-icon">
                    {getFileIcon(file.fileName)}
                </span>

                <span class="file-name" title={file.path}>
                    {file.fileName}
                </span>

                {#if getDirDisplay(file.relativePath)}
                    <span class="file-dir" title={file.relativePath}>
                        {getDirDisplay(file.relativePath)}
                    </span>
                {/if}

                <span class="matches-count">
                    {file.matches.length}
                </span>

                <!-- File Actions on Hover -->
                <div class="file-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                    {#if $isReplaceOpen}
                        <button
                            type="button"
                            class="item-action-btn"
                            title="Replace All in File"
                            onclick={() => replaceAllInFile(fileIndex)}
                            aria-label="Replace All in File"
                        >
                            ⮂
                        </button>
                    {/if}

                    <button
                        type="button"
                        class="item-action-btn"
                        title="Dismiss File"
                        onclick={() => dismissFile(fileIndex)}
                        aria-label="Dismiss File"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- Matching Line Rows -->
            {#if !isCollapsed}
                <div class="matches-group" role="group">
                    {#each file.matches as match, matchIndex (`${file.path}:${match.lineNumber}:${match.column}`)}
                        {@const isSelected =
                            $activeMatchSelection?.fileIndex === fileIndex &&
                            $activeMatchSelection?.matchIndex === matchIndex}

                        <div
                            class="match-row"
                            class:selected={isSelected}
                            role="treeitem"
                            tabindex="0"
                            onclick={() => selectMatch(fileIndex, matchIndex)}
                            onkeydown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    selectMatch(fileIndex, matchIndex);
                                }
                            }}
                        >
                            <span class="match-line-num">
                                {match.lineNumber}:
                            </span>

                            <div class="match-preview" title={`Line ${match.lineNumber}, Col ${match.column}: ${match.lineText}`}>
                                <span class="preview-before">{match.preview.before}</span>
                                <span class="preview-highlight">{match.preview.match}</span>
                                <span class="preview-after">{match.preview.after}</span>
                            </div>

                            <!-- Match Actions on Hover -->
                            <div class="match-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                                {#if $isReplaceOpen}
                                    <button
                                        type="button"
                                        class="item-action-btn"
                                        title="Replace Match"
                                        onclick={() => replaceOneMatch(fileIndex, matchIndex)}
                                        aria-label="Replace Match"
                                    >
                                        ⮂
                                    </button>
                                {/if}

                                <button
                                    type="button"
                                    class="item-action-btn"
                                    title="Dismiss Match"
                                    onclick={() => dismissMatch(fileIndex, matchIndex)}
                                    aria-label="Dismiss Match"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        {/each}
    </div>
</div>

<!-- Replace All Confirmation Modal -->
{#if $replaceConfirmModal}
    <div class="modal-backdrop" onclick={cancelReplaceWorkspace} role="presentation">
        <div class="confirm-modal" role="dialog" aria-modal="true" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h3>Replace All in Workspace</h3>
            </div>

            <div class="modal-body">
                <p>
                    Are you sure you want to replace <strong>{$replaceConfirmModal.totalMatches}</strong> occurrences across <strong>{$replaceConfirmModal.totalFiles}</strong> files with:
                </p>
                <div class="replacement-preview">
                    "{$replaceQuery}"
                </div>
                <p class="modal-warning">
                    ⚠️ This action will overwrite files directly on disk.
                </p>
            </div>

            <div class="modal-footer">
                <button
                    type="button"
                    class="btn btn-secondary"
                    onclick={cancelReplaceWorkspace}
                >
                    Cancel
                </button>

                <button
                    type="button"
                    class="btn btn-danger"
                    disabled={$isReplacing}
                    onclick={confirmReplaceWorkspace}
                >
                    {#if $isReplacing}
                        Replacing...
                    {:else}
                        Replace All
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    .workspace-search {
        width: 100%;
        height: 100%;
        background: #252526;
        color: #cccccc;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        user-select: none;
        font-family: inherit;
        font-size: 12px;
    }

    /* Header */
    .search-header {
        height: 35px;
        min-height: 35px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #333333;
    }

    .header-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #bbbbbb;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .icon-btn {
        background: transparent;
        border: none;
        color: #aaaaaa;
        cursor: pointer;
        padding: 4px;
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .icon-btn:hover:not(:disabled) {
        background: #37373d;
        color: #ffffff;
    }

    .icon-btn:disabled {
        opacity: 0.4;
        cursor: default;
    }

    /* Inputs Container */
    .search-inputs {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-bottom: 1px solid #2b2b2b;
    }

    .input-row {
        display: flex;
        align-items: center;
        gap: 4px;
        width: 100%;
    }

    .toggle-replace-chevron,
    .spacer-chevron {
        width: 16px;
        height: 24px;
        background: transparent;
        border: none;
        padding: 0;
        color: #cccccc;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
    }

    .chevron {
        display: inline-block;
        transition: transform 0.15s ease;
    }

    .chevron.expanded {
        transform: rotate(90deg);
    }

    .input-wrapper {
        position: relative;
        flex: 1;
        display: flex;
        align-items: center;
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 2px;
    }

    .input-wrapper:focus-within {
        border-color: #007acc;
    }

    .search-field {
        width: 100%;
        height: 25px;
        background: transparent;
        border: none;
        color: #cccccc;
        padding: 0 60px 0 8px;
        font-size: 12px;
        outline: none;
        font-family: inherit;
    }

    .search-field::placeholder {
        color: #858585;
    }

    .input-toggles {
        position: absolute;
        right: 2px;
        display: flex;
        align-items: center;
        gap: 1px;
    }

    .toggle-btn {
        height: 20px;
        padding: 0 4px;
        background: transparent;
        border: 1px solid transparent;
        border-radius: 2px;
        color: #aaaaaa;
        font-size: 10px;
        font-family: monospace;
        font-weight: 700;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .toggle-btn:hover {
        background: #4a4a4a;
        color: #ffffff;
    }

    .toggle-btn.active {
        background: #007acc44;
        border-color: #007acc;
        color: #ffffff;
    }

    .replace-all-btn {
        font-family: inherit;
        font-size: 10px;
        padding: 0 6px;
    }

    .replace-all-btn:hover:not(:disabled) {
        background: #007acc;
        color: #ffffff;
    }

    /* Details Toggle Bar */
    .details-toggle-bar {
        display: flex;
        align-items: center;
        margin-top: 2px;
    }

    .details-btn {
        background: transparent;
        border: none;
        color: #999999;
        font-size: 11px;
        cursor: pointer;
        padding: 2px 0;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .details-btn:hover {
        color: #ffffff;
    }

    /* Details Panel */
    .details-panel {
        display: flex;
        flex-direction: column;
        gap: 6px;
        padding-top: 4px;
    }

    .filter-group {
        display: flex;
        flex-direction: column;
        gap: 2px;
    }

    .filter-label {
        font-size: 10px;
        color: #858585;
        text-transform: uppercase;
        letter-spacing: 0.4px;
    }

    .filter-field {
        height: 24px;
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 2px;
        color: #cccccc;
        padding: 0 6px;
        font-size: 11px;
        outline: none;
        font-family: inherit;
    }

    .filter-field:focus {
        border-color: #007acc;
    }

    .filter-options {
        display: flex;
        justify-content: flex-end;
    }

    .quick-filter-btn {
        background: transparent;
        border: 1px solid #444444;
        border-radius: 2px;
        color: #aaaaaa;
        font-size: 10px;
        padding: 2px 6px;
        cursor: pointer;
    }

    .quick-filter-btn:hover {
        background: #37373d;
        color: #ffffff;
    }

    .quick-filter-btn.active {
        background: #007acc33;
        border-color: #007acc;
        color: #ffffff;
    }

    /* Error Banner */
    .search-error-banner {
        background: #5a1d1d;
        color: #f48771;
        padding: 6px 10px;
        font-size: 11px;
        display: flex;
        align-items: center;
        gap: 6px;
    }

    /* Summary Bar */
    .search-summary {
        padding: 6px 10px;
        font-size: 11px;
        color: #999999;
        border-bottom: 1px solid #2b2b2b;
    }

    .summary-loading {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #007acc;
    }

    .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid #007acc44;
        border-top-color: #007acc;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .duration {
        color: #777777;
        margin-left: 4px;
    }

    .truncated-badge {
        background: #e8912d33;
        color: #e8912d;
        padding: 1px 4px;
        border-radius: 2px;
        font-size: 9px;
        margin-left: 6px;
    }

    /* Results List */
    .search-results-list {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* File Node */
    .file-node {
        position: relative;
        display: flex;
        align-items: center;
        height: 24px;
        padding: 0 8px 0 6px;
        cursor: pointer;
        gap: 4px;
        outline: none;
    }

    .file-node:hover {
        background: #2a2d2e;
    }

    .file-node:hover .file-actions {
        display: flex;
    }

    .file-chevron {
        font-size: 9px;
        color: #858585;
        width: 12px;
        display: inline-block;
        transition: transform 0.12s ease;
    }

    .file-chevron.expanded {
        transform: rotate(90deg);
    }

    .file-icon {
        font-size: 12px;
    }

    .file-name {
        font-weight: 600;
        color: #e0e0e0;
        white-space: nowrap;
    }

    .file-dir {
        font-size: 11px;
        color: #777777;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        flex: 1;
    }

    .matches-count {
        font-size: 10px;
        font-weight: 700;
        background: #37373d;
        color: #cccccc;
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: auto;
    }

    .file-actions,
    .match-actions {
        display: none;
        align-items: center;
        gap: 2px;
        background: #2a2d2e;
        padding-left: 4px;
    }

    .item-action-btn {
        background: transparent;
        border: none;
        color: #aaaaaa;
        padding: 2px 4px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 10px;
    }

    .item-action-btn:hover {
        background: #3c3c3c;
        color: #ffffff;
    }

    /* Matches Group */
    .matches-group {
        display: flex;
        flex-direction: column;
    }

    .match-row {
        position: relative;
        display: flex;
        align-items: center;
        height: 22px;
        padding-left: 24px;
        padding-right: 8px;
        cursor: pointer;
        gap: 6px;
        font-family: monospace;
        font-size: 11px;
        outline: none;
    }

    .match-row:hover {
        background: #2a2d2e;
    }

    .match-row:hover .match-actions {
        display: flex;
    }

    .match-row.selected {
        background: #094771;
        color: #ffffff;
    }

    .match-row.selected .match-actions {
        background: #094771;
    }

    .match-line-num {
        color: #757575;
        font-size: 11px;
        min-width: 24px;
        text-align: right;
    }

    .match-preview {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        color: #cccccc;
    }

    .preview-highlight {
        background: #613214;
        color: #ffcc00;
        font-weight: 700;
        padding: 0 1px;
        border-radius: 2px;
        border: 1px solid #8e4c1e;
    }

    /* Modal */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .confirm-modal {
        background: #252526;
        border: 1px solid #454545;
        border-radius: 6px;
        width: 420px;
        max-width: 90vw;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        overflow: hidden;
        display: flex;
        flex-direction: column;
    }

    .modal-header {
        padding: 12px 16px;
        border-bottom: 1px solid #333333;
    }

    .modal-header h3 {
        margin: 0;
        font-size: 14px;
        color: #ffffff;
    }

    .modal-body {
        padding: 16px;
        font-size: 12px;
        color: #cccccc;
        line-height: 1.5;
    }

    .replacement-preview {
        background: #1e1e1e;
        padding: 8px 12px;
        border-radius: 4px;
        border: 1px solid #3c3c3c;
        margin: 8px 0;
        font-family: monospace;
        color: #89d185;
        word-break: break-all;
    }

    .modal-warning {
        color: #cca700;
        font-size: 11px;
        margin-top: 10px;
    }

    .modal-footer {
        padding: 10px 16px;
        background: #1f1f20;
        border-top: 1px solid #333333;
        display: flex;
        justify-content: flex-end;
        gap: 8px;
    }

    .btn {
        padding: 6px 14px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
    }

    .btn-secondary {
        background: #3a3d41;
        color: #cccccc;
    }

    .btn-secondary:hover {
        background: #45494e;
    }

    .btn-danger {
        background: #e51400;
        color: #ffffff;
    }

    .btn-danger:hover:not(:disabled) {
        background: #f03a29;
    }

    .btn-danger:disabled {
        opacity: 0.6;
        cursor: not-allowed;
    }
</style>
