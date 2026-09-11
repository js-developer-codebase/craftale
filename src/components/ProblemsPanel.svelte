<script lang="ts">
    import {
        problemsList,
        problemsFilter,
        filteredProblemsByFile,
        problemsSummary,
        isCheckingWorkspace,
        runWorkspaceCheck,
        clearAllProblems,
        clearCompilerProblems,
        type ProblemItem,
        type FileProblemsGroup
    } from "../stores/problems";
    import { workspacePath } from "../stores/workspace";
    import { closeBottomPanel } from "../stores/panel";
    import { requestJump } from "../stores/navigation";
    import { notify } from "../stores/notifications";

    let collapsedFiles = $state<Record<string, boolean>>({});
    let selectedProblemId = $state<string | null>(null);

    function toggleFileCollapse(filePath: string) {
        collapsedFiles[filePath] = !collapsedFiles[filePath];
    }

    function collapseAll() {
        const all: Record<string, boolean> = {};
        for (const g of $filteredProblemsByFile) {
            all[g.filePath] = true;
        }
        collapsedFiles = all;
    }

    function expandAll() {
        collapsedFiles = {};
    }

    function handleSelectProblem(problem: ProblemItem) {
        selectedProblemId = problem.id;
        requestJump(problem.line, problem.column, problem.filePath, false);
    }

    function handleRunCheck() {
        if (!$workspacePath) {
            notify.warning("Open a workspace folder to run type check");
            return;
        }
        void runWorkspaceCheck($workspacePath);
    }

    function resetFilters() {
        problemsFilter.set({
            query: "",
            showErrors: true,
            showWarnings: true,
            showInfos: true,
            sourceType: "all"
        });
    }

    function formatRelativePath(fullPath: string): string {
        if (!$workspacePath) return fullPath;
        const ws = $workspacePath.replace(/\\/g, "/").toLowerCase();
        const p = fullPath.replace(/\\/g, "/");
        if (p.toLowerCase().startsWith(ws)) {
            const rel = p.slice(ws.length);
            const dir = rel.split("/").slice(0, -1).join("/");
            return dir ? dir.replace(/^\//, "") : "";
        }
        return "";
    }
</script>

<div class="problems-panel" role="region" aria-label="Problems">
    <!-- Header Toolbar -->
    <header class="panel-toolbar">
        <div class="toolbar-left">
            <!-- Search / Filter Input -->
            <div class="filter-box">
                <svg class="search-icon" width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M11.742 10.344a6.5 6.5 0 1 0-1.397 1.398h-.001c.03.04.062.078.098.115l3.85 3.85a1 1 0 0 0 1.415-1.414l-3.85-3.85a1.007 1.007 0 0 0-.115-.1zM12 6.5a5.5 5.5 0 1 1-11 0 5.5 5.5 0 0 1 11 0z"/>
                </svg>
                <input
                    type="text"
                    class="filter-input"
                    placeholder="Filter problems (e.g. text, filename, code)..."
                    bind:value={$problemsFilter.query}
                />
                {#if $problemsFilter.query}
                    <button
                        type="button"
                        class="btn-clear-filter"
                        onclick={() => $problemsFilter.query = ""}
                        title="Clear search"
                    >
                        ✕
                    </button>
                {/if}
            </div>

            <!-- Severity Toggle Pills -->
            <div class="severity-toggles">
                <button
                    type="button"
                    class="severity-btn error"
                    class:active={$problemsFilter.showErrors}
                    onclick={() => $problemsFilter.showErrors = !$problemsFilter.showErrors}
                    title="Toggle Errors filter"
                >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
                    </svg>
                    <span>{$problemsSummary.errorCount} Errors</span>
                </button>

                <button
                    type="button"
                    class="severity-btn warning"
                    class:active={$problemsFilter.showWarnings}
                    onclick={() => $problemsFilter.showWarnings = !$problemsFilter.showWarnings}
                    title="Toggle Warnings filter"
                >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M7.56 1.44a1 1 0 0 1 1.78 0l6.5 12.5A1 1 0 0 1 15 15H1a1 1 0 0 1-.89-1.44l6.5-12.5zM8 4.5 2.5 14h11L8 4.5zM7.5 7h1v4h-1V7zm0 5h1v1.5h-1V12z"/>
                    </svg>
                    <span>{$problemsSummary.warningCount} Warnings</span>
                </button>

                <button
                    type="button"
                    class="severity-btn info"
                    class:active={$problemsFilter.showInfos}
                    onclick={() => $problemsFilter.showInfos = !$problemsFilter.showInfos}
                    title="Toggle Info/Hint filter"
                >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zm-1-8h2v2H7V6zm0 3h2v4H7V9z"/>
                    </svg>
                    <span>{$problemsSummary.infoCount} Infos</span>
                </button>
            </div>

            <!-- Source Type Filter -->
            <select class="source-select" bind:value={$problemsFilter.sourceType} title="Filter by source type">
                <option value="all">All Sources</option>
                <option value="lsp">LSP Diagnostics</option>
                <option value="compiler">Compiler Diagnostics</option>
            </select>
        </div>

        <div class="toolbar-right">
            <!-- Run Check Button -->
            <button
                type="button"
                class="btn-tool"
                disabled={$isCheckingWorkspace}
                onclick={handleRunCheck}
                title="Run Workspace Type & Build Check"
            >
                {#if $isCheckingWorkspace}
                    <span class="spinner"></span>
                    <span>Checking...</span>
                {:else}
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                        <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                        <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                    </svg>
                    <span>Run Check</span>
                {/if}
            </button>

            <!-- Collapse / Expand All -->
            <button
                type="button"
                class="btn-tool"
                onclick={collapseAll}
                title="Collapse All Files"
            >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M1 8a.5.5 0 0 1 .5-.5h13a.5.5 0 0 1 0 1h-13A.5.5 0 0 1 1 8z"/>
                </svg>
            </button>
            <button
                type="button"
                class="btn-tool"
                onclick={expandAll}
                title="Expand All Files"
            >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 4a.5.5 0 0 1 .5.5v3h3a.5.5 0 0 1 0 1h-3v3a.5.5 0 0 1-1 0v-3h-3a.5.5 0 0 1 0-1h3v-3A.5.5 0 0 1 8 4z"/>
                </svg>
            </button>

            <!-- Clear Diagnostics -->
            <button
                type="button"
                class="btn-tool"
                onclick={clearAllProblems}
                title="Clear All Diagnostics"
            >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path fill-rule="evenodd" d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1v1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118zM2.5 3V2h11v1h-11z"/>
                </svg>
                <span>Clear</span>
            </button>

            <!-- Close Panel -->
            <button
                type="button"
                class="btn-tool"
                onclick={closeBottomPanel}
                title="Close Problems Panel"
            >
                <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                </svg>
            </button>
        </div>
    </header>

    <!-- Problems Tree / Content -->
    <div class="problems-content">
        {#if $problemsList.length === 0}
            <div class="empty-state">
                <svg class="check-icon" width="28" height="28" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zm-3.97-3.03a.75.75 0 0 0-1.08.022L7.477 9.417 5.384 7.323a.75.75 0 0 0-1.06 1.06L6.97 11.03a.75.75 0 0 0 1.079-.02l3.992-4.99a.75.75 0 0 0-.01-1.05z"/>
                </svg>
                <p class="empty-title">No problems have been detected in the workspace.</p>
                <p class="empty-sub">Errors, warnings, and messages from LSP servers and compilers will appear here.</p>
            </div>
        {:else if $filteredProblemsByFile.length === 0}
            <div class="empty-state">
                <p class="empty-title">No problems match the current filter.</p>
                <button type="button" class="btn-reset-filter" onclick={resetFilters}>
                    Reset Filters
                </button>
            </div>
        {:else}
            <div class="problems-tree">
                {#each $filteredProblemsByFile as group (group.filePath)}
                    <div class="file-group">
                        <!-- File Header Row -->
                        <button
                            type="button"
                            class="file-header-row"
                            onclick={() => toggleFileCollapse(group.filePath)}
                        >
                            <span class="chevron" class:collapsed={collapsedFiles[group.filePath]}>
                                ▼
                            </span>
                            <span class="file-icon">📄</span>
                            <span class="file-name">{group.fileName}</span>
                            {#if formatRelativePath(group.filePath)}
                                <span class="file-dir">{formatRelativePath(group.filePath)}</span>
                            {/if}

                            <div class="file-badges">
                                {#if group.errorCount > 0}
                                    <span class="pill error-pill">{group.errorCount}</span>
                                {/if}
                                {#if group.warningCount > 0}
                                    <span class="pill warning-pill">{group.warningCount}</span>
                                {/if}
                                {#if group.infoCount > 0}
                                    <span class="pill info-pill">{group.infoCount}</span>
                                {/if}
                            </div>
                        </button>

                        <!-- Problem Item Rows -->
                        {#if !collapsedFiles[group.filePath]}
                            <div class="problem-items">
                                {#each group.problems as problem (problem.id)}
                                    <button
                                        type="button"
                                        class="problem-row"
                                        class:selected={selectedProblemId === problem.id}
                                        onclick={() => handleSelectProblem(problem)}
                                    >
                                        <!-- Severity Icon -->
                                        <span class="severity-icon {problem.severity}">
                                            {#if problem.severity === "error"}
                                                ✕
                                            {:else if problem.severity === "warning"}
                                                ⚠
                                            {:else}
                                                ℹ
                                            {/if}
                                        </span>

                                        <!-- Message -->
                                        <span class="problem-message">{problem.message}</span>

                                        <!-- Source Tag & Code -->
                                        {#if problem.code || problem.source}
                                            <span class="problem-source-tag">
                                                [{problem.source}{problem.code ? `: ${problem.code}` : ""}]
                                            </span>
                                        {/if}

                                        <!-- Source Type (LSP vs Compiler) -->
                                        <span class="source-type-badge {problem.sourceType}">
                                            {problem.sourceType.toUpperCase()}
                                        </span>

                                        <!-- Line & Column Location -->
                                        <span class="problem-location">
                                            [{problem.line}, {problem.column}]
                                        </span>
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>

<style>
    .problems-panel {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #cccccc;
        font-family: inherit;
        font-size: 12px;
        overflow: hidden;
        user-select: none;
    }

    /* Toolbar */
    .panel-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 4px 10px;
        background: #252526;
        border-bottom: 1px solid #333333;
        gap: 10px;
        flex-shrink: 0;
    }

    .toolbar-left,
    .toolbar-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .filter-box {
        position: relative;
        display: flex;
        align-items: center;
        width: 260px;
    }

    .search-icon {
        position: absolute;
        left: 7px;
        color: #888888;
        pointer-events: none;
    }

    .filter-input {
        width: 100%;
        background: #1e1e1e;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
        color: #e0e0e0;
        font-size: 11px;
        padding: 3px 22px 3px 24px;
        outline: none;
    }

    .filter-input:focus {
        border-color: #007acc;
    }

    .btn-clear-filter {
        position: absolute;
        right: 6px;
        background: transparent;
        border: none;
        color: #888888;
        font-size: 10px;
        cursor: pointer;
        padding: 0;
    }

    .btn-clear-filter:hover {
        color: #ffffff;
    }

    /* Severity Toggles */
    .severity-toggles {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .severity-btn {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        padding: 2px 7px;
        border-radius: 3px;
        background: transparent;
        border: 1px solid transparent;
        font-size: 11px;
        cursor: pointer;
        opacity: 0.5;
        transition: all 0.15s ease;
    }

    .severity-btn.active {
        opacity: 1;
        background: rgba(255, 255, 255, 0.05);
        border-color: rgba(255, 255, 255, 0.1);
    }

    .severity-btn.error {
        color: #f48771;
    }

    .severity-btn.warning {
        color: #cca700;
    }

    .severity-btn.info {
        color: #75beff;
    }

    .source-select {
        background: #1e1e1e;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
        color: #cccccc;
        font-size: 11px;
        padding: 2px 6px;
        outline: none;
        cursor: pointer;
    }

    /* Toolbar Action Buttons */
    .btn-tool {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        background: transparent;
        border: none;
        color: #aaaaaa;
        padding: 3px 6px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
    }

    .btn-tool:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.08);
        color: #ffffff;
    }

    .btn-tool:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .spinner {
        width: 10px;
        height: 10px;
        border: 2px solid rgba(255, 255, 255, 0.2);
        border-top-color: #4ec9b0;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to {
            transform: rotate(360deg);
        }
    }

    /* Problems Content */
    .problems-content {
        flex: 1;
        overflow-y: auto;
        padding: 0;
    }

    .empty-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        height: 100%;
        min-height: 150px;
        color: #888888;
        text-align: center;
        padding: 20px;
    }

    .check-icon {
        color: #4ec9b0;
        margin-bottom: 8px;
    }

    .empty-title {
        font-size: 13px;
        font-weight: 500;
        color: #cccccc;
        margin: 0 0 4px 0;
    }

    .empty-sub {
        font-size: 11px;
        margin: 0;
    }

    .btn-reset-filter {
        margin-top: 10px;
        background: #0e639c;
        border: none;
        color: #ffffff;
        padding: 4px 12px;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
    }

    .btn-reset-filter:hover {
        background: #1177bb;
    }

    /* File Groups */
    .problems-tree {
        display: flex;
        flex-direction: column;
    }

    .file-group {
        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
    }

    .file-header-row {
        display: flex;
        align-items: center;
        gap: 6px;
        width: 100%;
        padding: 5px 12px;
        background: rgba(255, 255, 255, 0.02);
        border: none;
        color: #e0e0e0;
        font-size: 12px;
        cursor: pointer;
        text-align: left;
    }

    .file-header-row:hover {
        background: rgba(255, 255, 255, 0.06);
    }

    .chevron {
        font-size: 9px;
        color: #888888;
        transition: transform 0.15s ease;
        display: inline-block;
        width: 12px;
    }

    .chevron.collapsed {
        transform: rotate(-90deg);
    }

    .file-icon {
        font-size: 12px;
    }

    .file-name {
        font-weight: 600;
        color: #ffffff;
    }

    .file-dir {
        color: #888888;
        font-size: 11px;
    }

    .file-badges {
        margin-left: auto;
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .pill {
        padding: 1px 6px;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 600;
    }

    .error-pill {
        background: rgba(244, 135, 113, 0.2);
        color: #f48771;
    }

    .warning-pill {
        background: rgba(204, 167, 0, 0.2);
        color: #cca700;
    }

    .info-pill {
        background: rgba(117, 190, 255, 0.2);
        color: #75beff;
    }

    /* Problem Item Rows */
    .problem-items {
        display: flex;
        flex-direction: column;
    }

    .problem-row {
        display: flex;
        align-items: center;
        gap: 8px;
        width: 100%;
        padding: 4px 12px 4px 28px;
        background: transparent;
        border: none;
        color: #cccccc;
        font-size: 11px;
        cursor: pointer;
        text-align: left;
        transition: background 0.1s ease;
    }

    .problem-row:hover {
        background: rgba(255, 255, 255, 0.04);
    }

    .problem-row.selected {
        background: rgba(9, 71, 113, 0.5);
        color: #ffffff;
    }

    .severity-icon {
        font-size: 12px;
        font-weight: bold;
        flex-shrink: 0;
        width: 14px;
        text-align: center;
    }

    .severity-icon.error {
        color: #f48771;
    }

    .severity-icon.warning {
        color: #cca700;
    }

    .severity-icon.info,
    .severity-icon.hint {
        color: #75beff;
    }

    .problem-message {
        flex: 1;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        color: #e0e0e0;
    }

    .problem-source-tag {
        color: #888888;
        font-size: 10px;
        flex-shrink: 0;
    }

    .source-type-badge {
        font-size: 9px;
        padding: 1px 4px;
        border-radius: 2px;
        flex-shrink: 0;
        font-weight: 500;
    }

    .source-type-badge.lsp {
        background: rgba(78, 201, 176, 0.15);
        color: #4ec9b0;
    }

    .source-type-badge.compiler {
        background: rgba(206, 145, 120, 0.15);
        color: #ce9178;
    }

    .problem-location {
        color: #888888;
        font-size: 10px;
        flex-shrink: 0;
        font-family: monospace;
    }
</style>
