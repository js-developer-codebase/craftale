<script lang="ts">

    import type { OpenFile } from "../stores/workspace";

    interface Props {

        visible: boolean;

        files: OpenFile[];

        onSaveAll: () => void;

        onDiscardAll: () => void;

        onCancel: () => void;

    }


    let {
        visible,
        files = [],
        onSaveAll,
        onDiscardAll,
        onCancel
    }: Props = $props();


    function handleKeydown(event: KeyboardEvent) {

        if (!visible) return;

        if (event.key === "Escape") {

            event.preventDefault();

            onCancel();

        } else if (event.key === "Enter") {

            event.preventDefault();

            onSaveAll();

        }

    }

</script>


<svelte:window
    onkeydown={handleKeydown}
/>


{#if visible}

    <div
        class="backdrop"
        role="presentation"
        onclick={(e) => {
            if (e.target === e.currentTarget) {
                onCancel();
            }
        }}
    >

        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="batch-close-modal-title"
        >

            <!-- Header -->

            <div class="header">

                <div class="icon">
                    ⚠️
                </div>

                <div class="title">

                    <h2 id="batch-close-modal-title">
                        Save Changes
                    </h2>

                </div>

            </div>


            <!-- Content -->

            <div class="content">

                <p>
                    The following {files.length} {files.length === 1 ? "file has" : "files have"} unsaved changes. Do you want to save them before closing?
                </p>


                <div class="file-list">

                    {#each files as file (file.path)}

                        <div class="file-item" title={file.path}>

                            <span class="file-icon">📄</span>

                            <span class="file-name">{file.name}</span>

                            <span class="dirty-badge">●</span>

                        </div>

                    {/each}

                </div>

            </div>


            <!-- Footer Actions -->

            <div class="footer">

                <button
                    type="button"
                    class="button secondary"
                    onclick={onCancel}
                >
                    Cancel
                </button>

                <button
                    type="button"
                    class="button danger"
                    onclick={onDiscardAll}
                >
                    Don't Save
                </button>

                <button
                    type="button"
                    class="button primary"
                    onclick={onSaveAll}
                >
                    Save All
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

        background: rgba(0, 0, 0, 0.65);

        backdrop-filter: blur(2px);

    }


    .modal {

        width: 440px;

        max-width: 90vw;

        background: #252526;

        border: 1px solid #454545;

        border-radius: 6px;

        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);

        overflow: hidden;

        animation: modal-appear 0.15s ease-out;

    }


    @keyframes modal-appear {

        from {
            opacity: 0;
            transform: scale(0.96) translateY(-8px);
        }

        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }

    }


    .header {

        display: flex;

        align-items: center;

        gap: 12px;

        padding: 16px 20px 12px 20px;

        border-bottom: 1px solid #333333;

    }


    .icon {

        font-size: 20px;

        line-height: 1;

    }


    .title h2 {

        margin: 0;

        font-size: 15px;

        font-weight: 600;

        color: #ffffff;

    }


    .content {

        padding: 16px 20px;

        font-size: 13px;

        line-height: 1.5;

        color: #cccccc;

    }


    .content p {

        margin: 0 0 12px 0;

    }


    .file-list {

        max-height: 160px;

        overflow-y: auto;

        background: #1e1e1e;

        border: 1px solid #333333;

        border-radius: 4px;

        padding: 4px 0;

    }


    .file-list::-webkit-scrollbar {

        width: 6px;

    }


    .file-list::-webkit-scrollbar-thumb {

        background: #424242;

        border-radius: 3px;

    }


    .file-item {

        display: flex;

        align-items: center;

        gap: 8px;

        padding: 5px 12px;

        font-size: 12px;

        color: #cccccc;

    }


    .file-item:hover {

        background: #2a2d2e;

    }


    .file-icon {

        font-size: 13px;

        flex-shrink: 0;

    }


    .file-name {

        flex: 1;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

    }


    .dirty-badge {

        color: #ffffff;

        font-size: 10px;

        flex-shrink: 0;

    }


    .footer {

        display: flex;

        justify-content: flex-end;

        align-items: center;

        gap: 8px;

        padding: 12px 20px 16px 20px;

        background: #202020;

        border-top: 1px solid #2d2d2d;

    }


    .button {

        height: 28px;

        padding: 0 14px;

        border-radius: 3px;

        font-size: 12px;

        font-weight: 500;

        cursor: pointer;

        border: 1px solid transparent;

        transition: background 0.15s ease;

    }


    .button.secondary {

        background: #3a3d41;

        color: #cccccc;

        border-color: #454545;

    }


    .button.secondary:hover {

        background: #45494e;

        color: #ffffff;

    }


    .button.danger {

        background: #a12626;

        color: #ffffff;

    }


    .button.danger:hover {

        background: #be2e2e;

    }


    .button.primary {

        background: #007acc;

        color: #ffffff;

    }


    .button.primary:hover {

        background: #0098ff;

    }

</style>
