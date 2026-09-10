<script lang="ts">

    import {
        onMount,
        onDestroy
    } from "svelte";

    import { Terminal as XTerm } from "@xterm/xterm";
    import { FitAddon } from "@xterm/addon-fit";
    import { WebLinksAddon } from "@xterm/addon-web-links";
    import "@xterm/xterm/css/xterm.css";


    /*
    |--------------------------------------------------------------------------
    | Props
    |--------------------------------------------------------------------------
    */

    interface Props {
        cwd?: string;
    }

    let {
        cwd = ""
    }: Props = $props();


    /*
    |--------------------------------------------------------------------------
    | Terminal State
    |--------------------------------------------------------------------------
    */

    let terminalId =
        $state<number | null>(null);

    let shellName =
        $state("PowerShell");

    let status =
        $state<"initializing" | "running" | "exited">("initializing");


    /*
    |--------------------------------------------------------------------------
    | DOM Container Reference
    |--------------------------------------------------------------------------
    */

    let terminalContainer:
        HTMLDivElement;


    /*
    |--------------------------------------------------------------------------
    | xterm Instances
    |--------------------------------------------------------------------------
    */

    let xtermInstance: XTerm | null =
        null;

    let fitAddon: FitAddon | null =
        null;


    /*
    |--------------------------------------------------------------------------
    | Event Cleanup Handlers
    |--------------------------------------------------------------------------
    */

    let removeDataListener:
        (() => void) | null = null;

    let removeExitListener:
        (() => void) | null = null;

    let resizeObserver:
        ResizeObserver | null = null;

    let resizeDebounceTimer:
        ReturnType<typeof setTimeout> | null = null;


    /*
    |--------------------------------------------------------------------------
    | Safe Dimensions Calculation
    |--------------------------------------------------------------------------
    */

    function getSafeDimensions(): { cols: number; rows: number } {

        if (!xtermInstance || !fitAddon) {

            return { cols: 80, rows: 24 };

        }


        try {

            const proposed =
                fitAddon.proposeDimensions();


            if (
                proposed &&
                proposed.cols >= 10 &&
                proposed.rows >= 3
            ) {

                return proposed;

            }

        } catch {

            // Fallback

        }


        const cols =
            xtermInstance.cols > 0 ? xtermInstance.cols : 80;

        const rows =
            xtermInstance.rows > 0 ? xtermInstance.rows : 24;


        return { cols, rows };

    }


    /*
    |--------------------------------------------------------------------------
    | Create & Start Terminal
    |--------------------------------------------------------------------------
    */

    async function startTerminal() {

        status = "initializing";


        /*
        |--------------------------------------------------------------------------
        | Initialize xterm if not already created
        |--------------------------------------------------------------------------
        */

        if (!xtermInstance) {

            xtermInstance = new XTerm({

                cursorBlink: true,

                cursorStyle: "bar",

                fontSize: 13,

                fontFamily: "Consolas, 'Cascadia Code', 'Courier New', monospace",

                lineHeight: 1.2,

                theme: {

                    background: "#1e1e1e",

                    foreground: "#cccccc",

                    cursor: "#ffffff",

                    selectionBackground: "#264f78",

                    black: "#000000",

                    red: "#cd3131",

                    green: "#0dbc79",

                    yellow: "#e5e510",

                    blue: "#2472c8",

                    magenta: "#bc3fbc",

                    cyan: "#11a8cd",

                    white: "#e5e5e5",

                    brightBlack: "#666666",

                    brightRed: "#f14c4c",

                    brightGreen: "#23d18b",

                    brightYellow: "#f5f543",

                    brightBlue: "#3b8eea",

                    brightMagenta: "#d670d6",

                    brightCyan: "#29b8db",

                    brightWhite: "#e5e5e5"

                },

                scrollback: 5000,

                allowProposedApi: true,

                convertEol: false

            });


            fitAddon = new FitAddon();

            xtermInstance.loadAddon(fitAddon);

            xtermInstance.loadAddon(new WebLinksAddon());


            xtermInstance.open(terminalContainer);


            /*
            |--------------------------------------------------------------------------
            | User Input -> Send to PTY
            |--------------------------------------------------------------------------
            */

            xtermInstance.onData((data: string) => {

                if (
                    terminalId !== null &&
                    status === "running" &&
                    window.craftale?.terminal
                ) {

                    window.craftale.terminal.write(
                        terminalId,
                        data
                    );

                }

            });

        } else {

            xtermInstance.clear();

        }


        /*
        |--------------------------------------------------------------------------
        | Fit dimensions
        |--------------------------------------------------------------------------
        */

        try {

            fitAddon?.fit();

        } catch {

            // Container may still be rendering

        }


        const { cols, rows } =
            getSafeDimensions();


        /*
        |--------------------------------------------------------------------------
        | Setup IPC listeners BEFORE spawning
        |--------------------------------------------------------------------------
        */

        removeDataListener?.();

        removeExitListener?.();


        removeDataListener =
            window.craftale.terminal.onData(
                (id: number, data: string) => {

                    if (
                        terminalId === null ||
                        id === terminalId
                    ) {

                        xtermInstance?.write(data);

                    }

                }
            );


        removeExitListener =
            window.craftale.terminal.onExit(
                (id: number, exitCode: number) => {

                    if (
                        terminalId === null ||
                        id === terminalId
                    ) {

                        status = "exited";

                        xtermInstance?.write(
                            `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`
                        );

                    }

                }
            );


        /*
        |--------------------------------------------------------------------------
        | Spawn Shell
        |--------------------------------------------------------------------------
        */

        try {

            const result =
                await window.craftale.terminal.create(
                    cwd || undefined,
                    cols,
                    rows
                );


            terminalId =
                result.terminalId;

            shellName =
                result.shell
                    .replace(".exe", "")
                    .replace(/^.*[/\\]/, "");

            status = "running";


            // Focus xterm
            xtermInstance?.focus();

        } catch (error) {

            console.error("[TERMINAL] Spawn failed:", error);

            status = "exited";

            xtermInstance?.write(
                `\r\n\x1b[31mFailed to start terminal: ${error}\x1b[0m\r\n`
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Handle Container Resize
    |--------------------------------------------------------------------------
    */

    function handleResize() {

        if (resizeDebounceTimer) {

            clearTimeout(resizeDebounceTimer);

        }


        resizeDebounceTimer = setTimeout(() => {

            if (!fitAddon || !xtermInstance) {

                return;

            }


            try {

                fitAddon.fit();

                const { cols, rows } =
                    getSafeDimensions();


                if (
                    terminalId !== null &&
                    status === "running" &&
                    cols > 0 &&
                    rows > 0
                ) {

                    window.craftale.terminal.resize(
                        terminalId,
                        cols,
                        rows
                    );

                }

            } catch {

                // Layout transition

            }

        }, 60);

    }


    /*
    |--------------------------------------------------------------------------
    | Clear Terminal
    |--------------------------------------------------------------------------
    */

    function clearTerminal() {

        xtermInstance?.clear();

        xtermInstance?.focus();

    }


    /*
    |--------------------------------------------------------------------------
    | Restart Terminal
    |--------------------------------------------------------------------------
    */

    async function restartTerminal() {

        if (terminalId !== null) {

            try {

                await window.craftale.terminal.kill(terminalId);

            } catch {

                // Ignore

            }

            terminalId = null;

        }


        await startTerminal();

    }


    /*
    |--------------------------------------------------------------------------
    | Kill Terminal
    |--------------------------------------------------------------------------
    */

    async function killTerminal() {

        if (terminalId !== null) {

            try {

                await window.craftale.terminal.kill(terminalId);

            } catch {

                // Ignore

            }

            status = "exited";

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Lifecycle: Mount
    |--------------------------------------------------------------------------
    */

    onMount(() => {

        startTerminal();


        resizeObserver = new ResizeObserver(() => {

            handleResize();

        });


        if (terminalContainer) {

            resizeObserver.observe(terminalContainer);

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Lifecycle: Destroy
    |--------------------------------------------------------------------------
    */

    onDestroy(() => {

        if (resizeDebounceTimer) {

            clearTimeout(resizeDebounceTimer);

        }


        resizeObserver?.disconnect();

        resizeObserver = null;


        removeDataListener?.();

        removeDataListener = null;


        removeExitListener?.();

        removeExitListener = null;


        if (terminalId !== null) {

            window.craftale.terminal.kill(terminalId).catch(() => {});

            terminalId = null;

        }


        xtermInstance?.dispose();

        xtermInstance = null;

    });

</script>


<div class="terminal">

    <!-- Header -->
    <div class="terminal-header">

        <div class="terminal-title">

            <span class="terminal-icon">&gt;_</span>

            <span class="terminal-name">TERMINAL</span>

            <span class="shell">{shellName}</span>

            {#if status === "exited"}

                <span class="badge exited">(exited)</span>

            {:else if status === "initializing"}

                <span class="badge starting">(starting...)</span>

            {/if}

        </div>


        <div class="terminal-actions">

            <!-- Clear -->
            <button
                type="button"
                class="action-button"
                onclick={clearTerminal}
                title="Clear Terminal (Ctrl+L)"
            >
                ⌧
            </button>

            <!-- Restart -->
            <button
                type="button"
                class="action-button"
                onclick={restartTerminal}
                title="Restart Terminal"
                disabled={status === "initializing"}
            >
                ↻
            </button>

            <!-- Kill -->
            {#if status === "running"}

                <button
                    type="button"
                    class="action-button kill"
                    onclick={killTerminal}
                    title="Kill Terminal Process"
                >
                    ✕
                </button>

            {/if}

        </div>

    </div>


    <!-- Body -->
    <div
        class="terminal-body"
        bind:this={terminalContainer}
        onclick={() => xtermInstance?.focus()}
        role="region"
        aria-label="Terminal output and input"
    ></div>

</div>


<style>

    .terminal {
        width: 100%;
        height: 100%;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        background: #1e1e1e;
        color: #cccccc;
    }

    .terminal-header {
        height: 36px;
        min-height: 36px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        background: #252526;
        border-bottom: 1px solid #333333;
        user-select: none;
    }

    .terminal-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        font-weight: 600;
    }

    .terminal-icon {
        color: #4ec9b0;
        font-weight: 700;
    }

    .terminal-name {
        color: #cccccc;
    }

    .shell {
        color: #858585;
        font-size: 10px;
        font-weight: 400;
    }

    .badge {
        font-size: 10px;
        font-weight: 400;
    }

    .badge.exited {
        color: #f48771;
    }

    .badge.starting {
        color: #e5e510;
    }

    .terminal-actions {
        display: flex;
        align-items: center;
        gap: 2px;
    }

    .action-button {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        outline: none;
        background: transparent;
        color: #858585;
        cursor: pointer;
        border-radius: 3px;
        font-size: 14px;
        padding: 0;
    }

    .action-button:hover {
        color: #ffffff;
        background: #3a3a3a;
    }

    .action-button:disabled {
        opacity: 0.4;
        cursor: not-allowed;
    }

    .action-button.kill:hover {
        color: #f48771;
        background: #3a3a3a;
    }

    .terminal-body {
        flex: 1;
        min-height: 0;
        overflow: hidden;
        padding: 4px 6px 0 6px;
        background: #1e1e1e;
    }

    .terminal-body :global(.xterm) {
        height: 100%;
        padding: 2px 0;
    }

    .terminal-body :global(.xterm-viewport) {
        overflow-y: auto !important;
        background-color: #1e1e1e !important;
    }

    .terminal-body :global(.xterm-viewport::-webkit-scrollbar) {
        width: 8px;
    }

    .terminal-body :global(.xterm-viewport::-webkit-scrollbar-track) {
        background: #1e1e1e;
    }

    .terminal-body :global(.xterm-viewport::-webkit-scrollbar-thumb) {
        background: #424242;
        border-radius: 4px;
    }

    .terminal-body :global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
        background: #555555;
    }

</style>