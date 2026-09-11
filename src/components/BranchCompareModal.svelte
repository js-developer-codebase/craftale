<script lang="ts">
    import { onMount } from "svelte";
    import { workspacePath } from "../stores/workspace";
    import { currentBranch, branchList } from "../stores/git";
    import { openBranchFileDiff } from "../stores/diff";
    import { notify } from "../stores/notifications";

    interface Props {
        isOpen: boolean;
        onClose: () => void;
    }

    let { isOpen = $bindable(), onClose }: Props = $props();

    let baseBranch = $state("");
    let compareBranch = $state("");
    let isLoading = $state(false);
    let changedFiles = $state<Array<{
        path: string;
        relativePath: string;
        fileName: string;
        status: string;
    }>>([]);
    let hasCompared = $state(false);

    $effect(() => {
        if (isOpen) {
            const current = $currentBranch || "main";
            if (!baseBranch) baseBranch = current;
            if (!compareBranch) {
                // Pick first branch that is not current
                const other = $branchList.find(b => b.name !== current)?.name || "";
                compareBranch = other;
            }
            if (baseBranch && compareBranch && baseBranch !== compareBranch) {
                void runComparison();
            }
        }
    });

    async function runComparison() {
        const ws = $workspacePath;
        if (!ws || !window.craftale?.git?.compareBranches || !baseBranch || !compareBranch) return;

        isLoading = true;
        hasCompared = true;
        try {
            const res = await window.craftale.git.compareBranches(ws, baseBranch, compareBranch);
            if (res.success) {
                changedFiles = res.files || [];
            } else {
                notify.warning(`Comparison warning: ${res.error}`);
                changedFiles = [];
            }
        } catch (err: any) {
            notify.error(`Branch comparison failed: ${err.message}`);
            changedFiles = [];
        } finally {
            isLoading = false;
        }
    }

    function handleSwapBranches() {
        const temp = baseBranch;
        baseBranch = compareBranch;
        compareBranch = temp;
        void runComparison();
    }

    function handleFileClick(file: { relativePath: string; status: string }) {
        void openBranchFileDiff(baseBranch, compareBranch, file.relativePath, file.status);
        onClose();
    }

    function getFileIcon(fileName: string): string {
        const ext = fileName.split(".").pop()?.toLowerCase() || "";
        switch (ext) {
            case "ts":
            case "tsx":
                return "🔷";
            case "js":
            case "jsx":
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
            default:
                return "📄";
        }
    }
</script>

{#if isOpen}
    <div class="modal-backdrop" onclick={onClose} role="presentation">
        <div class="modal-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div class="modal-header">
                <div class="title-with-icon">
                    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M11.5 2a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM9.05 3a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0V3h9.05zM4.5 7a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zM2.05 8a2.5 2.5 0 0 1 4.9 0H16v1H6.95a2.5 2.5 0 0 1-4.9 0H0V8h2.05zm9.45 4a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3zm-2.45 1a2.5 2.5 0 0 1 4.9 0H16v1h-2.05a2.5 2.5 0 0 1-4.9 0H0v-1h9.05z"/>
                    </svg>
                    <span>Compare Branches</span>
                </div>
                <button type="button" class="close-btn" onclick={onClose}>✕</button>
            </div>

            <!-- Branch Selectors -->
            <div class="branch-selectors">
                <div class="selector-group">
                    <label for="base-branch-select">Base Branch:</label>
                    <select
                        id="base-branch-select"
                        bind:value={baseBranch}
                        onchange={runComparison}
                    >
                        {#each $branchList as b (b.fullName)}
                            <option value={b.name}>{b.name} {b.isCurrent ? "(Current)" : ""}</option>
                        {/each}
                    </select>
                </div>

                <button
                    type="button"
                    class="swap-btn"
                    title="Swap Branches"
                    onclick={handleSwapBranches}
                >
                    ⇄
                </button>

                <div class="selector-group">
                    <label for="compare-branch-select">Compare With:</label>
                    <select
                        id="compare-branch-select"
                        bind:value={compareBranch}
                        onchange={runComparison}
                    >
                        {#each $branchList as b (b.fullName)}
                            <option value={b.name}>{b.name} {b.isCurrent ? "(Current)" : ""}</option>
                        {/each}
                    </select>
                </div>
            </div>

            <!-- Comparison Summary -->
            <div class="results-header">
                {#if isLoading}
                    <span class="loading-label">Comparing branches...</span>
                {:else if hasCompared}
                    <span class="count-label">
                        <strong>{changedFiles.length}</strong> {changedFiles.length === 1 ? "file" : "files"} changed
                        ({baseBranch} ... {compareBranch})
                    </span>
                {/if}
            </div>

            <!-- Changed Files List -->
            <div class="files-container">
                {#if isLoading}
                    <div class="center-state">
                        <span class="spinner"></span>
                        <span>Calculating branch diff...</span>
                    </div>
                {:else if changedFiles.length === 0 && hasCompared}
                    <div class="center-state empty-state">
                        <span>✓ No differences found between <strong>{baseBranch}</strong> and <strong>{compareBranch}</strong>.</span>
                    </div>
                {:else}
                    <div class="files-list" role="list">
                        {#each changedFiles as file (file.relativePath)}
                            <div
                                class="file-item"
                                role="listitem"
                                tabindex="0"
                                onclick={() => handleFileClick(file)}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") handleFileClick(file);
                                }}
                            >
                                <span class="status-indicator status-{file.status.toLowerCase()}">
                                    {file.status}
                                </span>
                                <span class="file-icon">{getFileIcon(file.fileName)}</span>
                                <span class="file-name">{file.fileName}</span>
                                <span class="file-path">{file.relativePath}</span>
                                <button type="button" class="open-diff-hint">Open Diff ➔</button>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" onclick={onClose}>Close</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.65);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        backdrop-filter: blur(2px);
    }

    .modal-card {
        background: #252526;
        border: 1px solid #3c3c3c;
        border-radius: 8px;
        width: 600px;
        max-width: 90vw;
        max-height: 80vh;
        display: flex;
        flex-direction: column;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.6);
        color: #cccccc;
        overflow: hidden;
    }

    .modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 14px 18px;
        border-bottom: 1px solid #333333;
    }

    .title-with-icon {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        font-weight: 600;
        color: #ffffff;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: #888888;
        font-size: 14px;
        cursor: pointer;
        padding: 4px 8px;
        border-radius: 4px;
    }

    .close-btn:hover {
        background: #333333;
        color: #ffffff;
    }

    .branch-selectors {
        display: flex;
        align-items: flex-end;
        gap: 12px;
        padding: 16px 18px;
        background: #1e1e1e;
        border-bottom: 1px solid #2d2d2d;
    }

    .selector-group {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .selector-group label {
        font-size: 12px;
        color: #aaaaaa;
        font-weight: 500;
    }

    .selector-group select {
        width: 100%;
        padding: 6px 10px;
        background: #2d2d2d;
        border: 1px solid #3c3c3c;
        border-radius: 4px;
        color: #ffffff;
        font-size: 12px;
        outline: none;
    }

    .selector-group select:focus {
        border-color: #007acc;
    }

    .swap-btn {
        background: #2d2d2d;
        border: 1px solid #3c3c3c;
        border-radius: 4px;
        color: #cccccc;
        font-size: 16px;
        height: 31px;
        width: 34px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.15s ease;
    }

    .swap-btn:hover {
        background: #3c3c3c;
        color: #ffffff;
    }

    .results-header {
        padding: 8px 18px;
        font-size: 12px;
        color: #888888;
        border-bottom: 1px solid #2d2d2d;
        background: #222222;
    }

    .count-label strong {
        color: #ffffff;
    }

    .files-container {
        flex: 1;
        overflow-y: auto;
        min-height: 200px;
        max-height: 350px;
        padding: 6px 0;
    }

    .center-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 40px 20px;
        gap: 10px;
        color: #888888;
        font-size: 13px;
    }

    .spinner {
        width: 20px;
        height: 20px;
        border: 2px solid #444444;
        border-top-color: #007acc;
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }

    .files-list {
        display: flex;
        flex-direction: column;
    }

    .file-item {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 18px;
        cursor: pointer;
        font-size: 12px;
        transition: background 0.12s ease;
    }

    .file-item:hover {
        background: #2a2d2e;
    }

    .status-indicator {
        font-weight: 700;
        font-size: 11px;
        width: 18px;
        text-align: center;
    }

    .status-m { color: #e2c08d; }
    .status-a { color: #73c991; }
    .status-d { color: #f14c4c; }

    .file-icon { font-size: 13px; }
    .file-name { font-weight: 500; color: #ffffff; }
    .file-path { font-size: 11px; color: #666666; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

    .open-diff-hint {
        opacity: 0;
        font-size: 11px;
        color: #007acc;
        background: transparent;
        border: none;
        cursor: pointer;
        transition: opacity 0.15s ease;
    }

    .file-item:hover .open-diff-hint {
        opacity: 1;
    }

    .modal-footer {
        display: flex;
        justify-content: flex-end;
        padding: 10px 18px;
        border-top: 1px solid #333333;
        background: #202020;
    }

    .btn {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
    }

    .btn-secondary {
        background: #3c3c3c;
        color: #ffffff;
    }

    .btn-secondary:hover {
        background: #4c4c4c;
    }
</style>
