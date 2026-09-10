const {
    ipcMain
} = require("electron");

const pty = require("node-pty");
const os = require("os");
const path = require("path");
const fs = require("fs");


/*
|--------------------------------------------------------------------------
| Terminal Manager
|--------------------------------------------------------------------------
|
| Manages persistent PTY instances.
|
*/

const terminals =
    new Map();

let nextTerminalId = 1;


/*
|--------------------------------------------------------------------------
| Initialize
|--------------------------------------------------------------------------
*/

function initialize(
    _window
) {

    // Main window reference kept for backwards compatibility if needed.

}


/*
|--------------------------------------------------------------------------
| Get Default Shell
|--------------------------------------------------------------------------
*/

function getDefaultShell() {

    if (
        process.platform === "win32"
    ) {

        const systemRoot =
            process.env.SystemRoot ||
            "C:\\Windows";

        const powershellPath =
            path.join(
                systemRoot,
                "System32",
                "WindowsPowerShell",
                "v1.0",
                "powershell.exe"
            );


        if (
            fs.existsSync(powershellPath)
        ) {

            return powershellPath;

        }


        return "powershell.exe";

    }


    return (
        process.env.SHELL ||
        "/bin/bash"
    );

}


/*
|--------------------------------------------------------------------------
| Create Terminal
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "terminal:create",

    async (
        event,
        cwd,
        cols,
        rows
    ) => {

        const terminalId =
            nextTerminalId++;

        const shell =
            getDefaultShell();


        /*
        |--------------------------------------------------------------------------
        | Validate Dimensions
        |--------------------------------------------------------------------------
        */

        const safeCols =
            typeof cols === "number" &&
            Number.isFinite(cols) &&
            cols > 0
                ? Math.floor(cols)
                : 80;

        const safeRows =
            typeof rows === "number" &&
            Number.isFinite(rows) &&
            rows > 0
                ? Math.floor(rows)
                : 24;


        /*
        |--------------------------------------------------------------------------
        | Validate Working Directory
        |--------------------------------------------------------------------------
        */

        let workingDirectory =
            cwd;

        if (
            !workingDirectory ||
            typeof workingDirectory !== "string" ||
            !fs.existsSync(workingDirectory)
        ) {

            workingDirectory =
                os.homedir();

        }


        /*
        |--------------------------------------------------------------------------
        | Shell Arguments
        |--------------------------------------------------------------------------
        */

        let shellArgs = [];

        if (
            shell.toLowerCase().includes("powershell")
        ) {

            shellArgs = [
                "-NoLogo"
            ];

        }


        /*
        |--------------------------------------------------------------------------
        | Environment
        |--------------------------------------------------------------------------
        */

        const env =
            Object.assign(
                {},
                process.env,
                {
                    TERM: "xterm-256color",
                    COLORTERM: "truecolor"
                }
            );


        console.log(
            `[TERMINAL] Spawning session ${terminalId}: ${shell} in ${workingDirectory} (${safeCols}x${safeRows})`
        );


        try {

            const ptyProcess =
                pty.spawn(
                    shell,
                    shellArgs,
                    {
                        name: "xterm-256color",
                        cols: safeCols,
                        rows: safeRows,
                        cwd: workingDirectory,
                        env: env
                    }
                );


            const sender =
                event.sender;


            /*
            |--------------------------------------------------------------------------
            | PTY Data -> Renderer
            |--------------------------------------------------------------------------
            */

            ptyProcess.onData(
                (data) => {

                    if (
                        sender &&
                        !sender.isDestroyed()
                    ) {

                        sender.send(
                            "terminal:data",
                            terminalId,
                            data
                        );

                    }

                }
            );


            /*
            |--------------------------------------------------------------------------
            | PTY Exit -> Renderer
            |--------------------------------------------------------------------------
            */

            ptyProcess.onExit(
                ({ exitCode }) => {

                    console.log(
                        `[TERMINAL] Session ${terminalId} exited with code ${exitCode}`
                    );


                    if (
                        sender &&
                        !sender.isDestroyed()
                    ) {

                        sender.send(
                            "terminal:exit",
                            terminalId,
                            exitCode
                        );

                    }


                    terminals.delete(
                        terminalId
                    );

                }
            );


            /*
            |--------------------------------------------------------------------------
            | Clean up if window closes
            |--------------------------------------------------------------------------
            */

            if (
                sender &&
                !sender.isDestroyed()
            ) {

                sender.once(
                    "destroyed",
                    () => {

                        try {

                            ptyProcess.kill();

                        } catch {

                            // Already terminated

                        }

                        terminals.delete(
                            terminalId
                        );

                    }
                );

            }


            /*
            |--------------------------------------------------------------------------
            | Store Session
            |--------------------------------------------------------------------------
            */

            terminals.set(
                terminalId,
                {
                    pty: ptyProcess,
                    shell: shell,
                    sender: sender
                }
            );


            return {
                terminalId: terminalId,
                shell: shell,
                pid: ptyProcess.pid
            };

        } catch (error) {

            console.error(
                `[TERMINAL] Failed to create session ${terminalId}:`,
                error
            );

            throw error;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Write to Terminal
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "terminal:write",

    async (
        _event,
        terminalId,
        data
    ) => {

        const terminal =
            terminals.get(
                terminalId
            );


        if (
            !terminal ||
            typeof data !== "string"
        ) {

            return false;

        }


        try {

            terminal.pty.write(
                data
            );

            return true;

        } catch (error) {

            console.error(
                `[TERMINAL] Write failed on session ${terminalId}:`,
                error
            );

            return false;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Resize Terminal
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "terminal:resize",

    async (
        _event,
        terminalId,
        cols,
        rows
    ) => {

        if (
            typeof cols !== "number" ||
            typeof rows !== "number" ||
            !Number.isFinite(cols) ||
            !Number.isFinite(rows) ||
            cols < 1 ||
            rows < 1
        ) {

            return false;

        }


        const terminal =
            terminals.get(
                terminalId
            );


        if (
            !terminal
        ) {

            return false;

        }


        try {

            terminal.pty.resize(
                Math.floor(cols),
                Math.floor(rows)
            );

            return true;

        } catch (error) {

            console.error(
                `[TERMINAL] Resize failed on session ${terminalId}:`,
                error
            );

            return false;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Kill Terminal
|--------------------------------------------------------------------------
*/

ipcMain.handle(
    "terminal:kill",

    async (
        _event,
        terminalId
    ) => {

        const terminal =
            terminals.get(
                terminalId
            );


        if (
            !terminal
        ) {

            return false;

        }


        try {

            terminal.pty.kill();

            terminals.delete(
                terminalId
            );

            return true;

        } catch (error) {

            console.error(
                `[TERMINAL] Kill failed on session ${terminalId}:`,
                error
            );

            terminals.delete(
                terminalId
            );

            return false;

        }

    }
);


/*
|--------------------------------------------------------------------------
| Kill All Sessions
|--------------------------------------------------------------------------
*/

function killAll() {

    for (
        const [id, terminal]
        of terminals
    ) {

        try {

            terminal.pty.kill();

        } catch {

            // Ignore

        }

    }

    terminals.clear();

}


module.exports = {
    initialize,
    killAll
};
