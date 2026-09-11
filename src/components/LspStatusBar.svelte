<script lang="ts">
    import {
        lspServers,
        type LspServerInfo
    } from "../stores/lsp";
    import { problemsSummary } from "../stores/problems";
    import { openBottomPanel } from "../stores/panel";
    import { lspManager } from "../services/lsp/LspClientManager";
    import { notify } from "../stores/notifications";

    let showMenu = $state(false);
    let restartingServerId = $state<string | null>(null);

    function toggleMenu() {
        showMenu = !showMenu;
    }

    function closeMenu() {
        showMenu = false;
    }

    function handleOpenProblems() {
        openBottomPanel("problems");
    }

    async function handleRestart(serverId: string) {
        restartingServerId = serverId;
        try {
            const ok = await lspManager.restartServer(serverId);
            if (ok) {
                notify.info(`Restarted ${serverId} language server`);
            } else {
                notify.warning(`Failed to restart ${serverId} language server`);
            }
        } catch (err: any) {
            notify.error(`Restart failed: ${err.message}`);
        } finally {
            restartingServerId = null;
        }
    }

    async function handleRestartAll() {
        const servers = Object.keys($lspServers);
        for (const sid of servers) {
            await handleRestart(sid);
        }
        showMenu = false;
    }
</script>

<div class="lsp-status-bar">
    <!-- Diagnostics summary (Errors & Warnings) - Click to Open Problems Panel -->
    <button
        type="button"
        class="status-item diagnostics-item"
        onclick={handleOpenProblems}
        title="Workspace Problems (Click to open Problems Panel)"
    >
        <span class="diag-error">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14zm0-1A6 6 0 1 0 8 2a6 6 0 0 0 0 12zM7 4h2v5H7V4zm0 6h2v2H7v-2z"/>
            </svg>
            {$problemsSummary.errorCount}
        </span>
        <span class="diag-warning">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M7.56 1.44a1 1 0 0 1 1.78 0l6.5 12.5A1 1 0 0 1 15 15H1a1 1 0 0 1-.89-1.44l6.5-12.5zM8 4.5 2.5 14h11L8 4.5zM7.5 7h1v4h-1V7zm0 5h1v1.5h-1V12z"/>
            </svg>
            {$problemsSummary.warningCount}
        </span>
    </button>

    <!-- Active Language Server Status Pill -->
    <button
        type="button"
        class="status-item server-toggle-btn"
        onclick={toggleMenu}
        title="Language Server Status (Click to manage)"
    >
        <span class="pulse-dot"></span>
        <span class="label">LSP</span>
        <span class="active-count">
            {Object.values($lspServers).filter(s => s.status === 'ready').length} active
        </span>
    </button>

    <!-- Popup Menu for Language Servers -->
    {#if showMenu}
        <!-- Backdrop -->
        <div class="menu-backdrop" onclick={closeMenu} role="presentation"></div>

        <div class="lsp-menu">
            <div class="menu-header">
                <span>Language Servers</span>
                <button type="button" class="btn-restart-all" onclick={handleRestartAll}>
                    Restart All
                </button>
            </div>

            <div class="menu-list">
                {#each Object.values($lspServers) as server (server.id)}
                    <div class="menu-item">
                        <div class="server-meta">
                            <span class="status-indicator {server.status}"></span>
                            <span class="server-name">{server.name}</span>
                            <span class="server-status-text">({server.status})</span>
                        </div>

                        {#if server.error}
                            <div class="server-error" title={server.error}>
                                {server.error}
                            </div>
                        {/if}

                        <button
                            type="button"
                            class="btn-action"
                            disabled={restartingServerId === server.id}
                            onclick={() => handleRestart(server.id)}
                        >
                            {restartingServerId === server.id ? "Restarting..." : "Restart"}
                        </button>
                    </div>
                {/each}
            </div>
        </div>
    {/if}
</div>

<style>
    .lsp-status-bar {
        position: relative;
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 11px;
        color: #cccccc;
        user-select: none;
    }

    .status-item {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        padding: 2px 6px;
        border-radius: 3px;
        background: transparent;
        border: none;
        color: #cccccc;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .status-item:hover {
        background: rgba(255, 255, 255, 0.08);
    }

    .diagnostics-item {
        cursor: default;
        gap: 8px;
    }

    .diag-error {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: #f48771;
    }

    .diag-warning {
        display: inline-flex;
        align-items: center;
        gap: 3px;
        color: #cca700;
    }

    .server-toggle-btn {
        background: rgba(255, 255, 255, 0.05);
        border: 1px solid rgba(255, 255, 255, 0.1);
        font-family: inherit;
    }

    .pulse-dot {
        width: 6px;
        height: 6px;
        border-radius: 50%;
        background: #4ec9b0;
        box-shadow: 0 0 4px rgba(78, 201, 176, 0.6);
    }

    .label {
        font-weight: 600;
        color: #4ec9b0;
    }

    .active-count {
        color: #888888;
        font-size: 10px;
    }

    /* Menu & Backdrop */
    .menu-backdrop {
        position: fixed;
        inset: 0;
        z-index: 998;
    }

    .lsp-menu {
        position: absolute;
        bottom: 28px;
        right: 0;
        width: 300px;
        background: #252526;
        border: 1px solid #454545;
        border-radius: 4px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, 0.5);
        z-index: 999;
        overflow: hidden;
        animation: fadeIn 0.12s ease-out;
    }

    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateY(4px);
        }
        to {
            opacity: 1;
            transform: translateY(0);
        }
    }

    .menu-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #1e1e1e;
        border-bottom: 1px solid #333333;
        font-weight: 600;
        font-size: 11px;
        color: #e0e0e0;
    }

    .btn-restart-all {
        background: #0e639c;
        border: none;
        color: #ffffff;
        font-size: 10px;
        padding: 2px 8px;
        border-radius: 2px;
        cursor: pointer;
    }

    .btn-restart-all:hover {
        background: #1177bb;
    }

    .menu-list {
        padding: 4px 0;
        max-height: 250px;
        overflow-y: auto;
    }

    .menu-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
        padding: 6px 12px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.04);
    }

    .menu-item:last-child {
        border-bottom: none;
    }

    .server-meta {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .status-indicator {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        flex-shrink: 0;
    }

    .status-indicator.ready {
        background: #4ec9b0;
    }

    .status-indicator.starting {
        background: #cca700;
    }

    .status-indicator.error {
        background: #f48771;
    }

    .status-indicator.stopped {
        background: #666666;
    }

    .server-name {
        flex: 1;
        font-weight: 500;
        color: #cccccc;
    }

    .server-status-text {
        font-size: 10px;
        color: #888888;
    }

    .server-error {
        font-size: 10px;
        color: #f48771;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
    }

    .btn-action {
        align-self: flex-end;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #cccccc;
        font-size: 10px;
        padding: 2px 6px;
        border-radius: 2px;
        cursor: pointer;
    }

    .btn-action:hover:not(:disabled) {
        background: rgba(255, 255, 255, 0.12);
    }

    .btn-action:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
</style>
