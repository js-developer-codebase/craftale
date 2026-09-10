<script lang="ts">

    import {
        onMount,
        onDestroy,
        tick
    } from "svelte";

    import { Terminal as XTerm } from "@xterm/xterm";
    import { FitAddon } from "@xterm/addon-fit";
    import { WebLinksAddon } from "@xterm/addon-web-links";
    import "@xterm/xterm/css/xterm.css";

    import {
        isTerminalVisible
    } from "../stores/workspace";

    import {
        notify
    } from "../stores/notifications";

    import {
        formatErrorMessage
    } from "../utils/errors";


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
    | Session Interface
    |--------------------------------------------------------------------------
    */

    interface TerminalSession {
        id: number;
        terminalId: number | null;
        title: string;
        shellName: string;
        status: "initializing" | "running" | "exited";
        xtermInstance: XTerm | null;
        fitAddon: FitAddon | null;
        container: HTMLDivElement | null;
    }


    /*
    |--------------------------------------------------------------------------
    | State
    |--------------------------------------------------------------------------
    */

    let sessions =
        $state<TerminalSession[]>([]);

    let activeSessionId =
        $state<number | null>(null);

    let nextSessionNumber = 1;

    let previousCwd =
        $state("");


    /*
    |--------------------------------------------------------------------------
    | Derived: Active Session
    |--------------------------------------------------------------------------
    */

    let activeSession = $derived(
        sessions.find((s) => s.id === activeSessionId) ??
        sessions[0] ??
        null
    );


    /*
    |--------------------------------------------------------------------------
    | Cleanup Handlers
    |--------------------------------------------------------------------------
    */

    let removeDataListener: (() => void) | null = null;
    let removeExitListener: (() => void) | null = null;
    let resizeObserver: ResizeObserver | null = null;
    let resizeDebounceTimer: ReturnType<typeof setTimeout> | null = null;


    /*
    |--------------------------------------------------------------------------
    | Safe Dimensions Calculation
    |--------------------------------------------------------------------------
    */

    function getSafeDimensions(session: TerminalSession): { cols: number; rows: number } {

        if (!session.xtermInstance || !session.fitAddon) {

            return { cols: 80, rows: 24 };

        }


        try {

            const proposed =
                session.fitAddon.proposeDimensions();

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
            session.xtermInstance.cols > 0 ? session.xtermInstance.cols : 80;

        const rows =
            session.xtermInstance.rows > 0 ? session.xtermInstance.rows : 24;


        return { cols, rows };

    }


    /*
    |--------------------------------------------------------------------------
    | Create New Terminal Session
    |--------------------------------------------------------------------------
    */

    async function createNewSession(targetCwd?: string) {

        const sessionNumber = nextSessionNumber++;

        const newSession: TerminalSession = {
            id: sessionNumber,
            terminalId: null,
            title: `${sessionNumber}: PowerShell`,
            shellName: "PowerShell",
            status: "initializing",
            xtermInstance: null,
            fitAddon: null,
            container: null
        };


        sessions = [...sessions, newSession];
        activeSessionId = newSession.id;


        // Wait for Svelte to mount the container element in DOM
        await tick();


        const session = sessions.find((s) => s.id === newSession.id);

        if (!session || !session.container) {

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Initialize xterm
        |--------------------------------------------------------------------------
        */

        const xterm = new XTerm({

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


        const fitAddon = new FitAddon();

        xterm.loadAddon(fitAddon);

        xterm.loadAddon(new WebLinksAddon());

        xterm.open(session.container);


        session.xtermInstance = xterm;

        session.fitAddon = fitAddon;


        /*
        |--------------------------------------------------------------------------
        | User Keystrokes -> Send to PTY
        |--------------------------------------------------------------------------
        */

        xterm.onData((data: string) => {

            if (
                session.terminalId !== null &&
                session.status === "running" &&
                window.craftale?.terminal
            ) {

                window.craftale.terminal.write(
                    session.terminalId,
                    data
                );

            }

        });


        /*
        |--------------------------------------------------------------------------
        | Fit Dimensions & Spawn PTY
        |--------------------------------------------------------------------------
        */

        try {

            fitAddon.fit();

        } catch {

            // Container sizing

        }


        const { cols, rows } =
            getSafeDimensions(session);

        const initialDir =
            targetCwd || cwd || undefined;


        try {

            const result =
                await window.craftale.terminal.create(
                    initialDir,
                    cols,
                    rows
                );


            session.terminalId =
                result.terminalId;

            session.shellName =
                result.shell
                    .replace(".exe", "")
                    .replace(/^.*[/\\]/, "");

            session.title =
                `${session.id}: ${session.shellName}`;

            session.status =
                "running";


            // Trigger reactivity
            sessions = [...sessions];


            xterm.focus();

        } catch (error) {

            console.error(`[TERMINAL] Failed to spawn session ${session.id}:`, error);

            session.status = "exited";

            sessions = [...sessions];

            xterm.write(`\r\n\x1b[31mFailed to start terminal: ${error}\x1b[0m\r\n`);

            const formatted = formatErrorMessage(error);

            notify.error(`Failed to start terminal: ${formatted.message}`, {
                details: formatted.details
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Switch Active Terminal
    |--------------------------------------------------------------------------
    */

    async function switchSession(sessionId: number) {

        activeSessionId = sessionId;

        await tick();


        const session = sessions.find((s) => s.id === sessionId);

        if (session && session.xtermInstance && session.fitAddon) {

            setTimeout(() => {

                try {

                    session.fitAddon?.fit();

                    session.xtermInstance?.focus();

                } catch {

                    // Ignore

                }

            }, 30);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Close / Kill Specific Terminal Session
    |--------------------------------------------------------------------------
    */

    async function closeSession(sessionId: number) {

        const session = sessions.find((s) => s.id === sessionId);

        if (!session) {

            return;

        }


        if (session.terminalId !== null) {

            try {

                await window.craftale.terminal.kill(session.terminalId);

            } catch {

                // Already dead

            }

        }


        session.xtermInstance?.dispose();


        const remaining = sessions.filter((s) => s.id !== sessionId);

        sessions = remaining;


        if (activeSessionId === sessionId) {

            const next = remaining[remaining.length - 1];

            activeSessionId = next ? next.id : null;

            if (next) {

                await tick();

                setTimeout(() => {

                    next.fitAddon?.fit();

                    next.xtermInstance?.focus();

                }, 30);

            }

        }


        // If no terminals left, create a fresh one
        if (sessions.length === 0) {

            createNewSession();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Restart Active Terminal
    |--------------------------------------------------------------------------
    */

    async function restartActiveSession() {

        const current = activeSession;

        if (!current) {

            return;

        }


        if (current.terminalId !== null) {

            try {

                await window.craftale.terminal.kill(current.terminalId);

            } catch {

                // Ignore

            }

            current.terminalId = null;

        }


        current.status = "initializing";

        current.xtermInstance?.clear();

        sessions = [...sessions];


        const { cols, rows } =
            getSafeDimensions(current);


        try {

            const result =
                await window.craftale.terminal.create(
                    cwd || undefined,
                    cols,
                    rows
                );


            current.terminalId = result.terminalId;

            current.status = "running";

            sessions = [...sessions];


            current.xtermInstance?.focus();

        } catch (error) {

            current.status = "exited";

            sessions = [...sessions];

            current.xtermInstance?.write(`\r\n\x1b[31mFailed to restart terminal: ${error}\x1b[0m\r\n`);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Clear Active Terminal
    |--------------------------------------------------------------------------
    */

    function clearActiveSession() {

        activeSession?.xtermInstance?.clear();

        activeSession?.xtermInstance?.focus();

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

            const current = activeSession;

            if (!current || !current.fitAddon || !current.xtermInstance) {

                return;

            }


            try {

                current.fitAddon.fit();

                const { cols, rows } =
                    getSafeDimensions(current);


                if (
                    current.terminalId !== null &&
                    current.status === "running" &&
                    cols > 0 &&
                    rows > 0
                ) {

                    window.craftale.terminal.resize(
                        current.terminalId,
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
    | Auto-navigate active terminal when workspace folder changes
    |--------------------------------------------------------------------------
    */

    $effect(() => {

        const targetCwd = cwd;

        if (
            targetCwd &&
            targetCwd !== previousCwd
        ) {

            previousCwd = targetCwd;

            const current = activeSession;

            if (
                current &&
                current.terminalId !== null &&
                current.status === "running" &&
                window.craftale?.terminal
            ) {

                window.craftale.terminal.write(
                    current.terminalId,
                    `Set-Location -LiteralPath "${targetCwd}"\r`
                );

            }

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Auto-fit & focus when made visible via Ctrl + `
    |--------------------------------------------------------------------------
    */

    $effect(() => {

        if (
            $isTerminalVisible &&
            activeSession &&
            activeSession.xtermInstance &&
            activeSession.fitAddon
        ) {

            setTimeout(() => {

                try {

                    activeSession?.fitAddon?.fit();

                    activeSession?.xtermInstance?.focus();

                } catch {

                    // Ignore layout transitions

                }

            }, 50);

        }

    });


    /*
    |--------------------------------------------------------------------------
    | Lifecycle: Mount
    |--------------------------------------------------------------------------
    */

    onMount(() => {

        // Global IPC listeners routed to the appropriate session by terminalId
        removeDataListener =
            window.craftale.terminal.onData(
                (terminalId: number, data: string) => {

                    const session =
                        sessions.find((s) => s.terminalId === terminalId);

                    if (session && session.xtermInstance) {

                        session.xtermInstance.write(data);

                    }

                }
            );


        removeExitListener =
            window.craftale.terminal.onExit(
                (terminalId: number, exitCode: number) => {

                    const session =
                        sessions.find((s) => s.terminalId === terminalId);

                    if (session) {

                        session.status = "exited";

                        sessions = [...sessions];

                        session.xtermInstance?.write(
                            `\r\n\x1b[90m[Process exited with code ${exitCode}]\x1b[0m\r\n`
                        );

                    }

                }
            );


        // Spawn initial terminal
        createNewSession();


        // Observe body for resize
        const bodyElement =
            document.querySelector(".terminal-body");

        if (bodyElement) {

            resizeObserver = new ResizeObserver(() => {

                handleResize();

            });

            resizeObserver.observe(bodyElement);

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


        for (const session of sessions) {

            if (session.terminalId !== null) {

                window.craftale.terminal.kill(session.terminalId).catch(() => {});

            }

            session.xtermInstance?.dispose();

        }

        sessions = [];

    });

</script>


<div class="terminal">

    <!-- Header / Tab Bar -->
    <div class="terminal-header">

        <!-- Tabs List -->
        <div class="terminal-tabs" role="tablist">

            {#each sessions as session (session.id)}

                <div
                    class="terminal-tab"
                    class:active={session.id === activeSessionId}
                    onclick={() => switchSession(session.id)}
                    role="tab"
                    tabindex="0"
                    aria-selected={session.id === activeSessionId}
                    title={session.title}
                >

                    <span class="tab-icon">&gt;_</span>

                    <span class="tab-title">{session.title}</span>

                    {#if session.status === "exited"}

                        <span class="tab-badge exited" title="Process Exited">●</span>

                    {:else if session.status === "initializing"}

                        <span class="tab-badge starting" title="Starting...">◌</span>

                    {/if}

                    <button
                        type="button"
                        class="tab-close"
                        onclick={(e) => {
                            e.stopPropagation();
                            closeSession(session.id);
                        }}
                        title="Close Terminal"
                        aria-label="Close Terminal"
                    >
                        ×
                    </button>

                </div>

            {/each}

            <!-- Add Terminal Button (+) -->
            <button
                type="button"
                class="tab-add-button"
                onclick={() => createNewSession()}
                title="New Terminal"
                aria-label="New Terminal"
            >
                +
            </button>

        </div>


        <!-- Right-side Action Buttons -->
        <div class="terminal-actions">

            <!-- Clear -->
            <button
                type="button"
                class="action-button"
                onclick={clearActiveSession}
                title="Clear Terminal (Ctrl+L)"
            >
                ⌧
            </button>

            <!-- Restart -->
            <button
                type="button"
                class="action-button"
                onclick={restartActiveSession}
                title="Restart Terminal"
                disabled={activeSession?.status === "initializing"}
            >
                ↻
            </button>

            <!-- Kill Active -->
            {#if activeSession && activeSession.status === "running"}

                <button
                    type="button"
                    class="action-button kill"
                    onclick={() => activeSession && closeSession(activeSession.id)}
                    title="Kill Terminal Process"
                >
                    ✕
                </button>

            {/if}

        </div>

    </div>


    <!-- Body with Per-Session Containers -->
    <div class="terminal-body">

        {#each sessions as session (session.id)}

            <div
                class="session-container"
                class:active={session.id === activeSessionId}
                bind:this={session.container}
                onclick={() => session.xtermInstance?.focus()}
                role="region"
                aria-label={session.title}
            ></div>

        {/each}

    </div>

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
        background: #252526;
        border-bottom: 1px solid #333333;
        user-select: none;
        padding-right: 8px;
    }

    /* Tabs */
    .terminal-tabs {
        display: flex;
        align-items: center;
        height: 100%;
        overflow-x: auto;
        overflow-y: hidden;
        scrollbar-width: none;
    }

    .terminal-tabs::-webkit-scrollbar {
        display: none;
    }

    .terminal-tab {
        height: 100%;
        display: flex;
        align-items: center;
        gap: 6px;
        padding: 0 10px;
        background: #2d2d2d;
        border-right: 1px solid #252526;
        color: #969696;
        cursor: pointer;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        font-size: 11px;
        white-space: nowrap;
        max-width: 160px;
        transition: background 0.1s;
    }

    .terminal-tab:hover {
        background: #323233;
        color: #cccccc;
    }

    .terminal-tab.active {
        background: #1e1e1e;
        color: #ffffff;
        border-top: 1px solid #007acc;
    }

    .tab-icon {
        color: #4ec9b0;
        font-weight: 700;
        font-size: 10px;
        flex-shrink: 0;
    }

    .tab-title {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .tab-badge {
        font-size: 9px;
        flex-shrink: 0;
    }

    .tab-badge.exited {
        color: #f48771;
    }

    .tab-badge.starting {
        color: #e5e510;
    }

    .tab-close {
        width: 16px;
        height: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        outline: none;
        background: transparent;
        color: #858585;
        cursor: pointer;
        border-radius: 3px;
        font-size: 12px;
        padding: 0;
        margin-left: 2px;
        opacity: 0.6;
        flex-shrink: 0;
    }

    .tab-close:hover {
        background: #3a3a3a;
        color: #ffffff;
        opacity: 1;
    }

    .tab-add-button {
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
        font-size: 16px;
        padding: 0;
        margin-left: 4px;
        flex-shrink: 0;
    }

    .tab-add-button:hover {
        background: #3a3a3a;
        color: #ffffff;
    }

    /* Actions */
    .terminal-actions {
        display: flex;
        align-items: center;
        gap: 2px;
        flex-shrink: 0;
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

    /* Body & Containers */
    .terminal-body {
        flex: 1;
        min-height: 0;
        position: relative;
        overflow: hidden;
        background: #1e1e1e;
    }

    .session-container {
        width: 100%;
        height: 100%;
        display: none;
        padding: 4px 6px 0 6px;
        box-sizing: border-box;
    }

    .session-container.active {
        display: block;
    }

    .session-container :global(.xterm) {
        height: 100%;
        padding: 2px 0;
    }

    .session-container :global(.xterm-viewport) {
        overflow-y: auto !important;
        background-color: #1e1e1e !important;
    }

    .session-container :global(.xterm-viewport::-webkit-scrollbar) {
        width: 8px;
    }

    .session-container :global(.xterm-viewport::-webkit-scrollbar-track) {
        background: #1e1e1e;
    }

    .session-container :global(.xterm-viewport::-webkit-scrollbar-thumb) {
        background: #424242;
        border-radius: 4px;
    }

    .session-container :global(.xterm-viewport::-webkit-scrollbar-thumb:hover) {
        background: #555555;
    }

</style>