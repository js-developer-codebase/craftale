<script lang="ts">

    interface Props {

        visible: boolean;

        title?: string;

        message?: string;

        fileName?: string;

        confirmText?: string;

        secondaryText?: string;

        cancelText?: string;

        danger?: boolean;

        onConfirm: () => void;

        onSecondary?: () => void;

        onCancel: () => void;

    }


    let {
        visible,

        title = "Save Changes",

        message =
            "This file has unsaved changes. " +
            "Do you want to save them before closing?",

        fileName = "",

        confirmText = "Save",

        secondaryText = "Don't Save",

        cancelText = "Cancel",

        danger = false,

        onConfirm,

        onSecondary,

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


        /*
        |--------------------------------------------------------------------------
        | Escape
        |--------------------------------------------------------------------------
        */

        if (event.key === "Escape") {

            event.preventDefault();

            onCancel();

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Enter
        |--------------------------------------------------------------------------
        */

        if (event.key === "Enter") {

            event.preventDefault();

            onConfirm();

        }

    }

</script>


<!--
|--------------------------------------------------------------------------
| IMPORTANT
|--------------------------------------------------------------------------
| svelte:window MUST NOT be inside {#if}
|--------------------------------------------------------------------------
-->

<svelte:window
    onkeydown={handleKeydown}
/>


{#if visible}

    <!--
    |--------------------------------------------------------------------------
    | Backdrop
    |--------------------------------------------------------------------------
    -->

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

        <!--
        |--------------------------------------------------------------------------
        | Modal
        |--------------------------------------------------------------------------
        -->

        <div
            class="modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
        >

            <!-- Header -->

            <div class="header">

                <div
                    class="icon"
                    class:danger-icon={danger}
                >

                    {#if danger}
                        !
                    {:else}
                        ?
                    {/if}

                </div>


                <div class="title">

                    <h2 id="confirm-modal-title">

                        {title}

                    </h2>

                </div>

            </div>


            <!-- Content -->

            <div class="content">

                <p>

                    {message}

                </p>


                {#if fileName}

                    <div class="file">

                        <span class="file-icon">
                            📄
                        </span>

                        <span class="file-name">

                            {fileName}

                        </span>

                    </div>

                {/if}

            </div>


            <!-- Footer -->

            <div class="footer">

                <!-- Cancel -->

                <button
                    type="button"
                    class="button secondary"
                    onclick={onCancel}
                >

                    {cancelText}

                </button>


                <!-- Don't Save -->

                {#if onSecondary}

                    <button
                        type="button"
                        class="button secondary"
                        onclick={onSecondary}
                    >

                        {secondaryText}

                    </button>

                {/if}


                <!-- Save -->

                <button
                    type="button"
                    class="button primary"
                    class:danger
                    onclick={onConfirm}
                >

                    {confirmText}

                </button>

            </div>

        </div>

    </div>

{/if}


<style>

    /*
    |--------------------------------------------------------------------------
    | Backdrop
    |--------------------------------------------------------------------------
    */

    .backdrop {

        position: fixed;

        inset: 0;

        z-index: 9999;

        display: flex;

        align-items: center;

        justify-content: center;

        background:
            rgba(0, 0, 0, 0.55);

        backdrop-filter:
            blur(2px);

    }


    /*
    |--------------------------------------------------------------------------
    | Modal
    |--------------------------------------------------------------------------
    */

    .modal {

        width: 460px;

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


    /*
    |--------------------------------------------------------------------------
    | Header
    |--------------------------------------------------------------------------
    */

    .header {

        display: flex;

        align-items: center;

        gap: 12px;

        padding:
            18px 20px 12px;

    }


    /*
    |--------------------------------------------------------------------------
    | Icon
    |--------------------------------------------------------------------------
    */

    .icon {

        width: 30px;

        height: 30px;

        display: flex;

        align-items: center;

        justify-content: center;

        flex-shrink: 0;

        border-radius:
            50%;

        background:
            #3a3d41;

        color:
            #cccccc;

        font-size:
            16px;

        font-weight:
            600;

    }


    .icon.danger-icon {

        background:
            #5a2525;

        color:
            #ff8585;

    }


    /*
    |--------------------------------------------------------------------------
    | Title
    |--------------------------------------------------------------------------
    */

    .title {

        flex: 1;

        min-width: 0;

    }


    .title h2 {

        margin: 0;

        color:
            #eeeeee;

        font-size:
            15px;

        font-weight:
            500;

    }


    /*
    |--------------------------------------------------------------------------
    | Content
    |--------------------------------------------------------------------------
    */

    .content {

        padding:
            4px 20px 20px 62px;

    }


    .content p {

        margin:
            0 0 14px;

        color:
            #cccccc;

        font-size:
            13px;

        line-height:
            1.5;

    }


    /*
    |--------------------------------------------------------------------------
    | File
    |--------------------------------------------------------------------------
    */

    .file {

        display: flex;

        align-items: center;

        gap: 8px;

        min-width: 0;

        padding:
            8px 10px;

        background:
            #1e1e1e;

        border:
            1px solid #333333;

        border-radius:
            4px;

    }


    .file-icon {

        font-size:
            13px;

        flex-shrink:
            0;

    }


    .file-name {

        overflow:
            hidden;

        text-overflow:
            ellipsis;

        white-space:
            nowrap;

        color:
            #dddddd;

        font-family:
            Consolas,
            "Courier New",
            monospace;

        font-size:
            12px;

    }


    /*
    |--------------------------------------------------------------------------
    | Footer
    |--------------------------------------------------------------------------
    */

    .footer {

        display: flex;

        justify-content:
            flex-end;

        align-items:
            center;

        gap:
            8px;

        padding:
            12px 20px;

        background:
            #2a2a2b;

        border-top:
            1px solid #333333;

    }


    /*
    |--------------------------------------------------------------------------
    | Buttons
    |--------------------------------------------------------------------------
    */

    .button {

        min-width:
            80px;

        height:
            30px;

        padding:
            0 14px;

        border-radius:
            3px;

        font-family:
            inherit;

        font-size:
            12px;

        cursor:
            pointer;

        transition:
            background
            0.1s ease;

    }


    /*
    |--------------------------------------------------------------------------
    | Secondary
    |--------------------------------------------------------------------------
    */

    .secondary {

        border:
            1px solid #555555;

        background:
            #333333;

        color:
            #cccccc;

    }


    .secondary:hover {

        background:
            #3e3e3e;

    }


    /*
    |--------------------------------------------------------------------------
    | Primary
    |--------------------------------------------------------------------------
    */

    .primary {

        border:
            1px solid #0078d4;

        background:
            #0e639c;

        color:
            #ffffff;

    }


    .primary:hover {

        background:
            #1177bb;

    }


    /*
    |--------------------------------------------------------------------------
    | Danger
    |--------------------------------------------------------------------------
    */

    .primary.danger {

        border-color:
            #c42b2b;

        background:
            #a12626;

    }


    .primary.danger:hover {

        background:
            #c42b2b;

    }


    /*
    |--------------------------------------------------------------------------
    | Animation
    |--------------------------------------------------------------------------
    */

    @keyframes modal-enter {

        from {

            opacity: 0;

            transform:
                translateY(-8px)
                scale(0.98);

        }

        to {

            opacity: 1;

            transform:
                translateY(0)
                scale(1);

        }

    }

</style>