<script lang="ts">
    import {
        activeSidebarView,
        isSidebarVisible,
        toggleSidebarView,
        type SidebarView
    } from "../stores/navigation";
    import { totalMatches } from "../stores/search";
    import { totalChangesCount, isGitRepo } from "../stores/git";
    import { openedFiles, toggleTerminal } from "../stores/workspace";
    import {
        toggleBottomPanel,
        isBottomPanelVisible,
        activeBottomTab
    } from "../stores/panel";
    import { problemsSummary } from "../stores/problems";

    const dirtyCount = $derived($openedFiles.filter((f) => f.isDirty).length);
</script>

<aside class="activity-bar" aria-label="Activity Bar">
    <!-- Top Action Views -->
    <div class="top-views">
        <!-- Explorer Button -->
        <button
            type="button"
            class="action-item"
            class:active={$isSidebarVisible && $activeSidebarView === "explorer"}
            title="Explorer (Ctrl+Shift+E)"
            onclick={() => toggleSidebarView("explorer")}
            aria-label="Explorer"
        >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
                <polyline points="13 2 13 9 20 9" />
            </svg>

            {#if dirtyCount > 0}
                <span class="badge dirty" title={`${dirtyCount} unsaved files`}>
                    {dirtyCount}
                </span>
            {/if}
        </button>

        <!-- Search Button -->
        <button
            type="button"
            class="action-item"
            class:active={$isSidebarVisible && $activeSidebarView === "search"}
            title="Search (Ctrl+Shift+F)"
            onclick={() => toggleSidebarView("search")}
            aria-label="Search"
        >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="11" cy="11" r="7" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>

            {#if $totalMatches > 0}
                <span class="badge search" title={`${$totalMatches} search matches`}>
                    {$totalMatches > 99 ? "99+" : $totalMatches}
                </span>
            {/if}
        </button>

        <!-- Source Control Button -->
        <button
            type="button"
            class="action-item"
            class:active={$isSidebarVisible && $activeSidebarView === "sourceControl"}
            title="Source Control (Ctrl+Shift+G)"
            onclick={() => toggleSidebarView("sourceControl")}
            aria-label="Source Control"
        >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="6" cy="6" r="3" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="18" cy="9" r="3" />
                <line x1="6" y1="9" x2="6" y2="15" />
                <path d="M18 9a9 9 0 0 1-9 9" />
            </svg>

            {#if $isGitRepo && $totalChangesCount > 0}
                <span class="badge git" title={`${$totalChangesCount} pending changes`}>
                    {$totalChangesCount > 99 ? "99+" : $totalChangesCount}
                </span>
            {/if}
        </button>
    </div>

    <!-- Bottom Views / Toggles -->
    <div class="bottom-views">
        <!-- Problems Toggle -->
        <button
            type="button"
            class="action-item"
            class:active={$isBottomPanelVisible && $activeBottomTab === "problems"}
            title="Problems (Ctrl+Shift+M)"
            onclick={() => toggleBottomPanel("problems")}
            aria-label="Problems"
        >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>

            {#if $problemsSummary.errorCount > 0 || $problemsSummary.warningCount > 0}
                <span
                    class="badge"
                    class:error={$problemsSummary.errorCount > 0}
                    class:warning={$problemsSummary.errorCount === 0 && $problemsSummary.warningCount > 0}
                    title={`${$problemsSummary.errorCount} errors, ${$problemsSummary.warningCount} warnings`}
                >
                    {$problemsSummary.errorCount > 0 ? $problemsSummary.errorCount : $problemsSummary.warningCount}
                </span>
            {/if}
        </button>

        <!-- Terminal Toggle -->
        <button
            type="button"
            class="action-item"
            class:active={$isBottomPanelVisible && $activeBottomTab === "terminal"}
            title="Toggle Terminal (Ctrl+`)"
            onclick={() => toggleBottomPanel("terminal")}
            aria-label="Toggle Terminal"
        >
            <svg class="action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="4 17 10 11 4 5" />
                <line x1="12" y1="19" x2="20" y2="19" />
            </svg>
        </button>
    </div>
</aside>

<style>
    .activity-bar {
        width: 48px;
        min-width: 48px;
        height: 100%;
        background: #333333;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        align-items: center;
        border-right: 1px solid #252526;
        user-select: none;
        z-index: 10;
        flex-shrink: 0;
    }

    .top-views,
    .bottom-views {
        display: flex;
        flex-direction: column;
        align-items: center;
        width: 100%;
    }

    .action-item {
        position: relative;
        width: 48px;
        height: 48px;
        background: transparent;
        border: none;
        padding: 0;
        margin: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #858585;
        cursor: pointer;
        transition: color 0.15s ease, background 0.15s ease;
        outline: none;
    }

    .action-item:hover {
        color: #ffffff;
    }

    .action-item.active {
        color: #ffffff;
    }

    .action-item.active::before {
        content: "";
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #ffffff;
    }

    .action-icon {
        width: 22px;
        height: 22px;
    }

    .badge {
        position: absolute;
        top: 6px;
        right: 4px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 8px;
        font-size: 10px;
        font-weight: 700;
        line-height: 16px;
        text-align: center;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .badge.dirty {
        background: #007acc;
        color: #ffffff;
    }

    .badge.git {
        background: #007acc;
        color: #ffffff;
    }

    .badge.search {
        background: #4d4d4d;
        color: #ffffff;
        border: 1px solid #666666;
    }

    .badge.error {
        background: #f48771;
        color: #ffffff;
    }

    .badge.warning {
        background: #cca700;
        color: #1e1e1e;
    }
</style>
