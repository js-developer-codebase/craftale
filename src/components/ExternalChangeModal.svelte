<script lang="ts">

    import {
        externalFileConflict,
        clearExternalFileConflict,
        recordSelfTouch
    } from "../stores/watcher";

    import {
        saveFile,
        updateFileContent,
        markFileSaved
    } from "../stores/workspace";

    import { notify } from "../stores/notifications";


    let conflict = $derived($externalFileConflict);


    /*
    |--------------------------------------------------------------------------
    | Actions
    |--------------------------------------------------------------------------
    */

    async function handleOverwrite() {

        if (!conflict) return;

        const path = conflict.path;

        const name = conflict.name;

        recordSelfTouch(path);

        clearExternalFileConflict();

        const success = await saveFile(path);

        if (success) {

            notify.success(`Overwrote disk with changes for "${name}"`);

        }

    }


    function handleReload() {

        if (!conflict) return;

        const path = conflict.path;

        const name = conflict.name;

        const diskContent = conflict.diskContent ?? "";

        recordSelfTouch(path);

        updateFileContent(path, diskContent);

        markFileSaved(path, diskContent);

        clearExternalFileConflict();

        notify.info(`Reloaded "${name}" from disk`);

    }


    function handleIgnore() {

        clearExternalFileConflict();

    }


    function handleKeydown(event: KeyboardEvent) {

        if (conflict && event.key === "Escape") {

            event.preventDefault();

            handleIgnore();

        }

    }

</script>


<svelte:window
    onkeydown={handleKeydown}
/>


{#if conflict}

    <div
        class="backdrop"
        role="presentation"
        onclick={(e) => {
            if (e.target === e.currentTarget) {
                handleIgnore();
            }
        }}
    >

        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="external-conflict-title"
        >

            <!-- Header -->

            <div class="header">

                <div class="icon">
                    ⚠️
                </div>

                <div class="title">

                    <h2 id="external-conflict-title">
                        File Modified on Disk
                    </h2>

                </div>

            </div>


            <!-- Content -->

            <div class="content">

                <p>
                    <strong>{conflict.name}</strong> has been changed on disk by an external application or process.
                </p>

                <p class="subtext">
                    You have unsaved changes in the editor. Would you like to overwrite disk with your changes, or reload the file and discard your changes?
                </p>

            </div>


            <!-- Footer -->

            <div class="footer">

                <button
                    type="button"
                    class="button secondary"
                    onclick={handleIgnore}
                >
                    Ignore
                </button>

                <button
                    type="button"
                    class="button danger"
                    onclick={handleReload}
                >
                    Reload from Disk
                </button>

                <button
                    type="button"
                    class="button primary"
                    onclick={handleOverwrite}
                >
                    Overwrite Disk
                </button>

            </div>

        </div>

    </div>

{/if}


<style>

    .backdrop {

        position: fixed;

        inset: 0;

        z-index: 100001;

        display: flex;

        align-items: center;

        justify-content: center;

        background: rgba(0, 0, 0, 0.6);

        backdrop-filter: blur(2px);

    }


    .modal {

        width: 480px;

        max-width: calc(100vw - 40px);

        background: #252526;

        border: 1px solid #555555;

        border-radius: 6px;

        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);

        overflow: hidden;

        color: #cccccc;

        animation: modal-enter 0.12s ease-out;

    }


    .header {

        display: flex;

        align-items: center;

        gap: 12px;

        padding: 18px 20px 10px;

    }


    .icon {

        width: 32px;

        height: 32px;

        display: flex;

        align-items: center;

        justify-content: center;

        flex-shrink: 0;

        border-radius: 50%;

        background: #3f3922;

        font-size: 16px;

    }


    .title {

        flex: 1;

    }


    .title h2 {

        margin: 0;

        color: #eeeeee;

        font-size: 15px;

        font-weight: 500;

    }


    .content {

        padding: 4px 20px 20px 64px;

    }


    .content p {

        margin: 0 0 8px;

        color: #cccccc;

        font-size: 13px;

        line-height: 1.5;

    }


    .content .subtext {

        color: #aaaaaa;

        font-size: 12px;

    }


    .content strong {

        color: #ffffff;

        font-family: Consolas, "Courier New", monospace;

    }


    .footer {

        display: flex;

        justify-content: flex-end;

        align-items: center;

        gap: 8px;

        padding: 12px 20px;

        background: #2a2a2b;

        border-top: 1px solid #333333;

    }


    .button {

        min-width: 90px;

        height: 30px;

        padding: 0 14px;

        border-radius: 3px;

        font-family: inherit;

        font-size: 12px;

        cursor: pointer;

        transition: background 0.1s;

    }


    .secondary {

        border: 1px solid #555555;

        background: #333333;

        color: #cccccc;

    }


    .secondary:hover {

        background: #3e3e3e;

    }


    .danger {

        border: 1px solid #a12626;

        background: #4d1c1c;

        color: #ff9999;

    }


    .danger:hover {

        background: #662424;

        color: #ffffff;

    }


    .primary {

        border: 1px solid #0078d4;

        background: #0e639c;

        color: #ffffff;

    }


    .primary:hover {

        background: #1177bb;

    }


    @keyframes modal-enter {

        from {

            opacity: 0;

            transform: translateY(-8px) scale(0.98);

        }

        to {

            opacity: 1;

            transform: translateY(0) scale(1);

        }

    }

</style>
