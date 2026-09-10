<script lang="ts">

    import {
        fileSwitcherState,
        cycleFileSwitcher,
        closeFileSwitcher
    } from "../stores/navigation";
    import {
        openedFiles,
        activateFile,
        pathsEqual
    } from "../stores/workspace";

    function handleWindowKeyUp(event: KeyboardEvent) {

        if (!$fileSwitcherState.visible) return;

        /* Releasing Ctrl or Meta confirms selection */
        if (event.key === "Control" || event.key === "Meta") {

            const selected = closeFileSwitcher();

            if (selected) {

                activateFile(selected);

            }

        }

    }

    function handleWindowKeyDown(event: KeyboardEvent) {

        if (!$fileSwitcherState.visible) return;

        if (event.key === "Escape") {

            event.preventDefault();

            closeFileSwitcher();

            return;

        }

        if (event.key === "Tab" && (event.ctrlKey || event.metaKey)) {

            event.preventDefault();

            cycleFileSwitcher(event.shiftKey ? -1 : 1);

            return;

        }

    }

    function selectIndex(index: number) {

        fileSwitcherState.update((s) => ({ ...s, selectedIndex: index }));

        const selected = closeFileSwitcher();

        if (selected) {

            activateFile(selected);

        }

    }

    function getFileName(filePath: string): string {

        return filePath.split(/[\\/]/).pop() || filePath;

    }

    function getFileIcon(fileName: string): string {

        const ext = fileName.split(".").pop()?.toLowerCase() || "";

        switch (ext) {

            case "ts": return "🔷";

            case "js": return "🟨";

            case "svelte": return "🟧";

            case "json": return "📋";

            case "css": return "🎨";

            case "html": return "🌐";

            case "md": return "📝";

            case "py": return "🐍";

            default: return "📄";

        }

    }

</script>

<svelte:window
    onkeyup={handleWindowKeyUp}
    onkeydown={handleWindowKeyDown}
/>

{#if $fileSwitcherState.visible}

    <div
        class="switcher-backdrop"
        role="presentation"
        onclick={() => closeFileSwitcher()}
    >

        <div
            class="switcher-modal"
            role="dialog"
            aria-modal="true"
            aria-label="Active File Switcher"
            onclick={(e) => e.stopPropagation()}
        >

            <div class="switcher-header">

                <span class="switcher-title">RECENTLY USED FILES</span>

                <span class="switcher-hint">Release Ctrl to select</span>

            </div>

            <div class="switcher-list" role="listbox">

                {#each $fileSwitcherState.files as filePath, index (filePath)}

                    {@const fileName = getFileName(filePath)}

                    {@const openDoc = $openedFiles.find((f) => pathsEqual(f.path, filePath))}

                    <div
                        class="switcher-item"
                        class:selected={index === $fileSwitcherState.selectedIndex}
                        role="option"
                        aria-selected={index === $fileSwitcherState.selectedIndex}
                        onclick={() => selectIndex(index)}
                        onmouseenter={() => {
                            fileSwitcherState.update((s) => ({ ...s, selectedIndex: index }));
                        }}
                    >

                        <span class="switcher-icon">
                            {getFileIcon(fileName)}
                        </span>

                        <span class="switcher-name">
                            {fileName}
                        </span>

                        {#if openDoc?.isDirty}
                            <span class="switcher-dirty" title="Unsaved changes">●</span>
                        {/if}

                        <span class="switcher-path" title={filePath}>
                            {filePath}
                        </span>

                    </div>

                {/each}

            </div>

        </div>

    </div>

{/if}

<style>

    /*
    |--------------------------------------------------------------------------
    | Switcher Backdrop
    |--------------------------------------------------------------------------
    */

    .switcher-backdrop {

        position: fixed;

        inset: 0;

        background: rgba(0, 0, 0, 0.4);

        display: flex;

        justify-content: center;

        align-items: center;

        z-index: 10000;

    }

    .switcher-modal {

        width: 480px;

        max-width: 90vw;

        max-height: 400px;

        background: #252526;

        border: 1px solid #3c3c3c;

        border-radius: 8px;

        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.6);

        overflow: hidden;

        display: flex;

        flex-direction: column;

        animation: popIn 0.1s cubic-bezier(0.16, 1, 0.3, 1);

    }

    @keyframes popIn {
        from { transform: scale(0.96); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }

    .switcher-header {

        padding: 8px 12px;

        background: #1e1e1e;

        border-bottom: 1px solid #333333;

        display: flex;

        justify-content: space-between;

        align-items: center;

        user-select: none;

    }

    .switcher-title {

        font-size: 11px;

        font-weight: 700;

        letter-spacing: 0.5px;

        color: #94a3b8;

    }

    .switcher-hint {

        font-size: 10px;

        color: #64748b;

    }

    .switcher-list {

        padding: 4px;

        overflow-y: auto;

        max-height: 320px;

        display: flex;

        flex-direction: column;

        gap: 2px;

    }

    .switcher-item {

        display: flex;

        align-items: center;

        gap: 8px;

        padding: 6px 10px;

        border-radius: 4px;

        cursor: pointer;

        user-select: none;

        font-size: 12px;

    }

    .switcher-item.selected {

        background: #04395e;

    }

    .switcher-item:hover:not(.selected) {

        background: #2a2d2e;

    }

    .switcher-icon {

        font-size: 13px;

    }

    .switcher-name {

        color: #e2e8f0;

        font-weight: 500;

    }

    .switcher-dirty {

        color: #3b82f6;

        font-size: 10px;

    }

    .switcher-path {

        margin-left: auto;

        font-size: 11px;

        color: #64748b;

        max-width: 200px;

        white-space: nowrap;

        overflow: hidden;

        text-overflow: ellipsis;

    }

    .switcher-item.selected .switcher-path {

        color: #94a3b8;

    }

</style>
