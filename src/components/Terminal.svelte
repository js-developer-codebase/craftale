<script lang="ts">

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

    let command = $state("");

    let output = $state("");

    let isRunning = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Command History
    |--------------------------------------------------------------------------
    */

    let commandHistory =
        $state<string[]>([]);

    let historyIndex =
        $state(-1);


    /*
    |--------------------------------------------------------------------------
    | DOM References
    |--------------------------------------------------------------------------
    */

    let inputElement:
        HTMLInputElement | undefined =
        $state();

    let outputElement:
        HTMLDivElement | undefined =
        $state();


    /*
    |--------------------------------------------------------------------------
    | Execute Command
    |--------------------------------------------------------------------------
    */

    async function executeCommand() {

        const value =
            command.trim();


        /*
        |--------------------------------------------------------------------------
        | Empty command
        |--------------------------------------------------------------------------
        */

        if (!value) {

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Prevent multiple commands
        |--------------------------------------------------------------------------
        */

        if (isRunning) {

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Add command to history
        |--------------------------------------------------------------------------
        */

        if (
            commandHistory.length === 0 ||
            commandHistory[
                commandHistory.length - 1
            ] !== value
        ) {

            commandHistory.push(value);

        }


        historyIndex =
            commandHistory.length;


        /*
        |--------------------------------------------------------------------------
        | Show command in terminal
        |--------------------------------------------------------------------------
        */

        const prompt =
            cwd || "Craftale";


        output +=
            `PS ${prompt}> ${value}\n`;


        /*
        |--------------------------------------------------------------------------
        | Clear input
        |--------------------------------------------------------------------------
        */

        command = "";


        /*
        |--------------------------------------------------------------------------
        | Running
        |--------------------------------------------------------------------------
        */

        isRunning = true;


        scrollToBottom();


        try {

            console.log(
                "[TERMINAL] Executing:",
                value
            );


            console.log(
                "[TERMINAL] CWD:",
                cwd
            );


            /*
            |--------------------------------------------------------------------------
            | Electron IPC
            |--------------------------------------------------------------------------
            */

            const result =
                await window
                    .craftale
                    .terminal
                    .execute(
                        value,
                        cwd
                    );


            console.log(
                "[TERMINAL] Result:",
                result
            );


            console.log(
                "[TERMINAL] STDOUT:",
                result.stdout
            );


            console.log(
                "[TERMINAL] STDERR:",
                result.stderr
            );


            /*
            |--------------------------------------------------------------------------
            | STDOUT
            |--------------------------------------------------------------------------
            */

            if (
                result.stdout
            ) {

                output +=
                    result.stdout;

            }


            /*
            |--------------------------------------------------------------------------
            | STDERR
            |--------------------------------------------------------------------------
            */

            if (
                result.stderr
            ) {

                output +=
                    result.stderr;

            }


            /*
            |--------------------------------------------------------------------------
            | Exit Code
            |--------------------------------------------------------------------------
            */

            if (
                result.exitCode !== 0
            ) {

                output +=
                    `\n[Process exited with code ${result.exitCode}]\n`;

            }


            /*
            |--------------------------------------------------------------------------
            | Make sure output ends with newline
            |--------------------------------------------------------------------------
            */

            if (
                !output.endsWith("\n")
            ) {

                output += "\n";

            }

        }

        catch (error) {

            console.error(
                "[TERMINAL] Execution failed:",
                error
            );


            output +=
                `\nTerminal error: ${String(error)}\n`;

        }

        finally {

            isRunning = false;


            /*
            |--------------------------------------------------------------------------
            | Restore focus
            |--------------------------------------------------------------------------
            */

            setTimeout(() => {

                inputElement?.focus();

                scrollToBottom();

            }, 0);

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Keyboard Handler
    |--------------------------------------------------------------------------
    */

    function handleInputKeydown(
        event: KeyboardEvent
    ) {

        console.log(
            "[TERMINAL] Key:",
            event.key
        );


        /*
        |--------------------------------------------------------------------------
        | ENTER
        |--------------------------------------------------------------------------
        */

        if (
            event.key === "Enter"
        ) {

            event.preventDefault();

            event.stopPropagation();


            executeCommand();

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | ARROW UP
        |--------------------------------------------------------------------------
        */

        if (
            event.key === "ArrowUp"
        ) {

            event.preventDefault();

            navigateHistory(
                "up"
            );

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | ARROW DOWN
        |--------------------------------------------------------------------------
        */

        if (
            event.key === "ArrowDown"
        ) {

            event.preventDefault();

            navigateHistory(
                "down"
            );

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | CTRL + L
        |--------------------------------------------------------------------------
        */

        if (
            event.ctrlKey &&
            event.key.toLowerCase() === "l"
        ) {

            event.preventDefault();

            clearTerminal();

            return;

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Command History
    |--------------------------------------------------------------------------
    */

    function navigateHistory(
        direction:
            | "up"
            | "down"
    ) {

        if (
            commandHistory.length === 0
        ) {

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | UP
        |--------------------------------------------------------------------------
        */

        if (
            direction === "up"
        ) {

            if (
                historyIndex > 0
            ) {

                historyIndex--;

            }


            command =
                commandHistory[
                    historyIndex
                ] ?? "";

        }


        /*
        |--------------------------------------------------------------------------
        | DOWN
        |--------------------------------------------------------------------------
        */

        else {

            if (
                historyIndex <
                commandHistory.length
            ) {

                historyIndex++;

            }


            if (
                historyIndex >=
                commandHistory.length
            ) {

                command = "";

            }

            else {

                command =
                    commandHistory[
                        historyIndex
                    ] ?? "";

            }

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Clear Terminal
    |--------------------------------------------------------------------------
    */

    function clearTerminal() {

        output = "";

        inputElement?.focus();

    }


    /*
    |--------------------------------------------------------------------------
    | Scroll To Bottom
    |--------------------------------------------------------------------------
    */

    function scrollToBottom() {

        setTimeout(() => {

            if (
                !outputElement
            ) {

                return;

            }


            outputElement.scrollTop =
                outputElement.scrollHeight;

        }, 0);

    }

</script>


<!--
|--------------------------------------------------------------------------
| TERMINAL
|--------------------------------------------------------------------------
-->

<div class="terminal">


    <!--
    |--------------------------------------------------------------------------
    | HEADER
    |--------------------------------------------------------------------------
    -->

    <div class="terminal-header">


        <div class="terminal-title">

            <span class="terminal-icon">
                &gt;_
            </span>


            <span class="terminal-name">
                TERMINAL
            </span>


            <span class="shell">
                PowerShell
            </span>

        </div>


        <button
            type="button"
            class="clear-button"
            onclick={clearTerminal}
        >

            Clear

        </button>

    </div>


    <!--
    |--------------------------------------------------------------------------
    | OUTPUT
    |--------------------------------------------------------------------------
    -->

    <div
        class="terminal-output"
        bind:this={outputElement}
    >

        {#if output.length > 0}

            <pre>{output}</pre>

        {:else}

            <div class="welcome">

                <div class="welcome-title">

                    Craftale Terminal

                </div>


                <div class="welcome-subtitle">

                    PowerShell

                </div>

            </div>

        {/if}

    </div>


    <!--
    |--------------------------------------------------------------------------
    | INPUT
    |--------------------------------------------------------------------------
    -->

    <div class="terminal-input">


        <!-- Prompt -->

        <span class="prompt">

            PS

        </span>


        <!-- Command Input -->

        <input
            bind:this={inputElement}
            bind:value={command}

            type="text"

            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"

            placeholder="Enter command..."

            disabled={isRunning}

            onkeydown={handleInputKeydown}
        />


        <!-- Running indicator -->

        {#if isRunning}

            <span class="running">

                Running...

            </span>

        {/if}

    </div>

</div>


<style>

    /*
    |--------------------------------------------------------------------------
    | TERMINAL
    |--------------------------------------------------------------------------
    */

    .terminal {

        width: 100%;
        height: 100%;

        display: flex;
        flex-direction: column;

        overflow: hidden;

        background: #1e1e1e;

        color: #cccccc;

        font-family:
            Consolas,
            "Cascadia Code",
            "Courier New",
            monospace;

        font-size: 13px;

    }


    /*
    |--------------------------------------------------------------------------
    | HEADER
    |--------------------------------------------------------------------------
    */

    .terminal-header {

        height: 36px;
        min-height: 36px;

        display: flex;

        align-items: center;
        justify-content: space-between;

        padding: 0 10px;

        background: #252526;

        border-bottom:
            1px solid #333333;

    }


    /*
    |--------------------------------------------------------------------------
    | TITLE
    |--------------------------------------------------------------------------
    */

    .terminal-title {

        display: flex;

        align-items: center;

        gap: 8px;

        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

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


    /*
    |--------------------------------------------------------------------------
    | CLEAR BUTTON
    |--------------------------------------------------------------------------
    */

    .clear-button {

        border: none;

        outline: none;

        padding: 4px 8px;

        background: transparent;

        color: #858585;

        cursor: pointer;

        border-radius: 3px;

        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

        font-size: 11px;

    }


    .clear-button:hover {

        color: #ffffff;

        background: #3a3a3a;

    }


    /*
    |--------------------------------------------------------------------------
    | OUTPUT
    |--------------------------------------------------------------------------
    */

    .terminal-output {

        flex: 1;

        min-height: 0;

        overflow-y: auto;
        overflow-x: hidden;

        padding: 10px 12px;

        background: #1e1e1e;

    }


    /*
    |--------------------------------------------------------------------------
    | OUTPUT TEXT
    |--------------------------------------------------------------------------
    */

    .terminal-output pre {

        margin: 0;
        padding: 0;

        white-space: pre-wrap;

        word-break: break-word;

        line-height: 1.5;

        color: #d4d4d4;

        font-family:
            Consolas,
            "Cascadia Code",
            "Courier New",
            monospace;

        font-size: 13px;

    }


    /*
    |--------------------------------------------------------------------------
    | WELCOME
    |--------------------------------------------------------------------------
    */

    .welcome {

        line-height: 1.6;

    }


    .welcome-title {

        color: #cccccc;

    }


    .welcome-subtitle {

        color: #569cd6;

        font-size: 12px;

    }


    /*
    |--------------------------------------------------------------------------
    | INPUT
    |--------------------------------------------------------------------------
    */

    .terminal-input {

        height: 40px;
        min-height: 40px;

        display: flex;

        align-items: center;

        padding: 0 12px;

        background: #1e1e1e;

        border-top:
            1px solid #333333;

    }


    /*
    |--------------------------------------------------------------------------
    | PROMPT
    |--------------------------------------------------------------------------
    */

    .prompt {

        flex-shrink: 0;

        margin-right: 8px;

        color: #4ec9b0;

        font-weight: 600;

        user-select: none;

    }


    /*
    |--------------------------------------------------------------------------
    | INPUT FIELD
    |--------------------------------------------------------------------------
    */

    .terminal-input input {

        flex: 1;

        min-width: 0;

        width: 100%;
        height: 100%;

        margin: 0;
        padding: 0;

        border: none;
        outline: none;

        background: transparent;

        color: #cccccc;

        caret-color: #ffffff;

        font-family:
            Consolas,
            "Cascadia Code",
            "Courier New",
            monospace;

        font-size: 13px;

    }


    .terminal-input input::placeholder {

        color: #555555;

    }


    .terminal-input input:disabled {

        opacity: 0.6;

    }


    /*
    |--------------------------------------------------------------------------
    | RUNNING
    |--------------------------------------------------------------------------
    */

    .running {

        flex-shrink: 0;

        margin-left: 10px;

        color: #858585;

        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

        font-size: 11px;

    }


    /*
    |--------------------------------------------------------------------------
    | SCROLLBAR
    |--------------------------------------------------------------------------
    */

    .terminal-output::-webkit-scrollbar {

        width: 8px;

    }


    .terminal-output::-webkit-scrollbar-track {

        background: #1e1e1e;

    }


    .terminal-output::-webkit-scrollbar-thumb {

        background: #424242;

        border-radius: 4px;

    }


    .terminal-output::-webkit-scrollbar-thumb:hover {

        background: #555555;

    }

</style>