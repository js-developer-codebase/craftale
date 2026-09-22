<script lang="ts">
    import {
        isBranchModalOpen,
        closeBranchModal,
        branchList,
        currentBranch,
        checkoutBranch,
        createBranch,
        deleteBranch,
        renameBranch,
        mergeBranch,
        rebaseBranch
    } from "../stores/git";
    import { notify } from "../stores/notifications";

    let filterText = $state("");
    let branchTab = $state<"all" | "local" | "remote">("all");
    let searchInputEl = $state<HTMLInputElement | null>(null);

    // Sub-panel state
    type ModalMode = "list" | "create" | "rename" | "delete" | "merge" | "rebase";
    let currentMode = $state<ModalMode>("list");
    let targetBranch = $state<string>("");

    // Create branch form
    let newBranchName = $state("");
    let newBranchCheckout = $state(true);
    let newBranchStartPoint = $state("HEAD");

    // Rename branch form
    let renameNewName = $state("");

    // Delete branch form
    let deleteIsForce = $state(false);
    let deleteNotMergedWarning = $state(false);

    // Merge options
    let mergeNoFf = $state(false);
    let mergeSquash = $state(false);

    let isOperating = $state(false);

    const localBranches = $derived($branchList.filter((b) => !b.isRemote));
    const remoteBranches = $derived($branchList.filter((b) => b.isRemote));

    const displayedBranches = $derived(
        $branchList.filter((b) => {
            if (branchTab === "local" && b.isRemote) return false;
            if (branchTab === "remote" && !b.isRemote) return false;
            if (!filterText.trim()) return true;
            const q = filterText.toLowerCase();
            return b.name.toLowerCase().includes(q) || b.fullName.toLowerCase().includes(q);
        })
    );

    $effect(() => {
        if ($isBranchModalOpen) {
            resetModalState();
            setTimeout(() => {
                searchInputEl?.focus();
            }, 50);
        }
    });

    function resetModalState() {
        filterText = "";
        currentMode = "list";
        targetBranch = "";
        newBranchName = "";
        newBranchCheckout = true;
        newBranchStartPoint = "HEAD";
        renameNewName = "";
        deleteIsForce = false;
        deleteNotMergedWarning = false;
        mergeNoFf = false;
        mergeSquash = false;
        isOperating = false;
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            if (currentMode !== "list") {
                currentMode = "list";
                setTimeout(() => searchInputEl?.focus(), 50);
            } else {
                closeBranchModal();
            }
        }
    }

    /* Start Actions */
    function openCreateDialog() {
        newBranchName = filterText.trim();
        newBranchCheckout = true;
        newBranchStartPoint = "HEAD";
        currentMode = "create";
    }

    function openRenameDialog(branchName: string) {
        targetBranch = branchName;
        renameNewName = branchName;
        currentMode = "rename";
    }

    function openDeleteDialog(branchName: string) {
        targetBranch = branchName;
        deleteIsForce = false;
        deleteNotMergedWarning = false;
        currentMode = "delete";
    }

    function openMergeDialog(branchName: string) {
        targetBranch = branchName;
        mergeNoFf = false;
        mergeSquash = false;
        currentMode = "merge";
    }

    function openRebaseDialog(branchName: string) {
        targetBranch = branchName;
        currentMode = "rebase";
    }

    /* Submit Actions */
    async function submitCreate() {
        const name = newBranchName.trim();
        if (!name || isOperating) return;
        isOperating = true;
        try {
            const ok = await createBranch(name, newBranchCheckout, newBranchStartPoint);
            if (ok) {
                currentMode = "list";
                if (newBranchCheckout) {
                    closeBranchModal();
                }
            }
        } finally {
            isOperating = false;
        }
    }

    async function submitRename() {
        const newName = renameNewName.trim();
        if (!newName || newName === targetBranch || isOperating) return;
        isOperating = true;
        try {
            const ok = await renameBranch(targetBranch, newName);
            if (ok) {
                currentMode = "list";
            }
        } finally {
            isOperating = false;
        }
    }

    async function submitDelete() {
        if (!targetBranch || isOperating) return;
        isOperating = true;
        try {
            const res = await deleteBranch(targetBranch, deleteIsForce);
            if (res.success) {
                currentMode = "list";
            } else if (res.notMerged) {
                deleteNotMergedWarning = true;
                deleteIsForce = true;
            }
        } finally {
            isOperating = false;
        }
    }

    async function submitMerge() {
        if (!targetBranch || isOperating) return;
        isOperating = true;
        try {
            await mergeBranch(targetBranch, { noFf: mergeNoFf, squash: mergeSquash });
            closeBranchModal();
        } finally {
            isOperating = false;
        }
    }

    async function submitRebase() {
        if (!targetBranch || isOperating) return;
        isOperating = true;
        try {
            await rebaseBranch(targetBranch);
            closeBranchModal();
        } finally {
            isOperating = false;
        }
    }

    function handleCheckout(branch: { fullName: string; isCurrent: boolean }) {
        if (branch.isCurrent) return;
        void checkoutBranch(branch.fullName, false);
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
            aria-label="Branch Manager"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="modal-header">
                <div class="header-left">
                    <span class="branch-icon-title">⎇</span>
                    <span class="modal-title">BRANCH MANAGEMENT</span>
                    <span class="current-branch-badge" title="Active Branch">
                        current: <strong>{$currentBranch}</strong>
                    </span>
                </div>
                <button
                    type="button"
                    class="close-btn"
                    onclick={closeBranchModal}
                    aria-label="Close"
                >
                    ✕
                </button>
            </div>

            <!-- Mode: Create Branch -->
            {#if currentMode === "create"}
                <div class="subpanel">
                    <div class="subpanel-title">
                        <span>➕ Create New Branch</span>
                    </div>
                    <div class="form-group">
                        <label for="new-branch-name">Branch name:</label>
                        <input
                            id="new-branch-name"
                            type="text"
                            class="input-field"
                            placeholder="feature/new-feature"
                            bind:value={newBranchName}
                            onkeydown={(e) => {
                                if (e.key === "Enter") void submitCreate();
                            }}
                        />
                    </div>
                    <div class="form-group">
                        <label for="start-point-select">Start point:</label>
                        <select id="start-point-select" class="select-field" bind:value={newBranchStartPoint}>
                            <option value="HEAD">HEAD ({$currentBranch})</option>
                            {#each $branchList as b}
                                <option value={b.name}>{b.name} {b.isRemote ? "(remote)" : ""}</option>
                            {/each}
                        </select>
                    </div>
                    <div class="form-check">
                        <label>
                            <input type="checkbox" bind:checked={newBranchCheckout} />
                            Switch to branch after creation
                        </label>
                    </div>
                    <div class="subpanel-actions">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (currentMode = "list")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-primary"
                            disabled={!newBranchName.trim() || isOperating}
                            onclick={submitCreate}
                        >
                            {isOperating ? "Creating..." : "Create Branch"}
                        </button>
                    </div>
                </div>

            <!-- Mode: Rename Branch -->
            {:else if currentMode === "rename"}
                <div class="subpanel">
                    <div class="subpanel-title">
                        <span>✏️ Rename Branch</span>
                    </div>
                    <p class="subpanel-desc">
                        Rename branch <strong>{targetBranch}</strong>:
                    </p>
                    <div class="form-group">
                        <label for="rename-branch-name">New name:</label>
                        <input
                            id="rename-branch-name"
                            type="text"
                            class="input-field"
                            bind:value={renameNewName}
                            onkeydown={(e) => {
                                if (e.key === "Enter") void submitRename();
                            }}
                        />
                    </div>
                    <div class="subpanel-actions">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (currentMode = "list")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-primary"
                            disabled={!renameNewName.trim() || renameNewName === targetBranch || isOperating}
                            onclick={submitRename}
                        >
                            {isOperating ? "Renaming..." : "Rename Branch"}
                        </button>
                    </div>
                </div>

            <!-- Mode: Delete Branch -->
            {:else if currentMode === "delete"}
                <div class="subpanel">
                    <div class="subpanel-title text-danger">
                        <span>🗑 Delete Branch</span>
                    </div>
                    <p class="subpanel-desc">
                        Are you sure you want to delete branch <strong>{targetBranch}</strong>?
                    </p>
                    {#if deleteNotMergedWarning}
                        <div class="alert-warning">
                            ⚠️ Branch "{targetBranch}" contains commits that are not merged into {$currentBranch}.
                            Force delete will discard these commits.
                        </div>
                    {/if}
                    <div class="form-check">
                        <label>
                            <input type="checkbox" bind:checked={deleteIsForce} />
                            Force delete branch (-D)
                        </label>
                    </div>
                    <div class="subpanel-actions">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (currentMode = "list")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-danger"
                            disabled={isOperating}
                            onclick={submitDelete}
                        >
                            {isOperating ? "Deleting..." : "Delete Branch"}
                        </button>
                    </div>
                </div>

            <!-- Mode: Merge Branch -->
            {:else if currentMode === "merge"}
                <div class="subpanel">
                    <div class="subpanel-title">
                        <span>🔀 Merge Branch</span>
                    </div>
                    <p class="subpanel-desc">
                        Merge <strong>{targetBranch}</strong> into active branch <strong>{$currentBranch}</strong>:
                    </p>
                    <div class="form-check">
                        <label>
                            <input type="checkbox" bind:checked={mergeNoFf} />
                            No Fast-Forward (--no-ff) - create merge commit even if fast-forward is possible
                        </label>
                    </div>
                    <div class="form-check">
                        <label>
                            <input type="checkbox" bind:checked={mergeSquash} />
                            Squash commits (--squash) - combine commits into a single uncommitted change
                        </label>
                    </div>
                    <div class="subpanel-actions">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (currentMode = "list")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-primary"
                            disabled={isOperating}
                            onclick={submitMerge}
                        >
                            {isOperating ? "Merging..." : `Merge into ${$currentBranch}`}
                        </button>
                    </div>
                </div>

            <!-- Mode: Rebase Branch -->
            {:else if currentMode === "rebase"}
                <div class="subpanel">
                    <div class="subpanel-title">
                        <span>⚡ Rebase Branch</span>
                    </div>
                    <p class="subpanel-desc">
                        Rebase active branch <strong>{$currentBranch}</strong> onto <strong>{targetBranch}</strong>:
                    </p>
                    <div class="alert-info">
                        ℹ️ This will re-apply {$currentBranch}'s commits on top of {targetBranch}.
                    </div>
                    <div class="subpanel-actions">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (currentMode = "list")}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-warning"
                            disabled={isOperating}
                            onclick={submitRebase}
                        >
                            {isOperating ? "Rebasing..." : `Rebase onto ${targetBranch}`}
                        </button>
                    </div>
                </div>

            <!-- Mode: Default Branch List -->
            {:else}
                <!-- Navigation & Filter Bar -->
                <div class="toolbar">
                    <div class="tab-filters">
                        <button
                            type="button"
                            class="tab-btn"
                            class:active={branchTab === "all"}
                            onclick={() => (branchTab = "all")}
                        >
                            All ({$branchList.length})
                        </button>
                        <button
                            type="button"
                            class="tab-btn"
                            class:active={branchTab === "local"}
                            onclick={() => (branchTab = "local")}
                        >
                            Local ({localBranches.length})
                        </button>
                        <button
                            type="button"
                            class="tab-btn"
                            class:active={branchTab === "remote"}
                            onclick={() => (branchTab = "remote")}
                        >
                            Remote ({remoteBranches.length})
                        </button>
                    </div>
                    <button
                        type="button"
                        class="btn-create-branch"
                        onclick={openCreateDialog}
                        title="Create New Branch"
                    >
                        ＋ New Branch
                    </button>
                </div>

                <div class="search-box">
                    <input
                        bind:this={searchInputEl}
                        type="text"
                        class="branch-input"
                        placeholder="Search branches..."
                        bind:value={filterText}
                        onkeydown={(e) => {
                            if (e.key === "Enter" && displayedBranches.length > 0) {
                                e.preventDefault();
                                handleCheckout(displayedBranches[0]);
                            }
                        }}
                    />
                </div>

                <!-- Branch List -->
                <div class="branch-list" role="listbox">
                    {#each displayedBranches as branch (branch.fullName)}
                        <div
                            class="branch-item"
                            class:active={branch.isCurrent}
                            role="option"
                            aria-selected={branch.isCurrent}
                            tabindex="0"
                            onclick={() => handleCheckout(branch)}
                            onkeydown={(e) => {
                                if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleCheckout(branch);
                                }
                            }}
                        >
                            <div class="branch-info">
                                <span class="branch-icon">
                                    {branch.isCurrent ? "✓" : branch.isRemote ? "🌐" : "⎇"}
                                </span>
                                <span class="branch-name" title={branch.fullName}>
                                    {branch.name}
                                </span>
                                {#if branch.isCurrent}
                                    <span class="current-tag">current</span>
                                {:else if branch.isRemote}
                                    <span class="remote-tag">remote</span>
                                {/if}
                            </div>

                            <!-- Row Action Buttons -->
                            <div class="branch-actions" onclick={(e) => e.stopPropagation()} role="toolbar">
                                {#if !branch.isCurrent}
                                    <button
                                        type="button"
                                        class="item-action-btn"
                                        title={`Switch to ${branch.name}`}
                                        onclick={() => handleCheckout(branch)}
                                    >
                                        Checkout
                                    </button>
                                    <button
                                        type="button"
                                        class="item-action-btn"
                                        title={`Merge ${branch.name} into ${$currentBranch}`}
                                        onclick={() => openMergeDialog(branch.name)}
                                    >
                                        🔀 Merge
                                    </button>
                                    <button
                                        type="button"
                                        class="item-action-btn"
                                        title={`Rebase ${$currentBranch} onto ${branch.name}`}
                                        onclick={() => openRebaseDialog(branch.name)}
                                    >
                                        ⚡ Rebase
                                    </button>
                                    {#if !branch.isRemote}
                                        <button
                                            type="button"
                                            class="item-action-btn"
                                            title="Rename Branch"
                                            onclick={() => openRenameDialog(branch.name)}
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            type="button"
                                            class="item-action-btn btn-trash"
                                            title="Delete Branch"
                                            onclick={() => openDeleteDialog(branch.name)}
                                        >
                                            🗑
                                        </button>
                                    {/if}
                                {:else}
                                    <button
                                        type="button"
                                        class="item-action-btn"
                                        title="Rename Current Branch"
                                        onclick={() => openRenameDialog(branch.name)}
                                    >
                                        ✏️ Rename
                                    </button>
                                {/if}
                            </div>
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
        background: rgba(0, 0, 0, 0.55);
        display: flex;
        justify-content: center;
        align-items: flex-start;
        padding-top: 60px;
        z-index: 1200;
        backdrop-filter: blur(2px);
    }

    .branch-modal {
        background: #252526;
        border: 1px solid #454545;
        border-radius: 8px;
        width: 600px;
        max-width: 92vw;
        max-height: 520px;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.7);
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: inherit;
        font-size: 12px;
        color: #cccccc;
    }

    .modal-header {
        height: 38px;
        padding: 0 14px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        background: #1e1e1e;
        border-bottom: 1px solid #333333;
    }

    .header-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .branch-icon-title {
        color: #569cd6;
        font-size: 14px;
    }

    .modal-title {
        font-size: 11px;
        font-weight: 700;
        color: #cccccc;
        letter-spacing: 0.5px;
    }

    .current-branch-badge {
        font-size: 10px;
        background: #2d2d2d;
        border: 1px solid #3e3e3e;
        padding: 2px 6px;
        border-radius: 4px;
        color: #888888;
    }

    .current-branch-badge strong {
        color: #4ec9b0;
    }

    .close-btn {
        background: transparent;
        border: none;
        color: #888888;
        cursor: pointer;
        font-size: 12px;
        padding: 4px 6px;
        border-radius: 3px;
    }

    .close-btn:hover {
        background: #333333;
        color: #ffffff;
    }

    /* Toolbar & Tabs */
    .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 8px 12px;
        background: #252526;
        border-bottom: 1px solid #333333;
    }

    .tab-filters {
        display: flex;
        gap: 4px;
    }

    .tab-btn {
        background: transparent;
        border: none;
        color: #888888;
        padding: 4px 8px;
        font-size: 11px;
        border-radius: 4px;
        cursor: pointer;
    }

    .tab-btn:hover {
        background: #2e2e2e;
        color: #cccccc;
    }

    .tab-btn.active {
        background: #37373d;
        color: #ffffff;
        font-weight: 600;
    }

    .btn-create-branch {
        background: #0e639c;
        border: none;
        color: #ffffff;
        padding: 4px 10px;
        font-size: 11px;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
    }

    .btn-create-branch:hover {
        background: #1177bb;
    }

    .search-box {
        padding: 8px 12px;
        background: #202021;
        border-bottom: 1px solid #2e2e2e;
    }

    .branch-input {
        width: 100%;
        box-sizing: border-box;
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 4px;
        padding: 6px 10px;
        color: #ffffff;
        font-size: 12px;
        outline: none;
    }

    .branch-input:focus {
        border-color: #007acc;
    }

    /* Branch List */
    .branch-list {
        flex: 1;
        overflow-y: auto;
        max-height: 340px;
        padding: 4px 0;
    }

    .branch-item {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 6px 12px;
        cursor: pointer;
        user-select: none;
        transition: background 0.1s;
    }

    .branch-item:hover {
        background: #2a2d2e;
    }

    .branch-item.active {
        background: #094771;
        color: #ffffff;
    }

    .branch-info {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
    }

    .branch-icon {
        font-size: 13px;
        width: 16px;
        text-align: center;
        color: #569cd6;
    }

    .branch-name {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        font-size: 12px;
    }

    .current-tag {
        font-size: 9px;
        background: #264f78;
        padding: 1px 5px;
        border-radius: 3px;
        color: #9cdcfe;
        text-transform: uppercase;
    }

    .remote-tag {
        font-size: 9px;
        background: #3e3e42;
        padding: 1px 5px;
        border-radius: 3px;
        color: #aaaaaa;
        text-transform: uppercase;
    }

    .branch-actions {
        display: flex;
        align-items: center;
        gap: 4px;
        opacity: 0.85;
    }

    .branch-item:hover .branch-actions {
        opacity: 1;
    }

    .item-action-btn {
        background: #333333;
        border: 1px solid #444444;
        color: #cccccc;
        font-size: 11px;
        padding: 2px 7px;
        border-radius: 3px;
        cursor: pointer;
    }

    .item-action-btn:hover {
        background: #444444;
        color: #ffffff;
    }

    .btn-trash:hover {
        background: #c53929;
        border-color: #c53929;
        color: #ffffff;
    }

    /* Subpanels */
    .subpanel {
        padding: 16px 20px;
        display: flex;
        flex-direction: column;
        gap: 12px;
        background: #252526;
    }

    .subpanel-title {
        font-size: 13px;
        font-weight: 600;
        color: #ffffff;
    }

    .subpanel-desc {
        margin: 0;
        font-size: 12px;
        color: #aaaaaa;
    }

    .text-danger {
        color: #f14c4c;
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: 6px;
    }

    .form-group label {
        font-size: 11px;
        color: #888888;
    }

    .input-field, .select-field {
        background: #3c3c3c;
        border: 1px solid #3c3c3c;
        border-radius: 4px;
        padding: 7px 10px;
        color: #ffffff;
        font-size: 12px;
        outline: none;
    }

    .input-field:focus, .select-field:focus {
        border-color: #007acc;
    }

    .form-check {
        font-size: 12px;
        color: #cccccc;
    }

    .form-check label {
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
    }

    .alert-warning {
        background: rgba(245, 158, 11, 0.15);
        border: 1px solid #f59e0b;
        color: #fcd34d;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 11px;
    }

    .alert-info {
        background: rgba(59, 130, 246, 0.15);
        border: 1px solid #3b82f6;
        color: #93c5fd;
        padding: 8px 12px;
        border-radius: 4px;
        font-size: 11px;
    }

    .subpanel-actions {
        display: flex;
        justify-content: flex-end;
        gap: 8px;
        margin-top: 6px;
    }

    .btn {
        padding: 6px 14px;
        font-size: 12px;
        border-radius: 4px;
        cursor: pointer;
        border: none;
        font-weight: 500;
    }

    .btn-secondary {
        background: #3a3d41;
        color: #ffffff;
    }

    .btn-secondary:hover {
        background: #45494e;
    }

    .btn-primary {
        background: #0e639c;
        color: #ffffff;
    }

    .btn-primary:hover {
        background: #1177bb;
    }

    .btn-warning {
        background: #d97706;
        color: #ffffff;
    }

    .btn-warning:hover {
        background: #b45309;
    }

    .btn-danger {
        background: #c53929;
        color: #ffffff;
    }

    .btn-danger:hover {
        background: #e04533;
    }

    .btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .empty-notice {
        padding: 24px;
        text-align: center;
        color: #777777;
    }
</style>
