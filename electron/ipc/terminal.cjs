const {
    ipcMain,
    app
} = require("electron");

const pty = require("node-pty");
const os = require("os");
const path = require("path");
const fs = require("fs");

let debuggerManager = null;
try {
    debuggerManager = require("./debugger.cjs");
} catch {}


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


/**
 * Ensures git-completion.ps1 is available as a real physical file on disk.
 * When the app is packaged inside app.asar, external processes like powershell.exe
 * cannot read files inside the virtual asar archive directly.
 */
function getAccessibleGitCompletionScript() {
    const rawPath = path.join(__dirname, "..", "scripts", "git-completion.ps1");

    // 1. In development (not inside an asar archive):
    if (!rawPath.includes("app.asar")) {
        if (fs.existsSync(rawPath)) {
            return rawPath;
        }
    }

    // 2. If unpacked by electron-builder (app.asar.unpacked):
    const unpackedPath = rawPath.replace("app.asar", "app.asar.unpacked");
    try {
        if (fs.existsSync(unpackedPath)) {
            return unpackedPath;
        }
    } catch (_) {}

    // 3. Fallback: Extract from app.asar to app userData or temp directory
    try {
        if (fs.existsSync(rawPath)) {
            const userDataPath = app ? app.getPath("userData") : os.tmpdir();
            const targetDir = path.join(userDataPath, "scripts");
            if (!fs.existsSync(targetDir)) {
                fs.mkdirSync(targetDir, { recursive: true });
            }
            const targetPath = path.join(targetDir, "git-completion.ps1");
            const scriptContent = fs.readFileSync(rawPath, "utf8");

            if (!fs.existsSync(targetPath) || fs.readFileSync(targetPath, "utf8") !== scriptContent) {
                fs.writeFileSync(targetPath, scriptContent, "utf8");
            }
            return targetPath;
        }
    } catch (err) {
        console.error("[TERMINAL] Failed to extract git-completion.ps1:", err);
    }

    return null;
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
        rows,
        options = {}
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

            const gitCompletionScript = getAccessibleGitCompletionScript();

            const commands = [];

            if (options && options.isDebugTerminal) {
                commands.push("$env:NODE_OPTIONS = '--inspect-brk=0'");
            }

            if (gitCompletionScript) {
                const safePath = gitCompletionScript.replace(/'/g, "''");
                commands.push(`. '${safePath}'`);
            }

            if (commands.length > 0) {
                shellArgs = [
                    "-NoLogo",
                    "-NoExit",
                    "-ExecutionPolicy", "Bypass",
                    "-Command",
                    commands.join("; ")
                ];
            } else {
                shellArgs = [
                    "-NoLogo"
                ];
            }

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
                },
                (options && options.isDebugTerminal) ? {
                    NODE_OPTIONS: "--inspect-brk=0"
                } : {}
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
                        options &&
                        options.isDebugTerminal &&
                        debuggerManager
                    ) {
                        const cleanData = data.replace(/\u001b\[[0-9;?]*[a-zA-Z]/g, "");
                        const match = cleanData.match(/ws:\/\/(?:127\.0\.0\.1|localhost):\d+\/[a-zA-Z0-9-]+/);
                        if (match && sender && !sender.isDestroyed()) {
                            const wsUrl = match[0];
                            console.log(`[DEBUG TERMINAL] Detected Node inspector: ${wsUrl}`);
                            debuggerManager.sessionManager.attachWs(wsUrl, sender).catch((err) => {
                                console.error(`[DEBUG TERMINAL] Failed to attach:`, err);
                            });
                        }
                    }

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
                pid: ptyProcess.pid,
                isDebugTerminal: !!options?.isDebugTerminal
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
