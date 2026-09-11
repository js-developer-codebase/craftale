const { ipcMain } = require("electron");
const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

/*
|--------------------------------------------------------------------------
| Compiler / Build Checker IPC Module
|--------------------------------------------------------------------------
*/

function resolveBin(binRelative) {
    const candidate1 = path.resolve(__dirname, "../../", binRelative);
    if (fs.existsSync(candidate1)) return candidate1;

    try {
        const { app } = require("electron");
        if (app) {
            const candidate2 = path.resolve(app.getAppPath(), binRelative);
            if (fs.existsSync(candidate2)) return candidate2;
        }
    } catch (e) {
        // ignore
    }

    return candidate1;
}

function parseCompilerOutput(text, workspacePath) {
    const problems = [];
    const cleanText = (text || "").replace(/\u001b\[[0-9;]*[a-zA-Z]/g, "");
    const lines = cleanText.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 1. TypeScript tsc format: <file>(<line>,<col>): error TS<code>: <message>
        const tscMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*(error|warning|info)\s*(TS\d+)?:?\s*(.+)$/i);
        if (tscMatch) {
            let resolvedPath = tscMatch[1].trim();
            if (!path.isAbsolute(resolvedPath) && workspacePath) {
                resolvedPath = path.resolve(workspacePath, resolvedPath);
            }

            problems.push({
                filePath: resolvedPath,
                line: parseInt(tscMatch[2], 10),
                column: parseInt(tscMatch[3], 10),
                severity: tscMatch[4].toLowerCase() === "error" ? "error" : "warning",
                code: tscMatch[5],
                message: tscMatch[6].trim(),
                source: "tsc"
            });
            continue;
        }

        // 2. Generic compiler format: <file>:<line>:<col>: (error|warning): <message>
        const genMatch = line.match(/^(.+?):(\d+):(\d+):?\s*(?:-\s*)?(error|warning|info):\s*(.+)$/i);
        if (genMatch) {
            let resolvedPath = genMatch[1].trim();
            if (!path.isAbsolute(resolvedPath) && workspacePath) {
                resolvedPath = path.resolve(workspacePath, resolvedPath);
            }

            problems.push({
                filePath: resolvedPath,
                line: parseInt(genMatch[2], 10),
                column: parseInt(genMatch[3], 10),
                severity: genMatch[4].toLowerCase() === "error" ? "error" : "warning",
                message: genMatch[5].trim(),
                source: "compiler"
            });
            continue;
        }

        // 3. Svelte-check format:
        // Line 1: <file>:<line>:<col>
        // Line 2 (next non-empty line): (Warn|Error|Hint|Info): <message>
        const svelteMatch = line.match(/^(.+?):(\d+):(\d+)$/);
        if (svelteMatch) {
            let nextLine = "";
            let nextIdx = i + 1;
            while (nextIdx < lines.length && !lines[nextIdx].trim()) {
                nextIdx++;
            }
            if (nextIdx < lines.length) {
                nextLine = lines[nextIdx].trim();
            }

            const msgMatch = nextLine.match(/^(Warn|Error|Hint|Info):\s*(.+)$/i);
            if (msgMatch) {
                const sevMap = { warn: "warning", error: "error", hint: "hint", info: "info" };
                const rawSeverity = msgMatch[1].toLowerCase();
                const severity = sevMap[rawSeverity] || "warning";

                let resolvedPath = svelteMatch[1].trim();
                if (!path.isAbsolute(resolvedPath) && workspacePath) {
                    resolvedPath = path.resolve(workspacePath, resolvedPath);
                }

                problems.push({
                    filePath: resolvedPath,
                    line: parseInt(svelteMatch[2], 10),
                    column: parseInt(svelteMatch[3], 10),
                    severity,
                    message: msgMatch[2].trim(),
                    source: "svelte-check"
                });
                i = nextIdx;
                continue;
            }
        }
    }

    return problems;
}

async function runWorkspaceCheck(workspacePath) {
    if (!workspacePath || !fs.existsSync(workspacePath)) {
        return {
            success: false,
            error: "Workspace path not provided or does not exist",
            problems: []
        };
    }

    const svelteCheckBin = resolveBin("node_modules/svelte-check/bin/svelte-check");
    const tscBin = resolveBin("node_modules/typescript/bin/tsc");

    let binPath = null;
    let args = [];

    if (fs.existsSync(svelteCheckBin)) {
        binPath = svelteCheckBin;
        args = ["--threshold", "warning"];
    } else if (fs.existsSync(tscBin)) {
        binPath = tscBin;
        args = ["--noEmit"];
    } else {
        return {
            success: false,
            error: "Neither svelte-check nor tsc found in node_modules",
            problems: []
        };
    }

    return new Promise((resolve) => {
        let stdout = "";
        let stderr = "";

        const child = spawn(process.execPath, [binPath, ...args], {
            cwd: workspacePath,
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: "1"
            },
            windowsHide: true
        });

        child.stdout.on("data", (chunk) => {
            stdout += chunk.toString("utf8");
        });

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString("utf8");
        });

        child.on("error", (err) => {
            resolve({
                success: false,
                error: err.message,
                problems: []
            });
        });

        child.on("close", () => {
            const combinedOutput = `${stdout}\n${stderr}`;
            const problems = parseCompilerOutput(combinedOutput, workspacePath);

            resolve({
                success: true,
                problems,
                rawOutput: combinedOutput
            });
        });
    });
}

if (ipcMain) {
    ipcMain.handle("compiler:run-check", async (_event, { workspacePath }) => {
        return await runWorkspaceCheck(workspacePath);
    });
}

module.exports = {
    runWorkspaceCheck,
    parseCompilerOutput
};
