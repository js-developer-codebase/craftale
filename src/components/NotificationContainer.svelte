<script lang="ts">

    import {
        notifications,
        notify,
        type NotificationItem
    } from "../stores/notifications";


    /*
    |--------------------------------------------------------------------------
    | Expanded Details State (Set of notification IDs)
    |--------------------------------------------------------------------------
    */

    let expandedDetails = $state<Record<string, boolean>>({});

    let isHovered = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Timers Map
    |--------------------------------------------------------------------------
    */

    const timers = new Map<string, ReturnType<typeof setTimeout>>();


    /*
    |--------------------------------------------------------------------------
    | Manage Auto-Dismiss Timers
    |--------------------------------------------------------------------------
    */

    function scheduleDismiss(item: NotificationItem) {

        if (item.duration <= 0) return;

        if (timers.has(item.id)) {

            clearTimeout(timers.get(item.id));

        }

        const timer = setTimeout(() => {

            if (!isHovered) {

                notify.dismiss(item.id);

            }

        }, item.duration);

        timers.set(item.id, timer);

    }


    /*
    |--------------------------------------------------------------------------
    | React to notifications list changes
    |--------------------------------------------------------------------------
    */

    $effect(() => {

        const list = $notifications;

        list.forEach((item) => {

            if (!timers.has(item.id) && item.duration > 0) {

                scheduleDismiss(item);

            }

        });

    });


    function handleMouseEnter() {

        isHovered = true;

        /* Clear all pending timers while user is inspecting */

        timers.forEach((t) => clearTimeout(t));

        timers.clear();

    }


    function handleMouseLeave() {

        isHovered = false;

        /* Reschedule remaining items */

        $notifications.forEach((item) => {

            scheduleDismiss(item);

        });

    }


    function toggleDetails(id: string) {

        expandedDetails[id] = !expandedDetails[id];

    }

</script>


{#if $notifications.length > 0}

    <div
        class="notification-container"
        role="region"
        aria-label="Notifications"
        onmouseenter={handleMouseEnter}
        onmouseleave={handleMouseLeave}
    >

        <!-- Header with Clear All if multiple items -->

        {#if $notifications.length > 1}

            <div class="container-header">

                <span class="count">
                    {$notifications.length} notifications
                </span>

                <button
                    type="button"
                    class="clear-all-btn"
                    onclick={notify.clearAll}
                >
                    Clear All
                </button>

            </div>

        {/if}


        {#each $notifications as item (item.id)}

            <div
                class="notification-card {item.type}"
                role="alert"
                aria-live={item.type === "error" ? "assertive" : "polite"}
            >

                <!-- Status Icon -->

                <div class="icon">

                    {#if item.type === "error"}
                        <span class="symbol error">✕</span>
                    {:else if item.type === "warning"}
                        <span class="symbol warning">!</span>
                    {:else if item.type === "success"}
                        <span class="symbol success">✓</span>
                    {:else}
                        <span class="symbol info">i</span>
                    {/if}

                </div>


                <!-- Content -->

                <div class="body">

                    <div class="message">
                        {item.message}
                    </div>


                    {#if item.description}

                        <div class="description">
                            {item.description}
                        </div>

                    {/if}


                    <!-- Actions -->

                    {#if item.actions && item.actions.length > 0}

                        <div class="actions">

                            {#each item.actions as action}

                                <button
                                    type="button"
                                    class="action-btn"
                                    class:primary={action.primary}
                                    onclick={() => {
                                        action.onClick();
                                        notify.dismiss(item.id);
                                    }}
                                >
                                    {action.label}
                                </button>

                            {/each}

                        </div>

                    {/if}


                    <!-- Details Collapsible -->

                    {#if item.details}

                        <button
                            type="button"
                            class="details-toggle"
                            onclick={() => toggleDetails(item.id)}
                        >
                            {expandedDetails[item.id] ? "▾ Hide Details" : "▸ Show Details"}
                        </button>


                        {#if expandedDetails[item.id]}

                            <pre class="details-box">{item.details}</pre>

                        {/if}

                    {/if}

                </div>


                <!-- Dismiss Button -->

                <button
                    type="button"
                    class="close-btn"
                    aria-label="Dismiss notification"
                    onclick={() => notify.dismiss(item.id)}
                >
                    ×
                </button>

            </div>

        {/each}

    </div>

{/if}


<style>

    .notification-container {

        position: fixed;

        bottom: 24px;

        right: 24px;

        z-index: 100000;

        width: 380px;

        max-width: calc(100vw - 32px);

        display: flex;

        flex-direction: column;

        gap: 8px;

        pointer-events: auto;

        font-family: inherit;

    }


    .container-header {

        display: flex;

        justify-content: space-between;

        align-items: center;

        padding: 0 4px;

        font-size: 11px;

        color: #888888;

    }


    .clear-all-btn {

        background: transparent;

        border: none;

        color: #3794ff;

        cursor: pointer;

        padding: 2px 4px;

        font-size: 11px;

    }


    .clear-all-btn:hover {

        text-decoration: underline;

    }


    .notification-card {

        display: flex;

        align-items: flex-start;

        gap: 12px;

        padding: 12px 14px;

        background: #252526;

        border: 1px solid #454545;

        border-radius: 6px;

        box-shadow: 0 8px 24px rgba(0, 0, 0, 0.55);

        color: #cccccc;

        animation: toast-enter 0.15s ease-out;

    }


    .notification-card.error {

        border-left: 4px solid #f48771;

    }


    .notification-card.warning {

        border-left: 4px solid #cca700;

    }


    .notification-card.info {

        border-left: 4px solid #3794ff;

    }


    .notification-card.success {

        border-left: 4px solid #89d185;

    }


    .icon {

        width: 20px;

        height: 20px;

        display: flex;

        align-items: center;

        justify-content: center;

        flex-shrink: 0;

        margin-top: 1px;

    }


    .symbol {

        width: 18px;

        height: 18px;

        display: flex;

        align-items: center;

        justify-content: center;

        border-radius: 50%;

        font-size: 11px;

        font-weight: 700;

    }


    .symbol.error {

        background: #5a2525;

        color: #ff8585;

    }


    .symbol.warning {

        background: #4d3d14;

        color: #e5b922;

    }


    .symbol.info {

        background: #17385c;

        color: #70b0ff;

    }


    .symbol.success {

        background: #1e3f28;

        color: #92e697;

    }


    .body {

        flex: 1;

        min-width: 0;

    }


    .message {

        font-size: 13px;

        font-weight: 500;

        color: #eeeeee;

        line-height: 1.4;

        word-break: break-word;

    }


    .description {

        margin-top: 4px;

        font-size: 12px;

        color: #aaaaaa;

        line-height: 1.4;

        word-break: break-word;

    }


    .actions {

        display: flex;

        gap: 6px;

        margin-top: 8px;

    }


    .action-btn {

        padding: 3px 10px;

        font-size: 11px;

        border-radius: 3px;

        cursor: pointer;

        background: #333333;

        border: 1px solid #555555;

        color: #cccccc;

        transition: background 0.1s;

    }


    .action-btn:hover {

        background: #444444;

    }


    .action-btn.primary {

        background: #0e639c;

        border-color: #007acc;

        color: #ffffff;

    }


    .action-btn.primary:hover {

        background: #1177bb;

    }


    .details-toggle {

        background: transparent;

        border: none;

        color: #888888;

        cursor: pointer;

        font-size: 11px;

        padding: 0;

        margin-top: 6px;

        display: block;

    }


    .details-toggle:hover {

        color: #cccccc;

    }


    .details-box {

        margin: 6px 0 0;

        padding: 8px;

        background: #181818;

        border: 1px solid #333333;

        border-radius: 3px;

        font-family: Consolas, "Courier New", monospace;

        font-size: 11px;

        color: #e06c75;

        max-height: 140px;

        overflow: auto;

        white-space: pre-wrap;

        word-break: break-all;

    }


    .close-btn {

        background: transparent;

        border: none;

        color: #858585;

        cursor: pointer;

        font-size: 16px;

        line-height: 1;

        padding: 2px 4px;

        flex-shrink: 0;

    }


    .close-btn:hover {

        color: #ffffff;

    }


    @keyframes toast-enter {

        from {

            opacity: 0;

            transform: translateY(10px) scale(0.96);

        }

        to {

            opacity: 1;

            transform: translateY(0) scale(1);

        }

    }

</style>
