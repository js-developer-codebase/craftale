<script lang="ts">
    import {
        debugStatus,
        startDebugging,
        attachDebugging,
        stopDebugging,
        callFrames,
        selectedFrameIndex,
        selectFrame,
        scopeVariables,
        expandVariable,
        watchExpressions,
        addWatchExpression,
        removeWatchExpression,
        allBreakpoints,
        toggleBreakpoint,
        clearAllBreakpoints,
        type DebugVariable
    } from "../stores/debugger";
    import { activeFile } from "../stores/workspace";
    import { requestJump } from "../stores/navigation";
    import { openBottomPanel } from "../stores/panel";

    let launchMode = $state<"current" | "attach" | "terminal">("current");
    let attachPort = $state(9229);
    let newWatchInput = $state("");
    let isAddingWatch = $state(false);

    // Collapsible sections
    let isVariablesOpen = $state(true);
    let isWatchOpen = $state(true);
    let isCallStackOpen = $state(true);
    let isBreakpointsOpen = $state(true);

    function handleStart() {
        if (launchMode === "current") {
            void startDebugging();
        } else if (launchMode === "attach") {
            void attachDebugging("127.0.0.1", attachPort);
        } else if (launchMode === "terminal") {
            openBottomPanel("terminal");
            window.dispatchEvent(new CustomEvent("craftale:create-debug-terminal"));
        }
    }

    function submitWatch() {
        if (newWatchInput.trim()) {
            addWatchExpression(newWatchInput);
            newWatchInput = "";
            isAddingWatch = false;
        }
    }

    function jumpToBp(filePath: string, line: number) {
        requestJump(line, 1, filePath);
    }
</script>

<div class="debugger-panel">
    <!-- Header with Target Selection and Start Button -->
    <div class="panel-header">
        <span class="header-title">RUN AND DEBUG</span>

        <div class="launch-config-bar">
            <select class="config-select" bind:value={launchMode}>
                <option value="current">Current File ({$activeFile ? $activeFile.name : "None"})</option>
                <option value="attach">Attach to Process (port {attachPort})</option>
                <option value="terminal">JavaScript Debug Terminal</option>
            </select>

            {#if $debugStatus === "inactive" || $debugStatus === "stopped"}
                <button
                    type="button"
                    class="btn-start"
                    onclick={handleStart}
                    title="Start Debugging (F5)"
                >
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                        <polygon points="4,2 14,8 4,14" />
                    </svg>
                    <span>Run</span>
                </button>
            {:else}
                <button
                    type="button"
                    class="btn-stop"
                    onclick={stopDebugging}
                    title="Stop Debugging (Shift+F5)"
                >
                    <svg viewBox="0 0 16 16" width="11" height="11" fill="currentColor">
                        <rect x="2" y="2" width="12" height="12" rx="1" />
                    </svg>
                    <span>Stop</span>
                </button>
            {/if}
        </div>
    </div>

    <!-- Accordion Sections -->
    <div class="accordion-container">
        <!-- 1. VARIABLES -->
        <div class="accordion-section">
            <div
                class="accordion-header"
                role="button"
                tabindex="0"
                onclick={() => (isVariablesOpen = !isVariablesOpen)}
                onkeydown={(e) => e.key === "Enter" && (isVariablesOpen = !isVariablesOpen)}
            >
                <span class="chevron" class:expanded={isVariablesOpen}>▸</span>
                <span class="section-title">VARIABLES</span>
            </div>

            {#if isVariablesOpen}
                <div class="section-body">
                    {#if $debugStatus !== "paused"}
                        <div class="empty-hint">Not paused on breakpoint.</div>
                    {:else if $scopeVariables.size === 0}
                        <div class="empty-hint">Loading scope variables...</div>
                    {:else}
                        {#each Array.from($scopeVariables.entries()) as [scopeName, vars]}
                            <div class="scope-group">
                                <div class="scope-title">{scopeName}</div>
                                <div class="vars-list">
                                    {#each vars as variable (variable.name)}
                                        <div class="var-row">
                                            {#if variable.hasChildren}
                                                <button
                                                    type="button"
                                                    class="tree-arrow"
                                                    onclick={() => expandVariable(variable)}
                                                >
                                                    {variable.isExpanded ? "▾" : "▸"}
                                                </button>
                                            {:else}
                                                <span class="tree-spacer"></span>
                                            {/if}

                                            <span class="var-name">{variable.name}:</span>
                                            <span class="var-value" class:string={variable.type === "string"} class:number={variable.type === "number"} class:boolean={variable.type === "boolean"}>
                                                {variable.value}
                                            </span>
                                        </div>

                                        {#if variable.isExpanded && variable.children}
                                            <div class="nested-vars">
                                                {#each variable.children as child}
                                                    <div class="var-row child-row">
                                                        <span class="tree-spacer"></span>
                                                        <span class="var-name">{child.name}:</span>
                                                        <span class="var-value" class:string={child.type === "string"} class:number={child.type === "number"}>
                                                            {child.value}
                                                        </span>
                                                    </div>
                                                {/each}
                                            </div>
                                        {/if}
                                    {/each}
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>

        <!-- 2. WATCH -->
        <div class="accordion-section">
            <div class="accordion-header watch-header">
                <div
                    class="header-toggle"
                    role="button"
                    tabindex="0"
                    onclick={() => (isWatchOpen = !isWatchOpen)}
                    onkeydown={(e) => e.key === "Enter" && (isWatchOpen = !isWatchOpen)}
                >
                    <span class="chevron" class:expanded={isWatchOpen}>▸</span>
                    <span class="section-title">WATCH</span>
                </div>
                <button
                    type="button"
                    class="btn-icon-action"
                    title="Add Expression"
                    onclick={() => { isWatchOpen = true; isAddingWatch = true; }}
                >
                    +
                </button>
            </div>

            {#if isWatchOpen}
                <div class="section-body">
                    {#if isAddingWatch}
                        <div class="watch-input-row">
                            <input
                                type="text"
                                class="watch-input"
                                placeholder="Expression to watch"
                                bind:value={newWatchInput}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") submitWatch();
                                    if (e.key === "Escape") isAddingWatch = false;
                                }}
                            />
                        </div>
                    {/if}

                    {#if $watchExpressions.length === 0 && !isAddingWatch}
                        <div class="empty-hint">No watch expressions added.</div>
                    {:else}
                        {#each $watchExpressions as item (item.id)}
                            <div class="watch-row">
                                <div class="watch-expr-block">
                                    <span class="watch-expr">{item.expression}:</span>
                                    <span class="watch-val" class:error={item.error}>{item.value ?? "undefined"}</span>
                                </div>
                                <button
                                    type="button"
                                    class="btn-del-watch"
                                    title="Remove Expression"
                                    onclick={() => removeWatchExpression(item.id)}
                                >
                                    ✕
                                </button>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>

        <!-- 3. CALL STACK -->
        <div class="accordion-section">
            <div
                class="accordion-header"
                role="button"
                tabindex="0"
                onclick={() => (isCallStackOpen = !isCallStackOpen)}
                onkeydown={(e) => e.key === "Enter" && (isCallStackOpen = !isCallStackOpen)}
            >
                <span class="chevron" class:expanded={isCallStackOpen}>▸</span>
                <span class="section-title">CALL STACK</span>
                {#if $callFrames.length > 0}
                    <span class="badge">{$callFrames.length}</span>
                {/if}
            </div>

            {#if isCallStackOpen}
                <div class="section-body">
                    {#if $callFrames.length === 0}
                        <div class="empty-hint">
                            {$debugStatus === "running" ? "Running..." : "Not active."}
                        </div>
                    {:else}
                        {#each $callFrames as frame, index (frame.id)}
                            <div
                                class="frame-row"
                                class:active={index === $selectedFrameIndex}
                                role="button"
                                tabindex="0"
                                onclick={() => selectFrame(index)}
                                onkeydown={(e) => e.key === "Enter" && selectFrame(index)}
                            >
                                <span class="frame-pointer">{index === $selectedFrameIndex ? "▶" : ""}</span>
                                <div class="frame-info">
                                    <span class="frame-func">{frame.functionName}</span>
                                    <span class="frame-loc">{frame.fileName}:{frame.lineNumber}</span>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>

        <!-- 4. BREAKPOINTS -->
        <div class="accordion-section">
            <div class="accordion-header bp-header">
                <div
                    class="header-toggle"
                    role="button"
                    tabindex="0"
                    onclick={() => (isBreakpointsOpen = !isBreakpointsOpen)}
                    onkeydown={(e) => e.key === "Enter" && (isBreakpointsOpen = !isBreakpointsOpen)}
                >
                    <span class="chevron" class:expanded={isBreakpointsOpen}>▸</span>
                    <span class="section-title">BREAKPOINTS</span>
                    {#if $allBreakpoints.length > 0}
                        <span class="badge">{$allBreakpoints.length}</span>
                    {/if}
                </div>

                {#if $allBreakpoints.length > 0}
                    <button
                        type="button"
                        class="btn-icon-action"
                        title="Remove All Breakpoints"
                        onclick={clearAllBreakpoints}
                    >
                        🗑
                    </button>
                {/if}
            </div>

            {#if isBreakpointsOpen}
                <div class="section-body">
                    {#if $allBreakpoints.length === 0}
                        <div class="empty-hint">Click the editor gutter to add breakpoints.</div>
                    {:else}
                        {#each $allBreakpoints as bp (`${bp.filePath}:${bp.line}`)}
                            <div
                                class="bp-row"
                                role="button"
                                tabindex="0"
                                onclick={() => jumpToBp(bp.filePath, bp.line)}
                                onkeydown={(e) => e.key === "Enter" && jumpToBp(bp.filePath, bp.line)}
                            >
                                <input
                                    type="checkbox"
                                    checked={bp.enabled}
                                    onclick={(e) => {
                                        e.stopPropagation();
                                        toggleBreakpoint(bp.filePath, bp.line);
                                    }}
                                />
                                <span class="bp-dot">●</span>
                                <span class="bp-file" title={bp.filePath}>{bp.fileName}</span>
                                <span class="bp-line">:{bp.line}</span>
                            </div>
                        {/each}
                    {/if}
                </div>
            {/if}
        </div>
    </div>
</div>

<style>
    .debugger-panel {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        background: #252526;
        color: #cccccc;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 12px;
        overflow: hidden;
        user-select: none;
    }

    .panel-header {
        padding: 10px 14px;
        border-bottom: 1px solid #333333;
        display: flex;
        flex-direction: column;
        gap: 8px;
    }

    .header-title {
        font-size: 11px;
        font-weight: 700;
        color: #bbbbbb;
        letter-spacing: 0.5px;
    }

    .launch-config-bar {
        display: flex;
        gap: 6px;
        align-items: center;
    }

    .config-select {
        flex: 1;
        background: #3c3c3c;
        border: 1px solid #4a4a4a;
        color: #ffffff;
        font-size: 11px;
        padding: 5px 6px;
        border-radius: 3px;
        outline: none;
    }

    .btn-start, .btn-stop {
        display: flex;
        align-items: center;
        gap: 5px;
        padding: 5px 12px;
        border: none;
        border-radius: 3px;
        font-size: 11px;
        font-weight: 600;
        cursor: pointer;
        transition: background 0.15s ease;
    }

    .btn-start {
        background: #388a34;
        color: #ffffff;
    }

    .btn-start:hover {
        background: #46a341;
    }

    .btn-stop {
        background: #c53030;
        color: #ffffff;
    }

    .btn-stop:hover {
        background: #e53e3e;
    }

    /* Accordion */
    .accordion-container {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
    }

    .accordion-section {
        border-bottom: 1px solid #2d2d2d;
    }

    .accordion-header {
        display: flex;
        align-items: center;
        padding: 6px 12px;
        cursor: pointer;
        background: #252526;
        transition: background 0.1s;
    }

    .accordion-header:hover {
        background: #2a2d2e;
    }

    .watch-header, .bp-header {
        justify-content: space-between;
    }

    .header-toggle {
        display: flex;
        align-items: center;
        flex: 1;
        cursor: pointer;
    }

    .chevron {
        font-size: 10px;
        margin-right: 6px;
        color: #858585;
        transition: transform 0.1s;
        display: inline-block;
    }

    .chevron.expanded {
        transform: rotate(90deg);
    }

    .section-title {
        font-size: 11px;
        font-weight: 700;
        color: #aaaaaa;
        letter-spacing: 0.3px;
    }

    .badge {
        font-size: 10px;
        background: #383838;
        padding: 1px 6px;
        border-radius: 10px;
        margin-left: 8px;
        color: #cccccc;
    }

    .btn-icon-action {
        background: transparent;
        border: none;
        color: #858585;
        font-size: 12px;
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 3px;
    }

    .btn-icon-action:hover {
        color: #ffffff;
        background: #383838;
    }

    .section-body {
        padding: 4px 0 8px 0;
        background: #1e1e1e;
        max-height: 250px;
        overflow-y: auto;
    }

    .empty-hint {
        padding: 6px 16px;
        color: #717171;
        font-style: italic;
        font-size: 11px;
    }

    /* Variables */
    .scope-group {
        margin-bottom: 4px;
    }

    .scope-title {
        font-size: 11px;
        font-weight: 600;
        color: #4ec9b0;
        padding: 2px 14px;
        text-transform: capitalize;
    }

    .var-row {
        display: flex;
        align-items: center;
        padding: 2px 14px;
        font-family: Consolas, monospace;
        font-size: 11px;
        line-height: 18px;
    }

    .var-row:hover {
        background: #2a2d2e;
    }

    .tree-arrow {
        background: transparent;
        border: none;
        color: #858585;
        cursor: pointer;
        width: 14px;
        padding: 0;
        font-size: 10px;
    }

    .tree-spacer {
        width: 14px;
        display: inline-block;
    }

    .var-name {
        color: #9cdcfe;
        margin-right: 6px;
    }

    .var-value {
        color: #d4d4d4;
        word-break: break-all;
    }

    .var-value.string {
        color: #ce9178;
    }

    .var-value.number {
        color: #b5cea8;
    }

    .var-value.boolean {
        color: #569cd6;
    }

    .child-row {
        padding-left: 28px;
    }

    /* Watch */
    .watch-input-row {
        padding: 4px 12px;
    }

    .watch-input {
        width: 100%;
        background: #3c3c3c;
        border: 1px solid #007acc;
        color: #ffffff;
        font-size: 11px;
        padding: 3px 6px;
        border-radius: 2px;
        outline: none;
    }

    .watch-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 3px 12px;
        font-family: Consolas, monospace;
        font-size: 11px;
    }

    .watch-row:hover {
        background: #2a2d2e;
    }

    .watch-expr-block {
        display: flex;
        gap: 6px;
        overflow: hidden;
    }

    .watch-expr {
        color: #9cdcfe;
    }

    .watch-val {
        color: #ce9178;
    }

    .watch-val.error {
        color: #f48771;
    }

    .btn-del-watch {
        background: transparent;
        border: none;
        color: #858585;
        font-size: 10px;
        cursor: pointer;
    }

    .btn-del-watch:hover {
        color: #f14c4c;
    }

    /* Call Stack */
    .frame-row {
        display: flex;
        align-items: center;
        padding: 3px 10px;
        cursor: pointer;
    }

    .frame-row:hover {
        background: #2a2d2e;
    }

    .frame-row.active {
        background: #094771;
        color: #ffffff;
    }

    .frame-pointer {
        width: 14px;
        font-size: 10px;
        color: #eab308;
    }

    .frame-info {
        display: flex;
        flex-direction: column;
        overflow: hidden;
    }

    .frame-func {
        font-size: 11px;
        font-weight: 500;
        color: #e0e0e0;
    }

    .frame-loc {
        font-size: 10px;
        color: #858585;
    }

    /* Breakpoints */
    .bp-row {
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 3px 12px;
        cursor: pointer;
    }

    .bp-row:hover {
        background: #2a2d2e;
    }

    .bp-dot {
        color: #e51400;
        font-size: 12px;
    }

    .bp-file {
        font-size: 11px;
        color: #cccccc;
    }

    .bp-line {
        font-size: 11px;
        color: #858585;
    }
</style>
