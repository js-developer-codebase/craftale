<script lang="ts">
    import {
        isBranchModalOpen,
        closeBranchModal,
        branchList,
        currentBranch,
        checkoutBranch
    } from "../stores/git";

    let filterText = $state("");
    let isCreatingNew = $state(false);
    let newBranchName = $state("");
    let searchInputEl = $state<HTMLInputElement | null>(null);
    let newBranchInputEl = $state<HTMLInputElement | null>(null);

    const filteredBranches = $derived(
        $branchList.filter((b) =>
            b.name.toLowerCase().includes(filterText.toLowerCase()) ||
            b.fullName.toLowerCase().includes(filterText.toLowerCase())
        )
    );

    $effect(() => {
        if ($isBranchModalOpen) {
            filterText = "";
            isCreatingNew = false;
            newBranchName = "";
            setTimeout(() => {
                searchInputEl?.focus();
            }, 50);
        }
    });

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            if (isCreatingNew) {
                isCreatingNew = false;
                searchInputEl?.focus();
            } else {
                closeBranchModal();
            }
        }
    }

    function startCreateNew() {
        isCreatingNew = true;
        newBranchName = filterText.trim();
        setTimeout(() => {
            newBranchInputEl?.focus();
            newBranchInputEl?.select();
        }, 50);
    }

    function submitCreateNew() {
        const name = newBranchName.trim();
        if (!name) return;
        void checkoutBranch(name, true);
    }
</script>

<svelte:window onkeydown={handleKeyDown} />

{#if $isBranchModalOpen}
    <div
        class="modal-backdrop"
        onclick={closeBranchModal}
        role="presentation"
    >
        <div
            class="branch-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Switch Branch"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="modal-header">
                <span class="modal-title">SELECT A BRANCH TO CHECK OUT</span>
                <button
                    type="button"
                    class="close-btn"
                    onclick={closeBranchModal}
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            {#if isCreatingNew}
                <!-- Create New Branch Input -->
                <div class="create-box">
                    <label for="new-branch-input" class="input-label">New branch name:</label>
                    <div class="input-row">
                        <input
                            id="new-branch-input"
                            bind:this={newBranchInputEl}
                            type="text"
                            class="branch-input"
                            placeholder="feature/branch-name"
                            bind:value={newBranchName}
                            onkeydown={(e) => {
                                if (e.key === "Enter") {
                                    e.preventDefault();
                                    submitCreateNew();
                                }
                            }}
                        />
                        <button
                            type="button"
                            class="btn btn-primary"
                            disabled={!newBranchName.trim()}
                            onclick={submitCreateNew}
                        >
                            Create & Checkout
                        </button>
                    </div>
                </div>
            {:else}
                <!-- Filter Input -->
                <div class="search-box">
                    <input
                        bind:this={searchInputEl}
                        type="text"
                        class="branch-input"
                        placeholder="Filter branches or create new..."
                        bind:value={filterText}
                        onkeydown={(e) => {
                            if (e.key === "Enter" && filteredBranches.length > 0) {
                                e.preventDefault();
                                void checkoutBranch(filteredBranches[0].fullName, false);
                            }
                        }}
                    />
                </div>

                <!-- Create Branch Button -->
                <div
                    class="branch-item create-action"
                    role="button"
                    tabindex="0"
                    onclick={startCreateNew}
                    onkeydown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            startCreateNew();
                        }
                    }}
                >
                    <span class="branch-icon">➕</span>
                    <span class="branch-name">
                        Create new branch {filterText.trim() ? `"${filterText.trim()}"` : "..."}
                    </span>
                </div>

                <!-- Branch List -->
                <div class="branch-list" role="listbox">
                    {#each filteredBranches as branch (branch.fullName)}
                        <div
                            class="branch-item"
                            class:active={branch.isCurrent}
                            role="option"
                            aria-selected={branch.isCurrent}
                            tabindex="0"
                            onclick={() => checkoutBranch(branch.fullName, false)}
                            onkeydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    checkoutBranch(branch.fullName, false);
                                }
                            }}
                        >
                            <span class="branch-icon">
                                {branch.isCurrent ? "✓" : branch.isRemote ? "🌐" : "⎇"}
                            </span>

                            <span class="branch-name">
                                {branch.name}
                            </span>

                            {#if branch.isRemote}
                                <span class="remote-badge">remote</span>
                            {/if}
                        </div>
                    {:else}
                        <div class="empty-notice">
                            No branches matching "{filterText}"
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.5);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 80px;
        z-index: 1200;
    }

    .branch-modal {
        background: #252526;
        border: 1px solid #454545;
        border-radius: 6px;
        width: 480px;
        max-width: 90vw;
        max-height: 400px;
        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
        font-size: 12px;
        color: #cccccc;
    }

    .modal-header {
        height: 32px;
        padding: 0 10px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #202021;
        border-bottom: 1px solid #333333;
    }

    .modal-title {
        font-size: 10px;
        font-weight: 700;
        color: #999999;
        letter-spacing: 0.5px;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: #888888;
        cursor: pointer;
        font-size: 11px;
        padding: 2px 6px;
    }

    .close-btn:hover {
        color: #ffffff;
    }

    .search-box,
    .create-box {
        padding: 8px 10px;
        border-bottom: 1px solid #333333;
        background: #252526;
    }

    .input-label {
        font-size: 11px;
        color: #bbbbbb;
        margin-bottom: 4px;
        display: block;
    }

    .input-row {
        display: flex;
        gap: 6px;
    }

    .branch-input {
        width: 100%;
        height: 28px;
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
        color: #ffffff;
        padding: 0 8px;
        font-size: 12px;
        outline: none;
        font-family: inherit;
    }

    .branch-input:focus {
        border-color: #007acc;
    }

    .branch-list {
        flex: 1;
        overflow-y: auto;
        padding: 4px 0;
    }

    .branch-item {
        display: flex;
        align-items: center;
        height: 28px;
        padding: 0 12px;
        cursor: pointer;
        gap: 8px;
        outline: none;
    }

    .branch-item:hover,
    .branch-item:focus {
        background: #094771;
        color: #ffffff;
    }

    .branch-item.active {
        font-weight: 600;
        color: #ffffff;
    }

    .create-action {
        border-bottom: 1px solid #333333;
        color: #3794ff;
    }

    .branch-icon {
        width: 16px;
        text-align: center;
        font-size: 12px;
    }

    .branch-name {
        flex: 1;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .remote-badge {
        font-size: 9px;
        background: #3a3d41;
        color: #aaaaaa;
        padding: 1px 4px;
        border-radius: 3px;
    }

    .empty-notice {
        padding: 16px;
        text-align: center;
        color: #777777;
    }

    .btn {
        padding: 0 12px;
        height: 28px;
        border-radius: 3px;
        font-size: 12px;
        cursor: pointer;
        border: none;
        white-space: nowrap;
    }

    .btn-primary {
        background: #007acc;
        color: #ffffff;
    }

    .btn-primary:hover:not(:disabled) {
        background: #0098ff;
    }

    .btn-primary:disabled {
        opacity: 0.5;
        cursor: default;
    }
</style>
