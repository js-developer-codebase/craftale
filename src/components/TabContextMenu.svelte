<script lang="ts">

    import type { OpenFile } from "../stores/workspace";

    interface Props {

        x: number;

        y: number;

        visible: boolean;

        targetFile: OpenFile | null;

        canReopen?: boolean;

        onClose: () => void;

        onCloseTab?: (file: OpenFile) => void;

        onCloseOthers?: (file: OpenFile) => void;

        onCloseToTheRight?: (file: OpenFile) => void;

        onCloseSaved?: () => void;

        onCloseAll?: () => void;

        onReopenClosed?: () => void;

        onPinTab?: (file: OpenFile) => void;

        onUnpinTab?: (file: OpenFile) => void;

        onKeepOpen?: (file: OpenFile) => void;

    }


    let {
        x,
        y,
        visible,
        targetFile,
        canReopen = false,
        onClose,
        onCloseTab,
        onCloseOthers,
        onCloseToTheRight,
        onCloseSaved,
        onCloseAll,
        onReopenClosed,
        onPinTab,
        onUnpinTab,
        onKeepOpen
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

        const menuWidth = 200;

        return x + menuWidth > window.innerWidth
            ? Math.max(10, window.innerWidth - menuWidth - 10)
            : x;

    });


    let adjustedY = $derived.by(() => {

        if (typeof window === "undefined") {
            return y;
        }

        const menuHeight = 280;

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
        class="tab-context-menu"
        style="top: {adjustedY}px; left: {adjustedX}px;"
        role="menu"
        tabindex="-1"
    >

        {#if targetFile}

            <!-- Close Active / Target Tab -->

            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onCloseTab?.(targetFile);
                }}
            >
                <span class="label">Close</span>
                <span class="shortcut">Ctrl+W</span>
            </button>


            <!-- Close Others -->

            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onCloseOthers?.(targetFile);
                }}
            >
                <span class="label">Close Others</span>
            </button>


            <!-- Close Tabs to the Right -->

            <button
                type="button"
                class="menu-item"
                onclick={() => {
                    onClose();
                    onCloseToTheRight?.(targetFile);
                }}
            >
                <span class="label">Close to the Right</span>
            </button>

        {/if}


        <!-- Close Saved / Unchanged -->

        <button
            type="button"
            class="menu-item"
            onclick={() => {
                onClose();
                onCloseSaved?.();
            }}
        >
            <span class="label">Close Saved</span>
            <span class="shortcut">Ctrl+K U</span>
        </button>


        <!-- Close All -->

        <button
            type="button"
            class="menu-item"
            onclick={() => {
                onClose();
                onCloseAll?.();
            }}
        >
            <span class="label">Close All</span>
            <span class="shortcut">Ctrl+K W</span>
        </button>


        <div class="divider"></div>


        <!-- Reopen Closed Tab -->

        <button
            type="button"
            class="menu-item"
            class:disabled={!canReopen}
            onclick={() => {
                if (canReopen) {
                    onClose();
                    onReopenClosed?.();
                }
            }}
        >
            <span class="label">Reopen Closed Tab</span>
            <span class="shortcut">Ctrl+Shift+T</span>
        </button>


        {#if targetFile}

            <div class="divider"></div>


            <!-- Pin / Unpin Tab -->

            {#if targetFile.isPinned}

                <button
                    type="button"
                    class="menu-item"
                    onclick={() => {
                        onClose();
                        onUnpinTab?.(targetFile);
                    }}
                >
                    <span class="label">Unpin Tab</span>
                </button>

            {:else}

                <button
                    type="button"
                    class="menu-item"
                    onclick={() => {
                        onClose();
                        onPinTab?.(targetFile);
                    }}
                >
                    <span class="label">Pin Tab</span>
                </button>

            {/if}


            <!-- Keep Open (if Preview Tab) -->

            {#if targetFile.isPreview}

                <button
                    type="button"
                    class="menu-item"
                    onclick={() => {
                        onClose();
                        onKeepOpen?.(targetFile);
                    }}
                >
                    <span class="label">Keep Open</span>
                    <span class="shortcut">Enter</span>
                </button>

            {/if}

        {/if}

    </div>

{/if}


<style>

    .tab-context-menu {

        position: fixed;

        z-index: 100000;

        width: 210px;

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


    .menu-item.disabled {

        opacity: 0.4;

        cursor: default;

    }


    .label {

        flex: 1;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

    }


    .shortcut {

        color: #888888;

        font-size: 11px;

        margin-left: 12px;

        flex-shrink: 0;

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
