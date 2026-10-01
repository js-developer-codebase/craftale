<script lang="ts">
    import { tick } from "svelte";
    import {
        debugLogs,
        clearDebugLogs,
        evaluateRepl,
        debugStatus
    } from "../stores/debugger";

    let inputVal = $state("");
    let logsContainer: HTMLDivElement | null = $state(null);
    let history: string[] = [];
    let historyIndex = -1;

    async function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter") {
            const expr = inputVal.trim();
            if (!expr) return;

            history.push(expr);
            historyIndex = history.length;
            inputVal = "";

            await evaluateRepl(expr);
            await tick();
            scrollToBottom();
        } else if (e.key === "ArrowUp") {
            if (history.length > 0 && historyIndex > 0) {
                historyIndex--;
                inputVal = history[historyIndex];
            }
        } else if (e.key === "ArrowDown") {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                inputVal = history[historyIndex];
            } else {
                historyIndex = history.length;
                inputVal = "";
            }
        }
    }

    function scrollToBottom() {
        if (logsContainer) {
            logsContainer.scrollTop = logsContainer.scrollHeight;
        }
    }

    $effect(() => {
        const _ = $debugLogs;
        setTimeout(scrollToBottom, 20);
    });
</script>

<div class="debug-console">
    <!-- Header / Actions -->
    <div class="console-toolbar">
        <span class="toolbar-title">DEBUG CONSOLE</span>
        <button
            type="button"
            class="btn-clear"
            title="Clear Console"
            onclick={clearDebugLogs}
        >
            ⌧ Clear
        </button>
    </div>

    <!-- Log Messages Stream -->
    <div class="logs-container" bind:this={logsContainer}>
        {#if $debugLogs.length === 0}
            <div class="empty-console">
                {#if $debugStatus === "inactive"}
                    Debug console is ready. Start debugging with F5 to view process output and evaluate expressions.
                {:else}
                    Process started. Output will appear here.
                {/if}
            </div>
        {:else}
            {#each $debugLogs as log (log.id)}
                <div class="log-line" class:error={log.type === "error" || log.type === "stderr"} class:warn={log.type === "warn"} class:info={log.type === "info"} class:result={log.type === "result"}>
                    <span class="log-text">{log.text}</span>
                </div>
            {/each}
        {/if}
    </div>

    <!-- Interactive REPL Input -->
    <div class="repl-input-bar">
        <span class="prompt-symbol">&gt;</span>
        <input
            type="text"
            class="repl-input"
            placeholder={$debugStatus === "paused" ? "Evaluate on current call frame (Enter to run)" : "Evaluate expression (Enter to run)"}
            bind:value={inputVal}
            onkeydown={handleKeyDown}
        />
    </div>
</div>

<style>
    .debug-console {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #1e1e1e;
        color: #cccccc;
        font-family: Consolas, "Courier New", monospace;
        font-size: 12px;
        overflow: hidden;
    }

    .console-toolbar {
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        background: #252526;
        border-bottom: 1px solid #333333;
        user-select: none;
    }

    .toolbar-title {
        font-size: 11px;
        font-weight: 700;
        color: #999999;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .btn-clear {
        background: transparent;
        border: none;
        color: #858585;
        font-size: 11px;
        cursor: pointer;
        padding: 2px 6px;
        border-radius: 3px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }

    .btn-clear:hover {
        background: #333333;
        color: #ffffff;
    }

    .logs-container {
        flex: 1;
        overflow-y: auto;
        padding: 8px 12px;
        display: flex;
        flex-direction: column;
        gap: 3px;
    }

    .empty-console {
        color: #717171;
        font-style: italic;
        padding: 8px 0;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
    }

    .log-line {
        line-height: 18px;
        word-break: break-all;
        white-space: pre-wrap;
    }

    .log-line.error {
        color: #f48771;
    }

    .log-line.warn {
        color: #cca700;
    }

    .log-line.info {
        color: #4ec9b0;
    }

    .log-line.result {
        color: #75beff;
    }

    .repl-input-bar {
        height: 32px;
        display: flex;
        align-items: center;
        padding: 0 8px;
        border-top: 1px solid #333333;
        background: #1e1e1e;
    }

    .prompt-symbol {
        color: #007acc;
        font-weight: 700;
        margin-right: 6px;
        user-select: none;
    }

    .repl-input {
        flex: 1;
        background: transparent;
        border: none;
        outline: none;
        color: #ffffff;
        font-family: Consolas, monospace;
        font-size: 12px;
    }

    .repl-input::placeholder {
        color: #555555;
    }
</style>
