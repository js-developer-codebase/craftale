<script lang="ts">

    import { openFile } from "../stores/workspace";
    import FileTreeItem from "./FileTreeItem.svelte";


    /*
    |--------------------------------------------------------------------------
    | Props
    |--------------------------------------------------------------------------
    */

    let {
        item
    }: {
        item: {
            name: string;
            path: string;
            type: "file" | "directory";
        };
    } = $props();


    /*
    |--------------------------------------------------------------------------
    | Folder State
    |--------------------------------------------------------------------------
    */

    let expanded = $state(false);

    let children = $state<
        {
            name: string;
            path: string;
            type: "file" | "directory";
        }[]
    >([]);

    let loading = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Toggle Folder
    |--------------------------------------------------------------------------
    */

    async function toggleFolder() {

        expanded = !expanded;


        if (!expanded) {

            return;

        }


        if (children.length > 0) {

            return;

        }


        loading = true;


        try {

          
            children =
                await window.craftale.filesystem.readDirectory(
                    item.path
                );


        } catch (error) {

            console.error(
                "[RENDERER] Directory error:",
                error
            );

        } finally {

            loading = false;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Open File
    |--------------------------------------------------------------------------
    */

    async function handleFileClick() {


        try {

            const content =
                await window.craftale.filesystem.readFile(
                    item.path
                );


            openFile({

                name: item.name,

                path: item.path,

                content: content

            });


       

        } catch (error) {

            console.error(
                "[RENDERER] Failed to open file:",
                error
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Click
    |--------------------------------------------------------------------------
    */

    function handleClick() {




        if (
            item.type === "directory"
        ) {

            toggleFolder();

            return;

        }


        handleFileClick();

    }


    /*
    |--------------------------------------------------------------------------
    | Keyboard
    |--------------------------------------------------------------------------
    */

    function handleKeydown(
        event: KeyboardEvent
    ) {

        if (
            event.key === "Enter" ||
            event.key === " "
        ) {

            event.preventDefault();

            handleClick();

        }

    }

</script>


<div>

    <div
        class="tree-item"
        role="button"
        tabindex="0"
        onclick={handleClick}
        onkeydown={handleKeydown}
    >

        {#if item.type === "directory"}

            <span class="arrow">

                {expanded ? "▼" : "▶"}

            </span>

            <span class="icon">
                📁
            </span>

        {:else}

            <span class="arrow-placeholder"></span>

            <span class="icon">
                📄
            </span>

        {/if}


        <span class="name">

            {item.name}

        </span>

    </div>


    {#if item.type === "directory" && expanded}

        <div class="children">

            {#if loading}

                <div class="empty">
                    Loading...
                </div>

            {:else if children.length === 0}

                <div class="empty">
                    Empty folder
                </div>

            {:else}

                {#each children as child (
                    child.path
                )}

                    <FileTreeItem
                        item={child}
                    />

                {/each}

            {/if}

        </div>

    {/if}

</div>


<style>

    .tree-item {

        height: 26px;

        display: flex;

        align-items: center;

        padding-right: 8px;

        cursor: pointer;

        color: #cccccc;

        font-size: 13px;

        user-select: none;

    }


    .tree-item:hover {

        background: #2a2d2e;

    }


    .arrow {

        width: 18px;

        text-align: center;

        font-size: 10px;

        flex-shrink: 0;

    }


    .arrow-placeholder {

        width: 18px;

        flex-shrink: 0;

    }


    .icon {

        width: 24px;

        flex-shrink: 0;

    }


    .name {

        overflow: hidden;

        white-space: nowrap;

        text-overflow: ellipsis;

    }


    .children {

        padding-left: 18px;

    }


    .empty {

        height: 26px;

        display: flex;

        align-items: center;

        padding-left: 18px;

        color: #858585;

        font-size: 12px;

        font-style: italic;

    }

</style>