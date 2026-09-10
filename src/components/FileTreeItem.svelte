<script lang="ts">

    import { onMount } from "svelte";
    import { openFile, pathsEqual } from "../stores/workspace";
    import { notify } from "../stores/notifications";
    import { formatErrorMessage } from "../utils/errors";
    import FileTreeItem from "./FileTreeItem.svelte";

    export type FileItem = {
        name: string;
        path: string;
        type: "file" | "directory";
    };

    interface Props {
        item: FileItem;
        depth?: number;
        selectedPath: string | null;
        renamingPath: string | null;
        creatingUnderPath: string | null;
        creatingType: "file" | "directory" | null;
        cutPath: string | null;
        refreshKey: number;
        onSelect: (item: FileItem) => void;
        onContextMenu: (event: MouseEvent, item: FileItem) => void;
        onRenameSubmit: (oldPath: string, newName: string) => void;
        onRenameCancel: () => void;
        onCreateSubmit: (parentPath: string, name: string, type: "file" | "directory") => void;
        onCreateCancel: () => void;
        onDropOnFolder: (srcPath: string, targetDir: string) => void;
    }

    let {
        item,
        depth = 0,
        selectedPath,
        renamingPath,
        creatingUnderPath,
        creatingType,
        cutPath,
        refreshKey,
        onSelect,
        onContextMenu,
        onRenameSubmit,
        onRenameCancel,
        onCreateSubmit,
        onCreateCancel,
        onDropOnFolder
    }: Props = $props();


    /*
    |--------------------------------------------------------------------------
    | Folder State
    |--------------------------------------------------------------------------
    */

    let expanded = $state(false);

    let children = $state<FileItem[]>([]);

    let loading = $state(false);

    let isDragOver = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Inline Rename State
    |--------------------------------------------------------------------------
    */

    let renameValue = $state(item.name);

    let renameInputEl = $state<HTMLInputElement | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Inline Create State (for Children)
    |--------------------------------------------------------------------------
    */

    let createValue = $state("");

    let createInputEl = $state<HTMLInputElement | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Derived Statuses
    |--------------------------------------------------------------------------
    */

    let isSelected = $derived(pathsEqual(selectedPath, item.path));

    let isRenaming = $derived(pathsEqual(renamingPath, item.path));

    let isCut = $derived(pathsEqual(cutPath, item.path));

    let isCreatingHere = $derived(
        item.type === "directory" &&
        pathsEqual(creatingUnderPath, item.path)
    );


    /*
    |--------------------------------------------------------------------------
    | Focus & Select Text on Rename / Create
    |--------------------------------------------------------------------------
    */

    $effect(() => {

        if (isRenaming) {

            renameValue = item.name;

            setTimeout(() => {

                if (!renameInputEl) return;

                renameInputEl.focus();

                const lastDot = item.name.lastIndexOf(".");

                if (item.type === "file" && lastDot > 0) {

                    renameInputEl.setSelectionRange(0, lastDot);

                } else {

                    renameInputEl.select();

                }

            }, 20);

        }

    });


    $effect(() => {

        if (isCreatingHere) {

            if (!expanded) {

                expanded = true;

                loadChildren();

            }

            createValue = "";

            setTimeout(() => {

                createInputEl?.focus();

            }, 30);

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Watch Refresh Trigger
    |--------------------------------------------------------------------------
    */

    let lastRefreshKey = -1;

    $effect(() => {

        const key = refreshKey;

        if (key !== lastRefreshKey) {

            lastRefreshKey = key;

            if (expanded && item.type === "directory") {

                loadChildren();

            }

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Load Children
    |--------------------------------------------------------------------------
    */

    async function loadChildren() {

        loading = true;

        try {

            children = await window.craftale.filesystem.readDirectory(item.path);

        } catch (error) {

            console.error("[RENDERER] Directory error:", error);

            const formatted = formatErrorMessage(error);

            notify.error(`Failed to read folder "${item.name}": ${formatted.message}`, {
                details: formatted.details
            });

        } finally {

            loading = false;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Toggle Folder
    |--------------------------------------------------------------------------
    */

    async function toggleFolder() {

        expanded = !expanded;

        if (expanded && children.length === 0) {

            await loadChildren();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Click Handling
    |--------------------------------------------------------------------------
    */

    function handleClick(event: MouseEvent) {

        event.stopPropagation();

        onSelect(item);

        if (item.type === "directory") {

            toggleFolder();

        } else {

            handleFileClick();

        }

    }


    async function handleFileClick() {

        try {

            const content = await window.craftale.filesystem.readFile(item.path);

            openFile({
                name: item.name,
                path: item.path,
                content
            });

        } catch (error) {

            console.error("[RENDERER] Failed to open file:", error);

            const formatted = formatErrorMessage(error);

            notify.error(`Failed to open file "${item.name}": ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Context Menu
    |--------------------------------------------------------------------------
    */

    function handleContextMenu(event: MouseEvent) {

        event.preventDefault();

        event.stopPropagation();

        onSelect(item);

        onContextMenu(event, item);

    }


    /*
    |--------------------------------------------------------------------------
    | Inline Rename Submissions
    |--------------------------------------------------------------------------
    */

    function submitRename() {

        const trimmed = renameValue.trim();

        if (trimmed && trimmed !== item.name) {

            onRenameSubmit(item.path, trimmed);

        } else {

            onRenameCancel();

        }

    }


    function handleRenameKeydown(event: KeyboardEvent) {

        if (event.key === "Enter") {

            event.preventDefault();

            event.stopPropagation();

            submitRename();

        } else if (event.key === "Escape") {

            event.preventDefault();

            event.stopPropagation();

            onRenameCancel();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Inline Create Submissions
    |--------------------------------------------------------------------------
    */

    function submitCreate() {

        const trimmed = createValue.trim();

        if (trimmed && creatingType) {

            onCreateSubmit(item.path, trimmed, creatingType);

        } else {

            onCreateCancel();

        }

    }


    function handleCreateKeydown(event: KeyboardEvent) {

        if (event.key === "Enter") {

            event.preventDefault();

            event.stopPropagation();

            submitCreate();

        } else if (event.key === "Escape") {

            event.preventDefault();

            event.stopPropagation();

            onCreateCancel();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Drag and Drop
    |--------------------------------------------------------------------------
    */

    function handleDragStart(event: DragEvent) {

        if (isRenaming) {

            event.preventDefault();

            return;

        }

        if (event.dataTransfer) {

            event.dataTransfer.setData("text/plain", item.path);

            event.dataTransfer.setData("application/craftale-path", item.path);

            event.dataTransfer.setData("application/craftale-type", item.type);

            event.dataTransfer.effectAllowed = "move";

        }

    }


    function handleDragOver(event: DragEvent) {

        if (item.type !== "directory") {

            return;

        }

        const srcPath = event.dataTransfer?.getData("application/craftale-path");

        /* Cannot drop folder into itself or subfolder */
        if (srcPath) {

            const normSrc = srcPath.replace(/\\/g, "/").toLowerCase();

            const normDest = item.path.replace(/\\/g, "/").toLowerCase();

            if (normDest === normSrc || normDest.startsWith(normSrc + "/")) {

                return;

            }

        }

        event.preventDefault();

        event.stopPropagation();

        if (event.dataTransfer) {

            event.dataTransfer.dropEffect = "move";

        }

        isDragOver = true;

    }


    function handleDragLeave(event: DragEvent) {

        event.stopPropagation();

        isDragOver = false;

    }


    function handleDrop(event: DragEvent) {

        if (item.type !== "directory") {

            return;

        }

        event.preventDefault();

        event.stopPropagation();

        isDragOver = false;

        const srcPath =
            event.dataTransfer?.getData("application/craftale-path") ||
            event.dataTransfer?.getData("text/plain");

        if (srcPath && !pathsEqual(srcPath, item.path)) {

            onDropOnFolder(srcPath, item.path);

        }

    }

</script>


<div class="tree-node">

    <div
        class="tree-item"
        class:selected={isSelected}
        class:is-cut={isCut}
        class:drag-over={isDragOver}
        style="padding-left: {6 + depth * 14}px;"
        role="button"
        tabindex="0"
        draggable={!isRenaming}
        onclick={handleClick}
        oncontextmenu={handleContextMenu}
        ondragstart={handleDragStart}
        ondragover={handleDragOver}
        ondragleave={handleDragLeave}
        ondrop={handleDrop}
    >

        {#if item.type === "directory"}

            <button
                type="button"
                class="arrow"
                aria-label={expanded ? "Collapse folder" : "Expand folder"}
                onclick={(e) => {
                    e.stopPropagation();
                    toggleFolder();
                }}
            >
                {expanded ? "▼" : "▶"}
            </button>

            <span class="icon">
                {expanded ? "📂" : "📁"}
            </span>

        {:else}

            <span class="arrow-placeholder"></span>

            <span class="icon">
                📄
            </span>

        {/if}


        {#if isRenaming}

            <!-- Inline Rename Input -->

            <input
                bind:this={renameInputEl}
                type="text"
                class="inline-input"
                bind:value={renameValue}
                onclick={(e) => e.stopPropagation()}
                onkeydown={handleRenameKeydown}
                onblur={submitRename}
            />

        {:else}

            <span class="name" title={item.name}>
                {item.name}
            </span>

        {/if}

    </div>


    <!-- Directory Children -->

    {#if item.type === "directory" && expanded}

        <div class="children">

            <!-- Inline New Item Creation at top of children -->

            {#if isCreatingHere}

                <div
                    class="tree-item inline-create-item"
                    style="padding-left: {6 + (depth + 1) * 14}px;"
                >

                    <span class="arrow-placeholder"></span>

                    <span class="icon">
                        {creatingType === "directory" ? "📁" : "📄"}
                    </span>

                    <input
                        bind:this={createInputEl}
                        type="text"
                        class="inline-input"
                        placeholder={creatingType === "directory" ? "Folder name" : "File name"}
                        bind:value={createValue}
                        onclick={(e) => e.stopPropagation()}
                        onkeydown={handleCreateKeydown}
                        onblur={submitCreate}
                    />

                </div>

            {/if}


            {#if loading}

                <div class="empty" style="padding-left: {20 + depth * 14}px;">
                    Loading...
                </div>

            {:else if children.length === 0 && !isCreatingHere}

                <div class="empty" style="padding-left: {20 + depth * 14}px;">
                    Empty folder
                </div>

            {:else}

                {#each children as child (child.path)}

                    <FileTreeItem
                        item={child}
                        depth={depth + 1}
                        selectedPath={selectedPath}
                        renamingPath={renamingPath}
                        creatingUnderPath={creatingUnderPath}
                        creatingType={creatingType}
                        cutPath={cutPath}
                        refreshKey={refreshKey}
                        onSelect={onSelect}
                        onContextMenu={onContextMenu}
                        onRenameSubmit={onRenameSubmit}
                        onRenameCancel={onRenameCancel}
                        onCreateSubmit={onCreateSubmit}
                        onCreateCancel={onCreateCancel}
                        onDropOnFolder={onDropOnFolder}
                    />

                {/each}

            {/if}

        </div>

    {/if}

</div>


<style>

    .tree-node {

        display: flex;

        flex-direction: column;

    }


    .tree-item {

        height: 24px;

        display: flex;

        align-items: center;

        padding-right: 8px;

        cursor: pointer;

        color: #cccccc;

        font-size: 13px;

        user-select: none;

        border-left: 2px solid transparent;

    }


    .tree-item:hover {

        background: #2a2d2e;

    }


    .tree-item.selected {

        background: #37373d;

        color: #ffffff;

        border-left: 2px solid #007acc;

    }


    .tree-item.is-cut {

        opacity: 0.45;

        font-style: italic;

    }


    .tree-item.drag-over {

        background: #094771 !important;

        outline: 1px dashed #007acc;

    }


    .arrow {

        width: 16px;

        text-align: center;

        font-size: 9px;

        flex-shrink: 0;

        color: #858585;

        cursor: pointer;

        background: transparent;

        border: none;

        padding: 0;

        outline: none;

        line-height: 1;

    }


    .arrow:hover {

        color: #cccccc;

    }


    .arrow-placeholder {

        width: 16px;

        flex-shrink: 0;

    }


    .icon {

        width: 20px;

        display: flex;

        align-items: center;

        justify-content: center;

        flex-shrink: 0;

        font-size: 13px;

        margin-right: 4px;

    }


    .name {

        overflow: hidden;

        white-space: nowrap;

        text-overflow: ellipsis;

        flex: 1;

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


    .inline-create-item {

        background: rgba(0, 122, 204, 0.1);

    }


    .children {

        display: flex;

        flex-direction: column;

    }


    .empty {

        height: 22px;

        display: flex;

        align-items: center;

        color: #858585;

        font-size: 11px;

        font-style: italic;

    }

</style>