<script lang="ts">

    interface Props {

        visible: boolean;

        fileName?: string;

        onReplace: () => void;

        onKeepBoth: () => void;

        onCancel: () => void;

    }


    let {
        visible,
        fileName = "",
        onReplace,
        onKeepBoth,
        onCancel
    }: Props = $props();


    /*
    |--------------------------------------------------------------------------
    | Keyboard
    |--------------------------------------------------------------------------
    */

    function handleKeydown(
        event: KeyboardEvent
    ) {

        if (!visible) {
            return;
        }


        if (event.key === "Escape") {

            event.preventDefault();

            onCancel();

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
        onclick={(event) => {

            if (
                event.target ===
                event.currentTarget
            ) {

                onCancel();

            }

        }}
    >

        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="conflict-modal-title"
        >

            <!-- Header -->

            <div class="header">

                <div class="icon">
                    ⚠️
                </div>


                <div class="title">

                    <h2 id="conflict-modal-title">
                        Item Already Exists
                    </h2>

                </div>

            </div>


            <!-- Content -->

            <div class="content">

                <p>
                    An item named <strong>{fileName}</strong> already exists in this destination folder.
                    What would you like to do?
                </p>

            </div>


            <!-- Footer -->

            <div class="footer">

                <!-- Cancel -->

                <button
                    type="button"
                    class="button secondary"
                    onclick={onCancel}
                >
                    Cancel
                </button>


                <!-- Keep Both -->

                <button
                    type="button"
                    class="button primary"
                    onclick={onKeepBoth}
                >
                    Keep Both
                </button>


                <!-- Replace -->

                <button
                    type="button"
                    class="button danger"
                    onclick={onReplace}
                >
                    Replace
                </button>

            </div>

        </div>

    </div>

{/if}


<style>

    .backdrop {

        position: fixed;

        inset: 0;

        z-index: 10000;

        display: flex;

        align-items: center;

        justify-content: center;

        background:
            rgba(0, 0, 0, 0.55);

        backdrop-filter:
            blur(2px);

    }


    .modal {

        width: 440px;

        max-width:
            calc(100vw - 40px);

        background:
            #252526;

        border:
            1px solid #454545;

        border-radius:
            6px;

        box-shadow:
            0 20px 60px
            rgba(0, 0, 0, 0.55);

        overflow:
            hidden;

        color:
            #cccccc;

        animation:
            modal-enter
            0.12s ease-out;

    }


    .header {

        display: flex;

        align-items: center;

        gap: 12px;

        padding:
            18px 20px 12px;

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

        min-width: 0;

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

        margin: 0;

        color: #cccccc;

        font-size: 13px;

        line-height: 1.5;

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

        min-width: 80px;

        height: 30px;

        padding: 0 14px;

        border-radius: 3px;

        font-family: inherit;

        font-size: 12px;

        cursor: pointer;

        transition: background 0.1s ease;

    }


    .secondary {

        border: 1px solid #555555;

        background: #333333;

        color: #cccccc;

    }


    .secondary:hover {

        background: #3e3e3e;

    }


    .primary {

        border: 1px solid #0078d4;

        background: #0e639c;

        color: #ffffff;

    }


    .primary:hover {

        background: #1177bb;

    }


    .danger {

        border: 1px solid #c42b2b;

        background: #a12626;

        color: #ffffff;

    }


    .danger:hover {

        background: #c42b2b;

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
