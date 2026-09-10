const { ipcMain } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const util = require("util");

const execFilePromise = util.promisify(execFile);

/*
|--------------------------------------------------------------------------
| Helper: Execute Git Command
|--------------------------------------------------------------------------
*/

async function runGit(args, cwd) {
    if (!cwd) {
        return { success: false, error: "No workspace path specified" };
    }

    try {
        const { stdout, stderr } = await execFilePromise("git", args, {
            cwd,
            windowsHide: true,
            maxBuffer: 10 * 1024 * 1024
        });

        return {
            success: true,
            stdout: (stdout || "").toString(),
            stderr: (stderr || "").toString()
        };
    } catch (err) {
        return {
            success: false,
            error: err.message,
            stderr: (err.stderr || "").toString(),
            stdout: (err.stdout || "").toString(),
            code: err.code
        };
    }
}

/*
|--------------------------------------------------------------------------
| IPC: Check if Directory is Git Repository
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:is-repo", async (event, workspacePath) => {
    if (!workspacePath) return false;
    const res = await runGit(["rev-parse", "--is-inside-work-tree"], workspacePath);
    return res.success && res.stdout.trim() === "true";
});

/*
|--------------------------------------------------------------------------
| IPC: Initialize Git Repository
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:init", async (event, workspacePath) => {
    return await runGit(["init"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Get Detailed Git Status
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:get-status", async (event, workspacePath) => {
    if (!workspacePath) {
        return {
            isRepo: false,
            branch: "",
            upstream: "",
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: []
        };
    }

    /* Check if it's a repository */
    const isRepoRes = await runGit(["rev-parse", "--is-inside-work-tree"], workspacePath);
    if (!isRepoRes.success || isRepoRes.stdout.trim() !== "true") {
        return {
            isRepo: false,
            branch: "",
            upstream: "",
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: []
        };
    }

    /* Run git status */
    const statusRes = await runGit(["status", "--porcelain=v1", "-b", "-u"], workspacePath);
    if (!statusRes.success) {
        return {
            isRepo: true,
            error: statusRes.stderr || statusRes.error,
            branch: "",
            upstream: "",
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: []
        };
    }

    const lines = statusRes.stdout.split(/\r?\n/).filter(line => line.length > 0);

    let branch = "";
    let upstream = "";
    let ahead = 0;
    let behind = 0;

    const staged = [];
    const unstaged = [];
    const untracked = [];

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        /* Header branch line: ## branch...upstream [ahead 1, behind 2] */
        if (line.startsWith("## ")) {
            const header = line.slice(3).trim();

            if (header.includes("No commits yet on ")) {
                branch = header.replace("No commits yet on ", "").trim();
            } else if (header.startsWith("HEAD (no branch)")) {
                branch = "HEAD (detached)";
            } else {
                /* e.g. main...origin/main [ahead 1, behind 2] */
                const branchPart = header.split(" ")[0];
                if (branchPart.includes("...")) {
                    const [b, u] = branchPart.split("...");
                    branch = b;
                    upstream = u;
                } else {
                    branch = branchPart;
                }

                const aheadMatch = header.match(/ahead\s+(\d+)/i);
                if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);

                const behindMatch = header.match(/behind\s+(\d+)/i);
                if (behindMatch) behind = parseInt(behindMatch[1], 10);
            }
            continue;
        }

        if (line.length < 3) continue;

        const x = line[0];
        const y = line[1];
        let relPath = line.slice(3).trim();

        /* Handle quoted paths or renames "orig -> new" */
        if (relPath.startsWith('"') && relPath.endsWith('"')) {
            relPath = relPath.slice(1, -1);
        }
        if (relPath.includes(" -> ")) {
            const parts = relPath.split(" -> ");
            relPath = parts[1].replace(/^"|"$/g, "");
        }

        const fullPath = path.resolve(workspacePath, relPath);
        const fileName = path.basename(fullPath);

        /* Untracked files */
        if (x === "?" && y === "?") {
            untracked.push({
                path: fullPath,
                relativePath: relPath.replace(/\\/g, "/"),
                fileName,
                status: "?"
            });
            continue;
        }

        /* Staged changes (X is not space or ?) */
        if (x !== " " && x !== "?") {
            staged.push({
                path: fullPath,
                relativePath: relPath.replace(/\\/g, "/"),
                fileName,
                status: x
            });
        }

        /* Unstaged working tree changes (Y is not space or ?) */
        if (y !== " " && y !== "?") {
            unstaged.push({
                path: fullPath,
                relativePath: relPath.replace(/\\/g, "/"),
                fileName,
                status: y
            });
        }
    }

    return {
        isRepo: true,
        branch,
        upstream,
        ahead,
        behind,
        staged,
        unstaged,
        untracked
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Stage Files
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:stage", async (event, workspacePath, filePaths) => {
    if (filePaths === "all") {
        return await runGit(["add", "-A"], workspacePath);
    }

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: true };
    }

    return await runGit(["add", "--", ...filePaths], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Unstage Files
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:unstage", async (event, workspacePath, filePaths) => {
    if (filePaths === "all") {
        const restoreRes = await runGit(["restore", "--staged", "."], workspacePath);
        if (!restoreRes.success) {
            return await runGit(["reset", "HEAD"], workspacePath);
        }
        return restoreRes;
    }

    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: true };
    }

    const restoreRes = await runGit(["restore", "--staged", "--", ...filePaths], workspacePath);
    if (!restoreRes.success) {
        return await runGit(["reset", "HEAD", "--", ...filePaths], workspacePath);
    }
    return restoreRes;
});

/*
|--------------------------------------------------------------------------
| IPC: Discard Changes
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:discard", async (event, workspacePath, filePaths, isUntracked = false) => {
    if (!Array.isArray(filePaths) || filePaths.length === 0) {
        return { success: true };
    }

    if (isUntracked) {
        return await runGit(["clean", "-f", "--", ...filePaths], workspacePath);
    }

    const restoreRes = await runGit(["restore", "--", ...filePaths], workspacePath);
    if (!restoreRes.success) {
        return await runGit(["checkout", "--", ...filePaths], workspacePath);
    }
    return restoreRes;
});

/*
|--------------------------------------------------------------------------
| IPC: Commit
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:commit", async (event, workspacePath, message) => {
    if (!message || !message.trim()) {
        return { success: false, error: "Commit message cannot be empty" };
    }

    return await runGit(["commit", "-m", message.trim()], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Pull
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:pull", async (event, workspacePath) => {
    return await runGit(["pull"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Push
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:push", async (event, workspacePath) => {
    return await runGit(["push"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Fetch
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:fetch", async (event, workspacePath) => {
    return await runGit(["fetch"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: List Branches
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:get-branches", async (event, workspacePath) => {
    const res = await runGit(["branch", "--list", "-a"], workspacePath);
    if (!res.success) {
        return { success: false, error: res.stderr || res.error, branches: [] };
    }

    const lines = res.stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
    const branches = [];

    for (const rawLine of lines) {
        const isCurrent = rawLine.startsWith("*");
        const cleanName = rawLine.replace(/^[* ]+/, "").trim();

        if (cleanName.includes("->")) continue; // Skip HEAD aliases like remotes/origin/HEAD -> origin/main

        const isRemote = cleanName.startsWith("remotes/");
        const displayName = isRemote ? cleanName.replace(/^remotes\/[^/]+\//, "") : cleanName;

        branches.push({
            fullName: cleanName,
            name: displayName,
            isCurrent,
            isRemote
        });
    }

    return {
        success: true,
        branches
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Checkout Branch
|--------------------------------------------------------------------------
*/

ipcMain.handle("git:checkout", async (event, workspacePath, branchName, createNew = false) => {
    if (!branchName || !branchName.trim()) {
        return { success: false, error: "Branch name is required" };
    }

    const clean = branchName.trim();
    if (createNew) {
        return await runGit(["checkout", "-b", clean], workspacePath);
    } else {
        return await runGit(["checkout", clean], workspacePath);
    }
});

module.exports = {};
