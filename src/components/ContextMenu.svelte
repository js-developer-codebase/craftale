<script lang="ts">

    interface Props {

        x: number;

        y: number;

        visible: boolean;

        hasItem?: boolean;

        canPaste?: boolean;

        onNewFile: () => void;

        onNewFolder: () => void;

        onCut?: () => void;

        onCopy?: () => void;

        onPaste?: () => void;

        onDuplicate?: () => void;

        onRename?: () => void;

        onDelete?: () => void;

        onClose: () => void;

    }


    let {
        x,
        y,
        visible,
        hasItem = true,
        canPaste = false,
        onNewFile,
        onNewFolder,
        onCut,
        onCopy,
        onPaste,
        onDuplicate,
        onRename,
        onDelete,
        onClose
    }: Props = $props();


    let menuElement = $state<HTMLDivElement | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Position Adjusted for Screen Boundaries
    |--------------------------------------------------------------------------
    */

    let adjustedX = $derived.by(() => {

        if (typeof window === "undefined") {
            return x;
        }

        const menuWidth = 180;

        return x + menuWidth > window.innerWidth
            ? Math.max(10, window.innerWidth - menuWidth - 10)
            : x;

    });


    let adjustedY = $derived.by(() => {

        if (typeof window === "undefined") {
            return y;
        }

        const menuHeight = 240;

        return y + menuHeight > window.innerHeight
            ? Math.max(10, window.innerHeight - menuHeight - 10)
            : y;

    });


    /*
    |--------------------------------------------------------------------------
    | Click Outside & Keyboard Listener
    |--------------------------------------------------------------------------
    */

    function handleWindowClick(event: MouseEvent) {

        if (visible && menuElement && !menuElement.contains(event.target as Node)) {

            onClose();

        }

    }


    function handleKeydown(event: KeyboardEvent) {

        if (visible && event.key === "Escape") {

            onClose();

        }

    }

</script>


<svelte:window
    onclick={handleWindowClick}
    onkeydown={handleKeydown}
    oncontextmenu={handleWindowClick}
/>


{#if visible}

    <div
        bind:this={menuElement}
        class="context-menu"
        style="top: {adjustedY}px; left: {adjustedX}px;"
        role="menu"
        tabindex="-1"
    >

        <button
            type="button"
            class="menu-item"
            onclick={() => {
                onClose();
                onNewFile();
            }}
        >
            <span class="label">New File</span>
        </button>


        <button
            type="button"
            class="menu-item"
            onclick={() => {
                onClose();
                onNewFolder();
            }}
        >
            <span class="label">New Folder</span>
        </button>


        <div class="divider"></div>


        {#if hasItem}

            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onCut?.();
                }}
            >
                <span class="label">Cut</span>
                <span class="shortcut">Ctrl+X</span>
            </button>


            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onCopy?.();
                }}
            >
                <span class="label">Copy</span>
                <span class="shortcut">Ctrl+C</span>
            </button>

        {/if}


        <button
            type="button"
            class="menu-item"
            class:disabled={!canPaste}
            disabled={!canPaste}
            onclick={() => {
                if (canPaste) {
                    onClose();
                    onPaste?.();
                }
            }}
        >
            <span class="label">Paste</span>
            <span class="shortcut">Ctrl+V</span>
        </button>


        {#if hasItem}

            <div class="divider"></div>


            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onDuplicate?.();
                }}
            >
                <span class="label">Duplicate</span>
                <span class="shortcut">Ctrl+D</span>
            </button>


            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onRename?.();
                }}
            >
                <span class="label">Rename...</span>
                <span class="shortcut">F2</span>
            </button>


            <div class="divider"></div>


            <button
                type="button"
                class="menu-item danger"
                onclick={() => {
                    onClose();
                    onDelete?.();
                }}
            >
                <span class="label">Delete</span>
                <span class="shortcut">Del</span>
            </button>

        {/if}

    </div>

{/if}


<style>

    .context-menu {

        position: fixed;

        z-index: 100000;

        width: 190px;

        background: #252526;

        border: 1px solid #454545;

        border-radius: 5px;

        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.45);

        padding: 4px 0;

        user-select: none;

        outline: none;

        font-family: inherit;

    }


    .menu-item {

        width: 100%;

        height: 26px;

        display: flex;

        align-items: center;

        justify-content: space-between;

        padding: 0 12px;

        background: transparent;

        border: none;

        color: #cccccc;

        font-size: 12px;

        text-align: left;

        cursor: pointer;

        outline: none;

    }


    .menu-item:hover:not(.disabled) {

        background: #094771;

        color: #ffffff;

    }


    .menu-item.danger:hover {

        background: #a12626;

        color: #ffffff;

    }


    .menu-item.disabled {

        opacity: 0.4;

        cursor: default;

    }


    .shortcut {

        color: #888888;

        font-size: 11px;

    }


    .menu-item:hover:not(.disabled) .shortcut {

        color: #eeeeee;

    }


    .divider {

        height: 1px;

        background: #3c3c3c;

        margin: 4px 0;

    }

</style>
