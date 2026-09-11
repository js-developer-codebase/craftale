<script lang="ts">
    import { onMount } from "svelte";
    import {
        isGitRepo,
        currentBranch,
        upstreamBranch,
        aheadCount,
        behindCount,
        stagedFiles,
        unstagedFiles,
        untrackedFiles,
        totalChangesCount,
        commitMessage,
        isLoadingStatus,
        isCommitting,
        isSyncing,
        gitError,
        refreshGitStatus,
        stageFiles,
        stageAll,
        unstageFiles,
        unstageAll,
        discardFiles,
        discardAllWorkingTree,
        commitChanges,
        pullChanges,
        pushChanges,
        fetchChanges,
        openBranchModal,
        initRepository,
        openGitFile,
        type GitFileEntry
    } from "../stores/git";
    import { workspacePath } from "../stores/workspace";
    import { openWorkingTreeDiff, openStagedDiff } from "../stores/diff";
    import BranchCompareModal from "./BranchCompareModal.svelte";

    let isStagedCollapsed = $state(false);
    let isChangesCollapsed = $state(false);
    let isMenuOpen = $state(false);
    let isCompareBranchesOpen = $state(false);
    let commitTextareaEl = $state<HTMLTextAreaElement | null>(null);

    onMount(() => {
        if ($workspacePath) {
            void refreshGitStatus();
        }
    });

    function handleCommitKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            void commitChanges();
        }
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

    function getStatusLabel(status: string): string {
        switch (status) {
            case "M": return "M";
            case "A": return "A";
            case "D": return "D";
            case "R": return "R";
            case "C": return "C";
            case "?": return "U";
            default: return status;
        }
    }

    function getStatusTitle(status: string): string {
        switch (status) {
            case "M": return "Modified";
            case "A": return "Added";
            case "D": return "Deleted";
            case "R": return "Renamed";
            case "C": return "Copied";
            case "?": return "Untracked";
            default: return status;
        }
    }

    const combinedWorkingTree = $derived([...$unstagedFiles, ...$untrackedFiles]);
</script>

<div class="source-control-panel" role="region" aria-label="Source Control">
    {#if !$isGitRepo}
        <!-- Non-Git Repository View -->
        <div class="non-repo-view">
            <div class="non-repo-icon">
                <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="6" cy="6" r="3" />
                    <circle cx="6" cy="18" r="3" />
                    <circle cx="18" cy="9" r="3" />
                    <line x1="6" y1="9" x2="6" y2="15" />
                    <path d="M18 9a9 9 0 0 1-9 9" />
                </svg>
            </div>
            <span class="non-repo-title">No Source Control</span>
            <p class="non-repo-desc">
                The current folder is not a Git repository.
            </p>
            <button
                type="button"
                class="btn btn-primary"
                onclick={initRepository}
            >
                Initialize Repository
            </button>
        </div>
    {:else}
        <!-- Header -->
        <div class="panel-header">
            <span class="header-title">SOURCE CONTROL</span>

            <!-- Branch Indicator Button -->
            {#if $currentBranch}
                <button
                    type="button"
                    class="branch-badge-btn"
                    title={`Current branch: ${$currentBranch}. Click to checkout branch.`}
                    onclick={openBranchModal}
                >
                    <span class="branch-icon">⎇</span>
                    <span class="branch-name">{$currentBranch}</span>
                </button>
            {/if}

            <div class="header-actions">
                <!-- Sync Button (Pull / Push) -->
                <button
                    type="button"
                    class="icon-btn"
                    title={`Synchronize Changes (${$behindCount}↓ ${$aheadCount}↑)`}
                    disabled={$isSyncing || $isLoadingStatus}
                    onclick={async () => {
                        if ($behindCount > 0) {
                            await pullChanges();
                        } else {
                            await pushChanges();
                        }
                    }}
                    aria-label="Sync"
                >
                    <span class="sync-arrows">
                        {#if $behindCount > 0}↓{$behindCount}{/if}
                        {#if $aheadCount > 0}↑{$aheadCount}{/if}
                        {#if $behindCount === 0 && $aheadCount === 0}⇅{/if}
                    </span>
                </button>

                <!-- Compare Branches Button -->
                <button
                    type="button"
                    class="icon-btn"
                    title="Compare Branches..."
                    onclick={() => (isCompareBranchesOpen = true)}
                    aria-label="Compare Branches"
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3h9.05zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8h2.05zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1h9.05z"/>
                    </svg>
                </button>

                <!-- Refresh Button -->
                <button
                    type="button"
                    class="icon-btn"
                    title="Refresh Status"
                    disabled={$isLoadingStatus}
                    onclick={refreshGitStatus}
                    aria-label="Refresh Status"
                >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <path d="M13.65 2.35A7.958 7.958 0 0 0 8 0a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24l-2.24 2.24h6V0l-2.35 2.35z"/>
                    </svg>
                </button>

                <!-- Options Menu Dropdown -->
                <div class="menu-container">
                    <button
                        type="button"
                        class="icon-btn"
                        title="More Actions..."
                        onclick={() => (isMenuOpen = !isMenuOpen)}
                        aria-label="More Actions"
                    >
                        ⋯
                    </button>

                    {#if isMenuOpen}
                        <div class="dropdown-menu" role="menu" onclick={() => (isMenuOpen = false)}>
                            <button type="button" class="menu-item" onclick={() => (isCompareBranchesOpen = true)}>
                                Compare Branches...
                            </button>
                            <div class="menu-divider"></div>
                            <button type="button" class="menu-item" onclick={pullChanges}>
                                Pull
                            </button>
                            <button type="button" class="menu-item" onclick={pushChanges}>
                                Push
                            </button>
                            <button type="button" class="menu-item" onclick={fetchChanges}>
                                Fetch
                            </button>
                            <div class="menu-divider"></div>
                            <button type="button" class="menu-item" onclick={stageAll}>
                                Stage All Changes
                            </button>
                            <button type="button" class="menu-item" onclick={unstageAll}>
                                Unstage All Changes
                            </button>
                            <div class="menu-divider"></div>
                            <button type="button" class="menu-item" onclick={openBranchModal}>
                                Checkout Branch...
                            </button>
                        </div>
                    {/if}
                </div>
            </div>
        </div>

        <!-- Commit Box -->
        <div class="commit-section">
            <div class="commit-input-wrapper">
                <textarea
                    bind:this={commitTextareaEl}
                    class="commit-textarea"
                    placeholder="Message (Ctrl+Enter to commit)"
                    rows="3"
                    bind:value={$commitMessage}
                    onkeydown={handleCommitKeyDown}
                ></textarea>
            </div>

            <button
                type="button"
                class="btn btn-commit"
                disabled={$isCommitting || !$commitMessage.trim() || $totalChangesCount === 0}
                onclick={commitChanges}
            >
                {#if $isCommitting}
                    <span class="spinner"></span>
                    <span>Committing...</span>
                {:else}
                    <span>✓ Commit</span>
                    {#if $stagedFiles.length === 0 && combinedWorkingTree.length > 0}
                        <span class="commit-hint">(auto-stage)</span>
                    {/if}
                {/if}
            </button>
        </div>

        <!-- Error Banner -->
        {#if $gitError}
            <div class="git-error-banner" role="alert">
                <span>⚠️ {$gitError}</span>
            </div>
        {/if}

        <!-- Status Lists -->
        <div class="changes-scroller">
            <!-- Staged Changes Accordion -->
            {#if $stagedFiles.length > 0}
                <div class="accordion-group">
                    <div
                        class="accordion-header"
                        role="button"
                        tabindex="0"
                        onclick={() => (isStagedCollapsed = !isStagedCollapsed)}
                        onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") isStagedCollapsed = !isStagedCollapsed;
                        }}
                    >
                        <span class="chevron" class:expanded={!isStagedCollapsed}>▸</span>
                        <span class="group-title">STAGED CHANGES</span>
                        <span class="count-pill">{$stagedFiles.length}</span>

                        <div class="group-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                            <button
                                type="button"
                                class="action-btn"
                                title="Unstage All"
                                onclick={unstageAll}
                                aria-label="Unstage All"
                            >
                                －
                            </button>
                        </div>
                    </div>

                    {#if !isStagedCollapsed}
                        <div class="file-list" role="list">
                            {#each $stagedFiles as file (file.path)}
                                <div
                                    class="file-row"
                                    role="listitem"
                                    tabindex="0"
                                    onclick={() => openStagedDiff(file)}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") openStagedDiff(file);
                                    }}
                                >
                                    <span class="file-icon">{getFileIcon(file.fileName)}</span>
                                    <span class="file-name" title={file.path}>{file.fileName}</span>

                                    {#if getDirDisplay(file.relativePath)}
                                        <span class="file-dir" title={file.relativePath}>
                                            {getDirDisplay(file.relativePath)}
                                        </span>
                                    {/if}

                                    <div class="row-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                                        <button
                                            type="button"
                                            class="action-btn"
                                            title="Open File"
                                            onclick={() => openGitFile(file)}
                                            aria-label="Open File"
                                        >
                                            📄
                                        </button>
                                        <button
                                            type="button"
                                            class="action-btn"
                                            title="Unstage"
                                            onclick={() => unstageFiles([file.path])}
                                            aria-label="Unstage"
                                        >
                                            －
                                        </button>
                                    </div>

                                    <span
                                        class="status-badge"
                                        class:status-m={file.status === "M"}
                                        class:status-a={file.status === "A"}
                                        class:status-d={file.status === "D"}
                                        class:status-r={file.status === "R"}
                                        title={getStatusTitle(file.status)}
                                    >
                                        {getStatusLabel(file.status)}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Changes (Working Tree) Accordion -->
            {#if combinedWorkingTree.length > 0}
                <div class="accordion-group">
                    <div
                        class="accordion-header"
                        role="button"
                        tabindex="0"
                        onclick={() => (isChangesCollapsed = !isChangesCollapsed)}
                        onkeydown={(e) => {
                            if (e.key === "Enter" || e.key === " ") isChangesCollapsed = !isChangesCollapsed;
                        }}
                    >
                        <span class="chevron" class:expanded={!isChangesCollapsed}>▸</span>
                        <span class="group-title">CHANGES</span>
                        <span class="count-pill">{combinedWorkingTree.length}</span>

                        <div class="group-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                            <button
                                type="button"
                                class="action-btn"
                                title="Discard All Changes"
                                onclick={discardAllWorkingTree}
                                aria-label="Discard All Changes"
                            >
                                ↺
                            </button>
                            <button
                                type="button"
                                class="action-btn"
                                title="Stage All"
                                onclick={stageAll}
                                aria-label="Stage All"
                            >
                                ＋
                            </button>
                        </div>
                    </div>

                    {#if !isChangesCollapsed}
                        <div class="file-list" role="list">
                            {#each combinedWorkingTree as file (file.path)}
                                <div
                                    class="file-row"
                                    role="listitem"
                                    tabindex="0"
                                    onclick={() => openWorkingTreeDiff(file)}
                                    onkeydown={(e) => {
                                        if (e.key === "Enter") openWorkingTreeDiff(file);
                                    }}
                                >
                                    <span class="file-icon">{getFileIcon(file.fileName)}</span>
                                    <span class="file-name" title={file.path}>{file.fileName}</span>

                                    {#if getDirDisplay(file.relativePath)}
                                        <span class="file-dir" title={file.relativePath}>
                                            {getDirDisplay(file.relativePath)}
                                        </span>
                                    {/if}

                                    <div class="row-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                                        <button
                                            type="button"
                                            class="action-btn"
                                            title="Open File"
                                            onclick={() => openGitFile(file)}
                                            aria-label="Open File"
                                        >
                                            📄
                                        </button>
                                        <button
                                            type="button"
                                            class="action-btn"
                                            title="Discard Changes"
                                            onclick={() => discardFiles([file.path], file.status === "?")}
                                            aria-label="Discard Changes"
                                        >
                                            ↺
                                        </button>
                                        <button
                                            type="button"
                                            class="action-btn"
                                            title="Stage"
                                            onclick={() => stageFiles([file.path])}
                                            aria-label="Stage"
                                        >
                                            ＋
                                        </button>
                                    </div>

                                    <span
                                        class="status-badge"
                                        class:status-m={file.status === "M"}
                                        class:status-d={file.status === "D"}
                                        class:status-u={file.status === "?"}
                                        title={getStatusTitle(file.status)}
                                    >
                                        {getStatusLabel(file.status)}
                                    </span>
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
            {/if}

            <!-- Clean Working Tree Notice -->
            {#if $totalChangesCount === 0 && !$isLoadingStatus}
                <div class="clean-notice">
                    <span>✓ Working tree clean</span>
                    <span class="clean-sub">No uncommitted changes</span>
                </div>
            {/if}
        </div>
    {/if}
</div>

<BranchCompareModal bind:isOpen={isCompareBranchesOpen} onClose={() => (isCompareBranchesOpen = false)} />

<style>
    .source-control-panel {
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

    /* Non-Repo View */
    .non-repo-view {
        flex: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        text-align: center;
        gap: 12px;
        color: #858585;
    }

    .non-repo-icon {
        color: #555555;
    }

    .non-repo-title {
        font-size: 13px;
        font-weight: 600;
        color: #cccccc;
    }

    .non-repo-desc {
        font-size: 11px;
        margin: 0;
        line-height: 1.4;
    }

    /* Header */
    .panel-header {
        height: 35px;
        min-height: 35px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        border-bottom: 1px solid #333333;
        gap: 6px;
    }

    .header-title {
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        color: #bbbbbb;
        white-space: nowrap;
    }

    .branch-badge-btn {
        background: #37373d;
        border: 1px solid #4a4a4f;
        border-radius: 3px;
        color: #ffffff;
        font-size: 11px;
        padding: 2px 6px;
        display: flex;
        align-items: center;
        gap: 4px;
        cursor: pointer;
        max-width: 110px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .branch-badge-btn:hover {
        background: #46464d;
    }

    .branch-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .header-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        margin-left: auto;
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
        font-size: 12px;
    }

    .icon-btn:hover:not(:disabled) {
        background: #37373d;
        color: #ffffff;
    }

    .icon-btn:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .sync-arrows {
        font-size: 11px;
        font-weight: 700;
        color: #007acc;
    }

    /* Menu Container */
    .menu-container {
        position: relative;
    }

    .dropdown-menu {
        position: absolute;
        right: 0;
        top: 24px;
        background: #252526;
        border: 1px solid #454545;
        border-radius: 4px;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
        padding: 4px 0;
        min-width: 160px;
        z-index: 100;
    }

    .menu-item {
        width: 100%;
        text-align: left;
        background: transparent;
        border: none;
        color: #cccccc;
        padding: 6px 12px;
        font-size: 12px;
        cursor: pointer;
    }

    .menu-item:hover {
        background: #094771;
        color: #ffffff;
    }

    .menu-divider {
        height: 1px;
        background: #333333;
        margin: 4px 0;
    }

    /* Commit Section */
    .commit-section {
        padding: 8px 10px;
        display: flex;
        flex-direction: column;
        gap: 6px;
        border-bottom: 1px solid #2b2b2b;
    }

    .commit-input-wrapper {
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
    }

    .commit-input-wrapper:focus-within {
        border-color: #007acc;
    }

    .commit-textarea {
        width: 100%;
        background: transparent;
        border: none;
        color: #ffffff;
        padding: 6px 8px;
        font-family: inherit;
        font-size: 12px;
        resize: vertical;
        min-height: 50px;
        outline: none;
        box-sizing: border-box;
    }

    .commit-textarea::placeholder {
        color: #858585;
    }

    .btn-commit {
        width: 100%;
        height: 28px;
        background: #007acc;
        color: #ffffff;
        border: none;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
    }

    .btn-commit:hover:not(:disabled) {
        background: #0098ff;
    }

    .btn-commit:disabled {
        opacity: 0.4;
        cursor: default;
    }

    .commit-hint {
        font-size: 10px;
        opacity: 0.7;
    }

    .spinner {
        width: 12px;
        height: 12px;
        border: 2px solid #ffffff44;
        border-top-color: #ffffff;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    /* Error Banner */
    .git-error-banner {
        background: #5a1d1d;
        color: #f48771;
        padding: 6px 10px;
        font-size: 11px;
    }

    /* Scroller */
    .changes-scroller {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    /* Accordion */
    .accordion-group {
        display: flex;
        flex-direction: column;
    }

    .accordion-header {
        height: 24px;
        padding: 0 8px 0 6px;
        display: flex;
        align-items: center;
        gap: 4px;
        background: #252526;
        cursor: pointer;
        user-select: none;
        border-top: 1px solid #2b2b2b;
    }

    .accordion-header:hover {
        background: #2a2d2e;
    }

    .accordion-header:hover .group-actions {
        display: flex;
    }

    .chevron {
        font-size: 9px;
        color: #858585;
        width: 12px;
        display: inline-block;
        transition: transform 0.12s ease;
    }

    .chevron.expanded {
        transform: rotate(90deg);
    }

    .group-title {
        font-size: 11px;
        font-weight: 700;
        color: #bbbbbb;
        letter-spacing: 0.3px;
    }

    .count-pill {
        font-size: 10px;
        font-weight: 700;
        background: #37373d;
        color: #cccccc;
        padding: 1px 5px;
        border-radius: 8px;
        margin-left: 2px;
    }

    .group-actions {
        margin-left: auto;
        display: none;
        align-items: center;
        gap: 2px;
    }

    .action-btn {
        background: transparent;
        border: none;
        color: #aaaaaa;
        padding: 2px 4px;
        border-radius: 2px;
        cursor: pointer;
        font-size: 11px;
    }

    .action-btn:hover {
        background: #3c3c3c;
        color: #ffffff;
    }

    /* File List */
    .file-list {
        display: flex;
        flex-direction: column;
    }

    .file-row {
        height: 22px;
        padding-left: 18px;
        padding-right: 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        cursor: pointer;
        outline: none;
    }

    .file-row:hover {
        background: #2a2d2e;
    }

    .file-row:hover .row-actions {
        display: flex;
    }

    .file-icon {
        font-size: 12px;
    }

    .file-name {
        font-size: 12px;
        color: #cccccc;
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

    .row-actions {
        margin-left: auto;
        display: none;
        align-items: center;
        gap: 2px;
        background: #2a2d2e;
    }

    /* Status Badges */
    .status-badge {
        font-size: 11px;
        font-weight: 700;
        min-width: 14px;
        text-align: right;
        margin-left: 4px;
    }

    .status-m {
        color: #e2c08d;
    }

    .status-a {
        color: #73c991;
    }

    .status-d {
        color: #e06c75;
    }

    .status-r {
        color: #569cd6;
    }

    .status-u {
        color: #73c991;
    }

    /* Clean notice */
    .clean-notice {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 32px 16px;
        color: #858585;
        gap: 4px;
    }

    .clean-sub {
        font-size: 11px;
        color: #666666;
    }

    .btn {
        padding: 6px 14px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        border: none;
    }

    .btn-primary {
        background: #007acc;
        color: #ffffff;
    }

    .btn-primary:hover {
        background: #0098ff;
    }
</style>
