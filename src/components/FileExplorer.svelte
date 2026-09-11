<script lang="ts">

    import { onMount, onDestroy } from "svelte";
    import { get } from "svelte/store";
    import FileTreeItem, { type FileItem } from "./FileTreeItem.svelte";
    import ContextMenu from "./ContextMenu.svelte";
    import ConfirmModal from "./ConfirmModal.svelte";
    import ConflictModal from "./ConflictModal.svelte";
    import SymbolOutline from "./SymbolOutline.svelte";
    import {
        setWorkspace,
        workspacePath,
        openedFiles,
        saveFile,
        openFile,
        renameFileInStore,
        deleteFileInStore,
        clipboard,
        copyToClipboard,
        cutToClipboard,
        clearClipboard,
        treeRefreshTrigger,
        pathsEqual
    } from "../stores/workspace";

    import {
        recordSelfTouch,
        handleWatcherEvent,
        directoryInvalidation
    } from "../stores/watcher";

    import {
        notify
    } from "../stores/notifications";

    import {
        validateFilename,
        formatErrorMessage
    } from "../utils/errors";


    /*
    |--------------------------------------------------------------------------
    | Explorer State
    |--------------------------------------------------------------------------
    */

    let rootPath = $state<string | null>(null);

    let rootItems = $state<FileItem[]>([]);

    let loading = $state(false);

    let error = $state<string | null>(null);

    let refreshKey = $state(0);

    let explorerContainer = $state<HTMLDivElement | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Selection & Editing State
    |--------------------------------------------------------------------------
    */

    let selectedItem = $state<FileItem | null>(null);

    let renamingPath = $state<string | null>(null);

    let creatingUnderPath = $state<string | null>(null);

    let creatingType = $state<"file" | "directory" | null>(null);

    let createRootValue = $state("");

    let createRootInputEl = $state<HTMLInputElement | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Context Menu State
    |--------------------------------------------------------------------------
    */

    let contextMenu = $state({
        visible: false,
        x: 0,
        y: 0,
        item: null as FileItem | null
    });


    /*
    |--------------------------------------------------------------------------
    | Deletion Modal State
    |--------------------------------------------------------------------------
    */

    let showDeleteModal = $state(false);

    let itemToDelete = $state<FileItem | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Conflict Modal State
    |--------------------------------------------------------------------------
    */

    let showConflictModal = $state(false);

    let conflictState = $state<{
        srcPath: string;
        destDir: string;
        name: string;
        operation: "copy" | "move";
        isCut?: boolean;
    } | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Root Drag Over
    |--------------------------------------------------------------------------
    */

    let isRootDragOver = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Load Folder
    |--------------------------------------------------------------------------
    */

    async function loadFolder(folderPath: string) {

        loading = true;

        error = null;

        try {

            rootItems = await window.craftale.filesystem.readDirectory(folderPath);

            rootPath = folderPath;

            setWorkspace(folderPath);

            if (window.craftale?.watcher?.start) {

                await window.craftale.watcher.start(folderPath);

            }

            refreshKey++;

        } catch (err) {

            console.error("Failed to load folder:", err);

            error = "Unable to load folder.";

            const formatted = formatErrorMessage(err);

            notify.error(`Failed to load folder: ${formatted.message}`, {
                details: formatted.details
            });

        } finally {

            loading = false;

        }

    }


    async function refreshExplorer() {

        if (!rootPath) return;

        try {

            rootItems = await window.craftale.filesystem.readDirectory(rootPath);

            refreshKey++;

        } catch (err) {

            console.error("Failed to refresh folder:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Failed to refresh explorer: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Select Folder
    |--------------------------------------------------------------------------
    */

    async function selectFolder() {

        try {

            const folder = await window.craftale.filesystem.selectFolder();

            if (!folder) return;

            await loadFolder(folder);

        } catch (err) {

            console.error("Folder selection failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Folder selection failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Create Actions
    |--------------------------------------------------------------------------
    */

    function startCreate(type: "file" | "directory", parentPath?: string) {

        const targetParent =
            parentPath ||
            (selectedItem?.type === "directory"
                ? selectedItem.path
                : selectedItem?.type === "file"
                    ? getParentDir(selectedItem.path)
                    : rootPath);

        if (!targetParent) return;

        creatingUnderPath = targetParent;

        creatingType = type;

        createRootValue = "";

        if (pathsEqual(targetParent, rootPath)) {

            setTimeout(() => {

                createRootInputEl?.focus();

            }, 30);

        }

    }


    function getParentDir(filePath: string): string {

        const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));

        return lastSlash > 0 ? filePath.slice(0, lastSlash) : filePath;

    }


    async function handleCreateSubmit(parentPath: string, name: string, type: "file" | "directory") {

        creatingUnderPath = null;

        creatingType = null;


        /* Validate Name */

        const validation = validateFilename(name);

        if (!validation.valid) {

            notify.warning(validation.error!);

            return;

        }


        try {

            if (type === "file") {

                const res = await window.craftale.filesystem.createFile(parentPath, name);

                recordSelfTouch(res.path);

                await refreshExplorer();

                /* Automatically open created file */

                openFile({
                    name: res.name,
                    path: res.path,
                    content: ""
                });

                selectedItem = {
                    name: res.name,
                    path: res.path,
                    type: "file"
                };

                notify.success(`File "${res.name}" created`);

            } else {

                const res = await window.craftale.filesystem.createFolder(parentPath, name);

                recordSelfTouch(res.path);

                await refreshExplorer();

                selectedItem = {
                    name: res.name,
                    path: res.path,
                    type: "directory"
                };

                notify.success(`Folder "${res.name}" created`);

            }

        } catch (err: any) {

            console.error("Create failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Failed to create ${type}: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    function handleCreateCancel() {

        creatingUnderPath = null;

        creatingType = null;

    }


    function handleRootCreateKeydown(event: KeyboardEvent) {

        if (event.key === "Enter") {

            event.preventDefault();

            event.stopPropagation();

            const trimmed = createRootValue.trim();

            if (trimmed && rootPath && creatingType) {

                handleCreateSubmit(rootPath, trimmed, creatingType);

            } else {

                handleCreateCancel();

            }

        } else if (event.key === "Escape") {

            event.preventDefault();

            event.stopPropagation();

            handleCreateCancel();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Rename Actions
    |--------------------------------------------------------------------------
    */

    function startRename(item?: FileItem) {

        const target = item || selectedItem;

        if (!target) return;

        renamingPath = target.path;

    }


    async function handleRenameSubmit(oldPath: string, newName: string) {

        renamingPath = null;


        /* Validate Name */

        const validation = validateFilename(newName);

        if (!validation.valid) {

            notify.warning(validation.error!);

            return;

        }


        try {

            /* Save if open and dirty before rename */

            const openDoc = $openedFiles.find(f => pathsEqual(f.path, oldPath));

            if (openDoc?.isDirty) {

                await saveFile(oldPath);

            }


            const res = await window.craftale.filesystem.rename(oldPath, newName);

            recordSelfTouch(oldPath);

            recordSelfTouch(res.newPath);

            renameFileInStore(oldPath, res.newPath, res.newName);

            if (selectedItem && pathsEqual(selectedItem.path, oldPath)) {

                selectedItem = {
                    ...selectedItem,
                    name: res.newName,
                    path: res.newPath
                };

            }

            await refreshExplorer();

            notify.success(`Renamed to "${res.newName}"`);

        } catch (err: any) {

            console.error("Rename failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Rename failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    function handleRenameCancel() {

        renamingPath = null;

    }


    /*
    |--------------------------------------------------------------------------
    | Delete Actions
    |--------------------------------------------------------------------------
    */

    function startDelete(item?: FileItem) {

        const target = item || selectedItem;

        if (!target) return;

        itemToDelete = target;

        showDeleteModal = true;

    }


    async function confirmDelete() {

        if (!itemToDelete) return;

        const target = itemToDelete;

        showDeleteModal = false;

        itemToDelete = null;

        try {

            recordSelfTouch(target.path);

            await window.craftale.filesystem.delete(
                target.path,
                target.type === "directory"
            );

            deleteFileInStore(target.path);

            if (selectedItem && pathsEqual(selectedItem.path, target.path)) {

                selectedItem = null;

            }

            await refreshExplorer();

            notify.info(`Deleted "${target.name}"`);

        } catch (err: any) {

            console.error("Delete failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Delete failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    function cancelDelete() {

        showDeleteModal = false;

        itemToDelete = null;

    }


    /*
    |--------------------------------------------------------------------------
    | Copy, Cut & Paste
    |--------------------------------------------------------------------------
    */

    function handleCopy(item?: FileItem) {

        const target = item || selectedItem;

        if (!target) return;

        copyToClipboard(target.path, target.name, target.type);

    }


    function handleCut(item?: FileItem) {

        const target = item || selectedItem;

        if (!target) return;

        cutToClipboard(target.path, target.name, target.type);

    }


    function getTargetFolderForPaste(): string | null {

        if (selectedItem) {

            if (selectedItem.type === "directory") {

                return selectedItem.path;

            }

            return getParentDir(selectedItem.path);

        }

        return rootPath;

    }


    async function handlePaste() {

        const clip = $clipboard;

        if (!clip) return;

        const destDir = getTargetFolderForPaste();

        if (!destDir) return;


        /* Prevent pasting a directory inside itself or its descendants */

        if (clip.type === "directory") {

            const normSrc = clip.path.replace(/\\/g, "/").toLowerCase();

            const normDest = destDir.replace(/\\/g, "/").toLowerCase();

            if (normDest === normSrc || normDest.startsWith(normSrc + "/")) {

                notify.warning("Cannot move or copy a directory into itself or a subfolder.");

                return;

            }

        }


        try {

            if (clip.operation === "copy") {

                const res = await window.craftale.filesystem.copy(clip.path, destDir);

                if (res.conflict) {

                    conflictState = {
                        srcPath: clip.path,
                        destDir,
                        name: res.existingName || clip.name,
                        operation: "copy"
                    };

                    showConflictModal = true;

                    return;

                }

                if (res.targetPath) {

                    recordSelfTouch(res.targetPath);

                }

                notify.success(`Pasted "${clip.name}"`);

            } else {

                const res = await window.craftale.filesystem.move(clip.path, destDir);

                if (res.conflict) {

                    conflictState = {
                        srcPath: clip.path,
                        destDir,
                        name: res.existingName || clip.name,
                        operation: "move",
                        isCut: true
                    };

                    showConflictModal = true;

                    return;

                }

                recordSelfTouch(clip.path);

                if (res.targetPath && res.name) {

                    recordSelfTouch(res.targetPath);

                    renameFileInStore(clip.path, res.targetPath, res.name);

                }

                clearClipboard();

                notify.success(`Moved "${clip.name}"`);

            }

            await refreshExplorer();

        } catch (err: any) {

            console.error("Paste failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Paste failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Duplicate
    |--------------------------------------------------------------------------
    */

    async function handleDuplicate(item?: FileItem) {

        const target = item || selectedItem;

        if (!target) return;

        try {

            const res = await window.craftale.filesystem.duplicate(target.path);

            if (res.targetPath) {

                recordSelfTouch(res.targetPath);

            }

            await refreshExplorer();

            notify.success(`Created duplicate "${res.name}"`);

        } catch (err: any) {

            console.error("Duplicate failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Duplicate failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Conflict Modal Actions (Replace / Keep Both / Cancel)
    |--------------------------------------------------------------------------
    */

    async function resolveConflict(keepBoth: boolean) {

        if (!conflictState) return;

        const { srcPath, destDir, operation, isCut } = conflictState;

        showConflictModal = false;

        conflictState = null;

        try {

            let res;

            if (operation === "copy") {

                res = await window.craftale.filesystem.copy(srcPath, destDir, {
                    overwrite: !keepBoth,
                    keepBoth
                });

                if (res.targetPath) {

                    recordSelfTouch(res.targetPath);

                }

                notify.success(`Copied "${res.name}"`);

            } else {

                res = await window.craftale.filesystem.move(srcPath, destDir, {
                    overwrite: !keepBoth,
                    keepBoth
                });

                recordSelfTouch(srcPath);

                if (res.targetPath) {

                    recordSelfTouch(res.targetPath);

                }

                if (isCut && res.targetPath && res.name) {

                    renameFileInStore(srcPath, res.targetPath, res.name);

                    clearClipboard();

                }

                notify.success(`Moved "${res.name}"`);

            }

            await refreshExplorer();

        } catch (err: any) {

            console.error("Conflict resolution failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Operation failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    function cancelConflict() {

        showConflictModal = false;

        conflictState = null;

    }


    /*
    |--------------------------------------------------------------------------
    | Drag and Drop on Folder or Root
    |--------------------------------------------------------------------------
    */

    async function handleDropOnFolder(srcPath: string, targetDir: string) {

        /* Prevent dropping into self */

        const normSrc = srcPath.replace(/\\/g, "/").toLowerCase();

        const normDest = targetDir.replace(/\\/g, "/").toLowerCase();

        if (normDest === normSrc || normDest.startsWith(normSrc + "/")) {

            notify.warning("Cannot move a folder into itself or a subfolder.");

            return;

        }

        try {

            const res = await window.craftale.filesystem.move(srcPath, targetDir);

            if (res.conflict) {

                conflictState = {
                    srcPath,
                    destDir: targetDir,
                    name: res.existingName || srcPath.split(/[\\/]/).pop() || "",
                    operation: "move"
                };

                showConflictModal = true;

                return;

            }

            recordSelfTouch(srcPath);

            if (res.targetPath && res.name) {

                recordSelfTouch(res.targetPath);

                renameFileInStore(srcPath, res.targetPath, res.name);

            }

            await refreshExplorer();

            notify.success(`Moved "${res.name}"`);

        } catch (err: any) {

            console.error("Drop move failed:", err);

            const formatted = formatErrorMessage(err);

            notify.error(`Move failed: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    function handleRootDragOver(event: DragEvent) {

        if (!rootPath) return;

        const srcPath = event.dataTransfer?.getData("application/craftale-path");

        if (srcPath) {

            const normSrc = srcPath.replace(/\\/g, "/").toLowerCase();

            const normRoot = rootPath.replace(/\\/g, "/").toLowerCase();

            if (normRoot === normSrc || normRoot.startsWith(normSrc + "/")) {

                return;

            }

        }

        event.preventDefault();

        if (event.dataTransfer) {

            event.dataTransfer.dropEffect = "move";

        }

        isRootDragOver = true;

    }


    function handleRootDragLeave(event: DragEvent) {

        isRootDragOver = false;

    }


    function handleRootDrop(event: DragEvent) {

        isRootDragOver = false;

        if (!rootPath) return;

        event.preventDefault();

        const srcPath =
            event.dataTransfer?.getData("application/craftale-path") ||
            event.dataTransfer?.getData("text/plain");

        if (srcPath && !pathsEqual(srcPath, rootPath)) {

            handleDropOnFolder(srcPath, rootPath);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Context Menu Handlers
    |--------------------------------------------------------------------------
    */

    function handleTreeItemContextMenu(event: MouseEvent, item: FileItem) {

        contextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            item
        };

    }


    function handleRootContextMenu(event: MouseEvent) {

        if (!rootPath) return;

        event.preventDefault();

        contextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            item: null
        };

    }


    function closeContextMenu() {

        contextMenu.visible = false;

    }


    /*
    |--------------------------------------------------------------------------
    | Keyboard Shortcuts in Explorer
    |--------------------------------------------------------------------------
    */

    function handleKeydown(event: KeyboardEvent) {

        /* Don't trigger shortcuts if user is typing in an input */

        const targetTag = (event.target as HTMLElement)?.tagName?.toLowerCase();

        if (targetTag === "input" || targetTag === "textarea") {

            return;

        }


        if (event.key === "F2") {

            if (selectedItem) {

                event.preventDefault();

                startRename(selectedItem);

            }

        } else if (event.key === "Delete") {

            if (selectedItem) {

                event.preventDefault();

                startDelete(selectedItem);

            }

        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "c") {

            if (selectedItem) {

                event.preventDefault();

                handleCopy(selectedItem);

            }

        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "x") {

            if (selectedItem) {

                event.preventDefault();

                handleCut(selectedItem);

            }

        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "v") {

            if ($clipboard) {

                event.preventDefault();

                handlePaste();

            }

        } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "d") {

            if (selectedItem) {

                event.preventDefault();

                handleDuplicate(selectedItem);

            }

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Lifecycle Subscriptions
    |--------------------------------------------------------------------------
    */

    let refreshUnsub: (() => void) | undefined;

    let invalidationUnsub: (() => void) | undefined;

    let workspaceUnsub: (() => void) | undefined;

    let watcherEventRemover: (() => void) | null = null;

    onMount(() => {

        /* 1. Restore opened folder from workspace store if set */
        const currentPath = get(workspacePath);
        if (currentPath && (!rootPath || rootItems.length === 0)) {
            void loadFolder(currentPath);
        }

        /* 2. React to external workspace folder changes */
        workspaceUnsub = workspacePath.subscribe((path) => {
            if (path && path !== rootPath) {
                void loadFolder(path);
            } else if (!path && rootPath) {
                rootPath = null;
                rootItems = [];
            }
        });

        refreshUnsub = treeRefreshTrigger.subscribe((count) => {

            if (count > 0 && rootPath) {

                refreshExplorer();

            }

        });

        invalidationUnsub = directoryInvalidation.subscribe((inval) => {

            if (inval && rootPath && pathsEqual(inval.dirPath, rootPath)) {

                refreshExplorer();

            }

        });

        if (window.craftale?.watcher?.onEvent) {

            watcherEventRemover = window.craftale.watcher.onEvent(handleWatcherEvent);

        }

    });


    onDestroy(() => {

        workspaceUnsub?.();

        refreshUnsub?.();

        invalidationUnsub?.();

        watcherEventRemover?.();

    });

</script>


<div
    bind:this={explorerContainer}
    class="explorer"
    tabindex="0"
    role="region"
    aria-label="File Explorer"
    onkeydown={handleKeydown}
>

    <!-- Header -->

    <div class="explorer-header">

        <div class="title">
            EXPLORER
        </div>

        {#if !rootPath}

            <button
                type="button"
                class="open-button"
                onclick={selectFolder}
                title="Open Folder"
            >
                Open Folder
            </button>

        {/if}

    </div>


    <!-- Workspace Header & Action Icons -->

    {#if rootPath}

        <div class="workspace-bar">

            <div class="workspace-name" title={rootPath}>
                📁 {rootPath.split(/[\\/]/).pop()}
            </div>


            <!-- Header Action Buttons -->

            <div class="actions">

                <button
                    type="button"
                    class="action-btn"
                    title="New File"
                    onclick={() => startCreate("file")}
                >
                    +📄
                </button>

                <button
                    type="button"
                    class="action-btn"
                    title="New Folder"
                    onclick={() => startCreate("directory")}
                >
                    +📁
                </button>

                <button
                    type="button"
                    class="action-btn"
                    title="Refresh Explorer"
                    onclick={refreshExplorer}
                >
                    ↻
                </button>

            </div>

        </div>


        <!-- Tree Container -->

        <div
            class="tree"
            class:root-drag-over={isRootDragOver}
            role="tree"
            tabindex="0"
            onclick={(e) => {
                if (e.target === e.currentTarget) {
                    selectedItem = null;
                }
            }}
            onkeydown={(e) => {
                if (e.key === "Escape") {
                    selectedItem = null;
                }
            }}
            oncontextmenu={handleRootContextMenu}
            ondragover={handleRootDragOver}
            ondragleave={handleRootDragLeave}
            ondrop={handleRootDrop}
        >

            <!-- Inline Root Creation -->

            {#if creatingUnderPath && pathsEqual(creatingUnderPath, rootPath)}

                <div class="root-create-item">

                    <span class="icon">
                        {creatingType === "directory" ? "📁" : "📄"}
                    </span>

                    <input
                        bind:this={createRootInputEl}
                        type="text"
                        class="inline-input"
                        placeholder={creatingType === "directory" ? "Folder name" : "File name"}
                        bind:value={createRootValue}
                        onkeydown={handleRootCreateKeydown}
                        onblur={() => {
                            const trimmed = createRootValue.trim();
                            if (trimmed && rootPath && creatingType) {
                                handleCreateSubmit(rootPath, trimmed, creatingType);
                            } else {
                                handleCreateCancel();
                            }
                        }}
                    />

                </div>

            {/if}


            {#if loading}

                <div class="message">
                    Loading...
                </div>

            {:else if error}

                <div class="message error">
                    {error}
                </div>

            {:else}

                {#each rootItems as item (item.path)}

                    <FileTreeItem
                        item={item}
                        depth={0}
                        selectedPath={selectedItem?.path ?? null}
                        renamingPath={renamingPath}
                        creatingUnderPath={creatingUnderPath}
                        creatingType={creatingType}
                        cutPath={$clipboard?.operation === "cut" ? $clipboard.path : null}
                        refreshKey={refreshKey}
                        onSelect={(clicked) => {
                            selectedItem = clicked;
                        }}
                        onContextMenu={handleTreeItemContextMenu}
                        onRenameSubmit={handleRenameSubmit}
                        onRenameCancel={handleRenameCancel}
                        onCreateSubmit={handleCreateSubmit}
                        onCreateCancel={handleCreateCancel}
                        onDropOnFolder={handleDropOnFolder}
                    />

                {/each}

            {/if}

        </div>

        <!-- Symbol Outline Panel -->
        <SymbolOutline />

    {:else}

        <!-- Empty State -->

        <div class="empty">

            <div class="empty-icon">
                📁
            </div>

            <div class="empty-text">
                No folder opened
            </div>

            <button
                type="button"
                onclick={selectFolder}
            >
                Open Folder
            </button>

        </div>

    {/if}

</div>


<!-- Context Menu -->

<ContextMenu
    x={contextMenu.x}
    y={contextMenu.y}
    visible={contextMenu.visible}
    hasItem={contextMenu.item !== null}
    canPaste={$clipboard !== null}
    onNewFile={() => startCreate("file", contextMenu.item?.type === "directory" ? contextMenu.item.path : undefined)}
    onNewFolder={() => startCreate("directory", contextMenu.item?.type === "directory" ? contextMenu.item.path : undefined)}
    onCut={() => contextMenu.item && handleCut(contextMenu.item)}
    onCopy={() => contextMenu.item && handleCopy(contextMenu.item)}
    onPaste={handlePaste}
    onDuplicate={() => contextMenu.item && handleDuplicate(contextMenu.item)}
    onRename={() => contextMenu.item && startRename(contextMenu.item)}
    onDelete={() => contextMenu.item && startDelete(contextMenu.item)}
    onClose={closeContextMenu}
/>


<!-- Safe Deletion Confirmation Modal -->

<ConfirmModal
    visible={showDeleteModal}
    title={itemToDelete?.type === "directory" ? "Delete Folder" : "Delete File"}
    message={itemToDelete?.type === "directory"
        ? `Are you sure you want to delete folder "${itemToDelete.name}" and all of its contents? This action cannot be undone.`
        : `Are you sure you want to permanently delete "${itemToDelete?.name}"?`}
    fileName={itemToDelete?.name ?? ""}
    confirmText={itemToDelete?.type === "directory" ? "Delete Permanently" : "Delete"}
    cancelText="Cancel"
    danger={true}
    onConfirm={confirmDelete}
    onCancel={cancelDelete}
/>


<!-- Conflict Resolution Modal -->

<ConflictModal
    visible={showConflictModal}
    fileName={conflictState?.name ?? ""}
    onReplace={() => resolveConflict(false)}
    onKeepBoth={() => resolveConflict(true)}
    onCancel={cancelConflict}
/>


<style>

    .explorer {

        width: 100%;

        height: 100%;

        background: #252526;

        color: #cccccc;

        display: flex;

        flex-direction: column;

        overflow: hidden;

        outline: none;

    }


    .explorer-header {

        min-height: 36px;

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 0 10px;

        border-bottom: 1px solid #333333;

    }


    .title {

        font-size: 11px;

        font-weight: 600;

        letter-spacing: 0.5px;

        color: #bbbbbb;

    }


    .open-button {

        border: none;

        background: transparent;

        color: #cccccc;

        cursor: pointer;

        font-size: 11px;

        padding: 4px 6px;

    }


    .open-button:hover {

        background: #37373d;

    }


    .workspace-bar {

        min-height: 30px;

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 0 8px;

        border-bottom: 1px solid #333333;

        background: #202021;

    }


    .workspace-name {

        font-size: 11px;

        font-weight: 700;

        overflow: hidden;

        white-space: nowrap;

        text-overflow: ellipsis;

        color: #e0e0e0;

        text-transform: uppercase;

        letter-spacing: 0.5px;

    }


    .actions {

        display: flex;

        align-items: center;

        gap: 2px;

    }


    .action-btn {

        background: transparent;

        border: none;

        color: #aaaaaa;

        cursor: pointer;

        padding: 2px 4px;

        font-size: 12px;

        border-radius: 3px;

        display: flex;

        align-items: center;

        justify-content: center;

    }


    .action-btn:hover {

        background: #37373d;

        color: #ffffff;

    }


    .tree {

        flex: 1;

        overflow-y: auto;

        overflow-x: hidden;

        padding-top: 2px;

        outline: none;

        scrollbar-width: thin;

        scrollbar-color: rgba(255, 255, 255, 0.16) transparent;

    }


    .tree::-webkit-scrollbar {

        width: 6px;

    }


    .tree::-webkit-scrollbar-track {

        background: transparent;

    }


    .tree::-webkit-scrollbar-thumb {

        background: rgba(255, 255, 255, 0.16);

        border-radius: 3px;

    }


    .tree::-webkit-scrollbar-thumb:hover {

        background: rgba(255, 255, 255, 0.32);

    }


    .tree::-webkit-scrollbar-corner {

        background: transparent;

    }


    .tree.root-drag-over {

        background: rgba(9, 71, 113, 0.25);

        outline: 1px dashed #007acc;

    }


    .root-create-item {

        height: 24px;

        display: flex;

        align-items: center;

        padding: 0 8px 0 22px;

        background: rgba(0, 122, 204, 0.1);

    }


    .root-create-item .icon {

        margin-right: 4px;

        font-size: 13px;

    }


    .inline-input {

        flex: 1;

        height: 20px;

        background: #3c3c3c;

        color: #ffffff;

        border: 1px solid #007acc;

        outline: none;

        font-size: 12px;

        padding: 0 4px;

        border-radius: 2px;

        font-family: inherit;

    }


    .message {

        padding: 10px;

        color: #858585;

        font-size: 12px;

    }


    .error {

        color: #f48771;

    }


    .empty {

        flex: 1;

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        gap: 10px;

        color: #858585;

        font-size: 12px;

    }


    .empty-icon {

        font-size: 30px;

    }


    .empty button {

        border: 1px solid #555555;

        background: #333333;

        color: #cccccc;

        padding: 6px 12px;

        cursor: pointer;

    }


    .empty button:hover {

        background: #444444;

    }

</style>