<script lang="ts">
    import {
        debugStatus,
        resumeDebugging,
        pauseDebugging,
        stepOver,
        stepInto,
        stepOut,
        restartDebugging,
        stopDebugging,
        activePort
    } from "../stores/debugger";

    let isDragging = $state(false);
    let startX = 0;
    let startY = 0;
    let offsetX = $state(0);
    let offsetY = $state(0);

    function onMouseDown(e: MouseEvent) {
        if ((e.target as HTMLElement).closest("button")) return;
        isDragging = true;
        startX = e.clientX - offsetX;
        startY = e.clientY - offsetY;

        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
    }

    function onMouseMove(e: MouseEvent) {
        if (!isDragging) return;
        offsetX = e.clientX - startX;
        offsetY = e.clientY - startY;
    }

    function onMouseUp() {
        isDragging = false;
        window.removeEventListener("mousemove", onMouseMove);
        window.removeEventListener("mouseup", onMouseUp);
    }
</script>

{#if $debugStatus !== "inactive"}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        class="debug-toolbar"
        style={`transform: translate(calc(-50% + ${offsetX}px), ${offsetY}px);`}
        onmousedown={onMouseDown}
        role="toolbar"
        aria-label="Debug Toolbar"
    >
        <div class="drag-handle" title="Drag toolbar">
            <span class="drag-dots">⋮⋮</span>
            <div class="status-indicator" class:paused={$debugStatus === "paused"} class:running={$debugStatus === "running"}>
                <span class="status-dot"></span>
                <span class="status-label">
                    {$debugStatus === "paused" ? "Paused" : $debugStatus === "running" ? "Running" : "Starting"}
                    {#if $activePort}
                        <span class="port-tag">:{ $activePort }</span>
                    {/if}
                </span>
            </div>
        </div>

        <div class="toolbar-actions">
            <!-- Continue / Pause -->
            {#if $debugStatus === "paused"}
                <button
                    type="button"
                    class="btn-debug continue"
                    onclick={resumeDebugging}
                    title="Continue (F5)"
                    aria-label="Continue"
                >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <polygon points="4,2 14,8 4,14" />
                    </svg>
                </button>
            {:else}
                <button
                    type="button"
                    class="btn-debug pause"
                    onclick={pauseDebugging}
                    title="Pause (F5)"
                    aria-label="Pause"
                >
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                        <rect x="3" y="3" width="3.5" height="10" />
                        <rect x="9.5" y="3" width="3.5" height="10" />
                    </svg>
                </button>
            {/if}

            <!-- Step Over (F10) -->
            <button
                type="button"
                class="btn-debug step-over"
                onclick={stepOver}
                disabled={$debugStatus !== "paused"}
                title="Step Over (F10)"
                aria-label="Step Over"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M4 2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h6.586l-2.293 2.293 1.414 1.414L15.414 8l-3.707-3.707-1.414 1.414L12.586 8H4V4h8V2H4z"/>
                </svg>
            </button>

            <!-- Step Into (F11) -->
            <button
                type="button"
                class="btn-debug step-into"
                onclick={stepInto}
                disabled={$debugStatus !== "paused"}
                title="Step Into (F11)"
                aria-label="Step Into"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M7 2h2v7.586l2.293-2.293 1.414 1.414L8 13.414 3.293 8.707l1.414-1.414L7 9.586V2z"/>
                </svg>
            </button>

            <!-- Step Out (Shift + F11) -->
            <button
                type="button"
                class="btn-debug step-out"
                onclick={stepOut}
                disabled={$debugStatus !== "paused"}
                title="Step Out (Shift+F11)"
                aria-label="Step Out"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M7 14h2V6.414l2.293 2.293 1.414-1.414L8 2.586 3.293 7.293l1.414 1.414L7 6.414V14z"/>
                </svg>
            </button>

            <!-- Restart (Ctrl + Shift + F5) -->
            <button
                type="button"
                class="btn-debug restart"
                onclick={restartDebugging}
                title="Restart (Ctrl+Shift+F5)"
                aria-label="Restart"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <path d="M13.65 2.35A7.958 7.958 0 0 0 8 0a8 8 0 1 0 8 8h-2a6 6 0 1 1-1.76-4.24l-2.24 2.24h6V0l-2.35 2.35z"/>
                </svg>
            </button>

            <!-- Stop (Shift + F5) -->
            <button
                type="button"
                class="btn-debug stop"
                onclick={stopDebugging}
                title="Stop (Shift+F5)"
                aria-label="Stop"
            >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                    <rect x="3" y="3" width="10" height="10" rx="1" />
                </svg>
            </button>
        </div>
    </div>
{/if}

<style>
    .debug-toolbar {
        position: absolute;
        top: 42px;
        left: 50%;
        display: flex;
        align-items: center;
        background: #252526;
        border: 1px solid #454545;
        border-radius: 6px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        padding: 3px 6px;
        gap: 6px;
        z-index: 1000;
        user-select: none;
        cursor: grab;
        transition: box-shadow 0.15s ease;
    }

    .debug-toolbar:active {
        cursor: grabbing;
        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.7);
    }

    .drag-handle {
        display: flex;
        align-items: center;
        gap: 6px;
        padding-right: 6px;
        border-right: 1px solid #3c3c3c;
    }

    .drag-dots {
        color: #717171;
        font-size: 11px;
        letter-spacing: -2px;
    }

    .status-indicator {
        display: flex;
        align-items: center;
        gap: 5px;
    }

    .status-dot {
        width: 7px;
        height: 7px;
        border-radius: 50%;
        background: #888888;
    }

    .status-indicator.running .status-dot {
        background: #4ec9b0;
        box-shadow: 0 0 6px rgba(78, 201, 176, 0.8);
        animation: pulse 1.8s infinite;
    }

    .status-indicator.paused .status-dot {
        background: #eab308;
        box-shadow: 0 0 6px rgba(234, 179, 8, 0.8);
    }

    @keyframes pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50% { opacity: 0.5; transform: scale(0.9); }
    }

    .status-label {
        font-size: 11px;
        color: #cccccc;
        font-weight: 500;
    }

    .port-tag {
        color: #858585;
        font-size: 10px;
    }

    .toolbar-actions {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .btn-debug {
        width: 28px;
        height: 28px;
        background: transparent;
        border: none;
        border-radius: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #cccccc;
        cursor: pointer;
        transition: background 0.12s ease, color 0.12s ease;
    }

    .btn-debug:hover:not(:disabled) {
        background: #3c3c3c;
    }

    .btn-debug:disabled {
        opacity: 0.35;
        cursor: not-allowed;
    }

    .btn-debug.continue {
        color: #4ec9b0;
    }

    .btn-debug.continue:hover {
        background: rgba(78, 201, 176, 0.2);
    }

    .btn-debug.pause {
        color: #eab308;
    }

    .btn-debug.pause:hover {
        background: rgba(234, 179, 8, 0.2);
    }

    .btn-debug.step-over,
    .btn-debug.step-into,
    .btn-debug.step-out {
        color: #75beff;
    }

    .btn-debug.restart {
        color: #4ec9b0;
    }

    .btn-debug.stop {
        color: #f14c4c;
    }

    .btn-debug.stop:hover {
        background: rgba(241, 76, 76, 0.2);
    }
</style>
