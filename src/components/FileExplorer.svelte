<script lang="ts">

    import {
        onMount
    } from "svelte";


    import FileTreeItem
        from "./FileTreeItem.svelte";


    type FileItem = {

        name: string;

        path: string;

        type:
            | "file"
            | "directory";

    };


    let rootPath =
        $state<string | null>(null);


    let rootItems =
        $state<FileItem[]>([]);


    let loading =
        $state(false);


    let error =
        $state<string | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Load Folder
    |--------------------------------------------------------------------------
    */

    async function loadFolder(
        folderPath: string
    ) {

        loading = true;

        error = null;


        try {

            rootItems =
                await window
                    .craftale
                    .filesystem
                    .readDirectory(
                        folderPath
                    );


            rootPath = folderPath;


        } catch (err) {

            console.error(
                "Failed to load folder:",
                err
            );


            error =
                "Unable to load folder.";

        } finally {

            loading = false;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Select Folder
    |--------------------------------------------------------------------------
    */

    async function selectFolder() {

        try {

            const folder =
                await window
                    .craftale
                    .filesystem
                    .selectFolder();


            if (!folder) {

                return;

            }


            await loadFolder(
                folder
            );

        } catch (err) {

            console.error(
                "Folder selection failed:",
                err
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Initial Folder
    |--------------------------------------------------------------------------
    */

    onMount(() => {

        /*
         * We intentionally don't automatically
         * select a folder here.
         *
         * The parent App can provide a folder
         * later.
         */

    });

</script>


<div class="explorer">


    <!--
    |--------------------------------------------------------------------------
    | Header
    |--------------------------------------------------------------------------
    -->

    <div class="explorer-header">

        <div class="title">

            EXPLORER

        </div>


        <button
            type="button"
            class="open-button"
            onclick={selectFolder}
            title="Open Folder"
        >

            Open Folder

        </button>

    </div>


    <!--
    |--------------------------------------------------------------------------
    | Workspace
    |--------------------------------------------------------------------------
    -->

    {#if rootPath}

        <div class="workspace-name">

            📁
            {rootPath.split("\\").pop()}

        </div>


        <div class="tree">

            {#if loading}

                <div class="message">

                    Loading...

                </div>


            {:else if error}

                <div class="message error">

                    {error}

                </div>


            {:else}

                {#each rootItems as item (
                    item.path
                )}

                    <FileTreeItem
                        item={item}
                        level={0}
                    />

                {/each}

            {/if}

        </div>


    {:else}


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


<style>

    .explorer {

        width: 100%;

        height: 100%;

        background: #252526;

        color: #cccccc;

        display: flex;

        flex-direction: column;

        overflow: hidden;

    }


    .explorer-header {

        min-height: 40px;

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 0 10px;

        border-bottom: 1px solid #333333;

    }


    .title {

        font-size: 12px;

        font-weight: 600;

        letter-spacing: 0.5px;

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


    .workspace-name {

        min-height: 30px;

        display: flex;

        align-items: center;

        padding: 0 8px;

        font-size: 12px;

        font-weight: 600;

        border-bottom: 1px solid #333333;

        overflow: hidden;

        white-space: nowrap;

        text-overflow: ellipsis;

    }


    .tree {

        flex: 1;

        overflow: auto;

        padding-top: 4px;

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