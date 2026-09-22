const { ipcMain } = require("electron");
const { execFile } = require("child_process");
const path = require("path");
const fs = require("fs");
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

function handleIpc(channel, handler) {
    if (ipcMain) {
        ipcMain.handle(channel, handler);
    }
}

/*
|--------------------------------------------------------------------------
| IPC: Check if Directory is Git Repository
|--------------------------------------------------------------------------
*/

handleIpc("git:is-repo", async (event, workspacePath) => {
    if (!workspacePath) return false;
    const res = await runGit(["rev-parse", "--is-inside-work-tree"], workspacePath);
    return res.success && res.stdout.trim() === "true";
});

/*
|--------------------------------------------------------------------------
| IPC: Initialize Git Repository
|--------------------------------------------------------------------------
*/

handleIpc("git:init", async (event, workspacePath) => {
    return await runGit(["init"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Get Detailed Git Status
|--------------------------------------------------------------------------
*/

function getConflictType(x, y) {
    if (x === "U" && y === "U") return "Both Modified";
    if (x === "A" && y === "A") return "Both Added";
    if (x === "D" && y === "D") return "Both Deleted";
    if (x === "U" && y === "D") return "Deleted by Them";
    if (x === "D" && y === "U") return "Deleted by Us";
    if (x === "A" && y === "U") return "Added by Us";
    if (x === "U" && y === "A") return "Added by Them";
    return "Conflict";
}

handleIpc("git:get-status", async (event, workspacePath) => {
    const defaultRepoState = {
        isMerging: false,
        isRebasing: false,
        isCherryPicking: false,
        isReverting: false,
        mergeHead: null,
        mergeBranch: null,
        rebaseOnto: null,
        rebaseHead: null
    };

    if (!workspacePath) {
        return {
            isRepo: false,
            branch: "",
            upstream: "",
            ahead: 0,
            behind: 0,
            staged: [],
            unstaged: [],
            untracked: [],
            conflicts: [],
            repoState: defaultRepoState
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
            untracked: [],
            conflicts: [],
            repoState: defaultRepoState
        };
    }

    /* Check active repo operations (merge, rebase, cherry-pick, revert) */
    const repoState = { ...defaultRepoState };
    try {
        const gitDirRes = await runGit(["rev-parse", "--git-dir"], workspacePath);
        const gitDir = gitDirRes.success
            ? path.resolve(workspacePath, gitDirRes.stdout.trim())
            : path.join(workspacePath, ".git");

        // Merge check
        const mergeHeadPath = path.join(gitDir, "MERGE_HEAD");
        if (fs.existsSync(mergeHeadPath)) {
            repoState.isMerging = true;
            try {
                repoState.mergeHead = fs.readFileSync(mergeHeadPath, "utf8").trim().slice(0, 7);
                const mergeMsgPath = path.join(gitDir, "MERGE_MSG");
                if (fs.existsSync(mergeMsgPath)) {
                    const msg = fs.readFileSync(mergeMsgPath, "utf8");
                    const branchMatch = msg.match(/Merge branch '([^']+)'/);
                    repoState.mergeBranch = branchMatch ? branchMatch[1] : null;
                }
            } catch {
                // Ignore read errors
            }
        }

        // Rebase check
        const rebaseMergePath = path.join(gitDir, "rebase-merge");
        const rebaseApplyPath = path.join(gitDir, "rebase-apply");
        if (fs.existsSync(rebaseMergePath)) {
            repoState.isRebasing = true;
            try {
                const headNamePath = path.join(rebaseMergePath, "head-name");
                if (fs.existsSync(headNamePath)) {
                    repoState.rebaseHead = fs.readFileSync(headNamePath, "utf8").trim().replace(/^refs\/heads\//, "");
                }
                const ontoPath = path.join(rebaseMergePath, "onto");
                if (fs.existsSync(ontoPath)) {
                    repoState.rebaseOnto = fs.readFileSync(ontoPath, "utf8").trim().slice(0, 7);
                }
            } catch {
                // Ignore read errors
            }
        } else if (fs.existsSync(rebaseApplyPath)) {
            repoState.isRebasing = true;
            try {
                const headNamePath = path.join(rebaseApplyPath, "head-name");
                if (fs.existsSync(headNamePath)) {
                    repoState.rebaseHead = fs.readFileSync(headNamePath, "utf8").trim().replace(/^refs\/heads\//, "");
                }
                const ontoPath = path.join(rebaseApplyPath, "onto");
                if (fs.existsSync(ontoPath)) {
                    repoState.rebaseOnto = fs.readFileSync(ontoPath, "utf8").trim().slice(0, 7);
                }
            } catch {
                // Ignore read errors
            }
        }

        // Cherry-pick check
        if (fs.existsSync(path.join(gitDir, "CHERRY_PICK_HEAD"))) {
            repoState.isCherryPicking = true;
        }

        // Revert check
        if (fs.existsSync(path.join(gitDir, "REVERT_HEAD"))) {
            repoState.isReverting = true;
        }
    } catch {
        // Ignore git dir inspect errors
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
            untracked: [],
            conflicts: [],
            repoState
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
    const conflicts = [];

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

        /* Unmerged / Conflicted files (UU, AA, DD, UD, DU, AU, UA) */
        const isConflict = x === "U" || y === "U" || (x === "A" && y === "A") || (x === "D" && y === "D");
        if (isConflict) {
            conflicts.push({
                path: fullPath,
                relativePath: relPath.replace(/\\/g, "/"),
                fileName,
                status: `${x}${y}`,
                conflictType: getConflictType(x, y)
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
        untracked,
        conflicts,
        repoState
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Stage Files
|--------------------------------------------------------------------------
*/

handleIpc("git:stage", async (event, workspacePath, filePaths) => {
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

handleIpc("git:unstage", async (event, workspacePath, filePaths) => {
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

handleIpc("git:discard", async (event, workspacePath, filePaths, isUntracked = false) => {
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

handleIpc("git:commit", async (event, workspacePath, message) => {
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

handleIpc("git:pull", async (event, workspacePath) => {
    return await runGit(["pull"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Push
|--------------------------------------------------------------------------
*/

handleIpc("git:push", async (event, workspacePath) => {
    return await runGit(["push"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Fetch
|--------------------------------------------------------------------------
*/

handleIpc("git:fetch", async (event, workspacePath) => {
    return await runGit(["fetch"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: List Branches
|--------------------------------------------------------------------------
*/

handleIpc("git:get-branches", async (event, workspacePath) => {
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

handleIpc("git:checkout", async (event, workspacePath, branchName, createNew = false) => {
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

/*
|--------------------------------------------------------------------------
| IPC: Create Branch
|--------------------------------------------------------------------------
*/

handleIpc("git:create-branch", async (event, workspacePath, branchName, checkout = true, startPoint = "HEAD") => {
    if (!workspacePath || !branchName || !branchName.trim()) {
        return { success: false, error: "Branch name is required" };
    }

    const clean = branchName.trim();
    const args = checkout
        ? ["checkout", "-b", clean, startPoint]
        : ["branch", clean, startPoint];

    return await runGit(args, workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Delete Branch
|--------------------------------------------------------------------------
*/

handleIpc("git:delete-branch", async (event, workspacePath, branchName, force = false) => {
    if (!workspacePath || !branchName || !branchName.trim()) {
        return { success: false, error: "Branch name is required" };
    }

    const flag = force ? "-D" : "-d";
    return await runGit(["branch", flag, branchName.trim()], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Rename Branch
|--------------------------------------------------------------------------
*/

handleIpc("git:rename-branch", async (event, workspacePath, oldName, newName) => {
    if (!workspacePath || !newName || !newName.trim()) {
        return { success: false, error: "New branch name is required" };
    }

    const args = oldName && oldName.trim()
        ? ["branch", "-m", oldName.trim(), newName.trim()]
        : ["branch", "-m", newName.trim()];

    return await runGit(args, workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Merge Branch
|--------------------------------------------------------------------------
*/

handleIpc("git:merge", async (event, workspacePath, branchName, options = {}) => {
    if (!workspacePath || !branchName || !branchName.trim()) {
        return { success: false, error: "Branch name is required" };
    }

    const args = ["merge", branchName.trim()];
    if (options.noFf) args.push("--no-ff");
    if (options.squash) args.push("--squash");

    const res = await runGit(args, workspacePath);
    const combinedOutput = `${res.stdout || ""} ${res.stderr || ""}`;
    const isConflict = combinedOutput.includes("CONFLICT") || combinedOutput.includes("Automatic merge failed");

    return {
        success: res.success,
        conflict: isConflict,
        stdout: res.stdout,
        stderr: res.stderr,
        error: res.error
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Abort Merge
|--------------------------------------------------------------------------
*/

handleIpc("git:abort-merge", async (event, workspacePath) => {
    if (!workspacePath) return { success: false, error: "No workspace" };
    return await runGit(["merge", "--abort"], workspacePath);
});

/*
|--------------------------------------------------------------------------
| IPC: Rebase Branch
|--------------------------------------------------------------------------
*/

handleIpc("git:rebase", async (event, workspacePath, upstreamBranch) => {
    if (!workspacePath || !upstreamBranch || !upstreamBranch.trim()) {
        return { success: false, error: "Upstream branch is required" };
    }

    const res = await runGit(["rebase", upstreamBranch.trim()], workspacePath);
    const combinedOutput = `${res.stdout || ""} ${res.stderr || ""}`;
    const isConflict = combinedOutput.includes("CONFLICT") || combinedOutput.includes("could not apply");

    return {
        success: res.success,
        conflict: isConflict,
        stdout: res.stdout,
        stderr: res.stderr,
        error: res.error
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Rebase Action (continue, abort, skip)
|--------------------------------------------------------------------------
*/

handleIpc("git:rebase-action", async (event, workspacePath, action) => {
    if (!workspacePath) return { success: false, error: "No workspace" };
    if (!["continue", "abort", "skip"].includes(action)) {
        return { success: false, error: `Invalid rebase action: ${action}` };
    }

    const res = await runGit(["rebase", `--${action}`], workspacePath);
    const combinedOutput = `${res.stdout || ""} ${res.stderr || ""}`;
    const isConflict = combinedOutput.includes("CONFLICT") || combinedOutput.includes("could not apply");

    return {
        success: res.success,
        conflict: isConflict,
        stdout: res.stdout,
        stderr: res.stderr,
        error: res.error
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Get File Content at Git Reference (HEAD, branch, or index)
|--------------------------------------------------------------------------
*/

handleIpc("git:get-file-content", async (event, workspacePath, ref, relativePath) => {
    if (!workspacePath || !relativePath) {
        return { success: false, exists: false, error: "Missing workspacePath or relativePath", content: "" };
    }

    const normRel = relativePath.replace(/\\/g, "/");
    const targetRef = ref ? `${ref}:${normRel}` : `:${normRel}`;
    const res = await runGit(["show", targetRef], workspacePath);
    if (!res.success) {
        return {
            success: false,
            exists: false,
            error: res.stderr || res.error,
            content: ""
        };
    }

    return {
        success: true,
        exists: true,
        content: res.stdout
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Compare Branches
|--------------------------------------------------------------------------
*/

handleIpc("git:compare-branches", async (event, workspacePath, baseBranch, compareBranch) => {
    if (!workspacePath || !baseBranch || !compareBranch) {
        return { success: false, error: "Base and compare branches are required", files: [] };
    }

    const res = await runGit(["diff", "--name-status", `${baseBranch}...${compareBranch}`], workspacePath);
    let stdout = res.stdout;
    if (!res.success) {
        const res2 = await runGit(["diff", "--name-status", `${baseBranch}..${compareBranch}`], workspacePath);
        if (!res2.success) {
            return { success: false, error: res2.stderr || res2.error, files: [] };
        }
        stdout = res2.stdout;
    }

    const lines = stdout.split(/\r?\n/).filter(line => line.trim().length > 0);
    const files = [];

    for (const line of lines) {
        const parts = line.split(/\t+/);
        if (parts.length < 2) continue;

        const status = parts[0].trim().toUpperCase();
        const relPath = parts[parts.length - 1].trim().replace(/^"|"$/g, "");
        const fileName = path.basename(relPath);
        const fullPath = path.resolve(workspacePath, relPath);

        files.push({
            path: fullPath,
            relativePath: relPath.replace(/\\/g, "/"),
            fileName,
            status: status[0]
        });
    }

    return {
        success: true,
        files
    };
});

/*
|--------------------------------------------------------------------------
| IPC: Apply Patch (e.g. Stage Selected Lines)
|--------------------------------------------------------------------------
*/

handleIpc("git:apply-patch", async (event, workspacePath, patchString, cached = true) => {
    if (!workspacePath || !patchString) {
        return { success: false, error: "workspacePath and patchString are required" };
    }

    const args = ["apply", "--whitespace=nowarn", "--unidiff-zero"];
    if (cached) {
        args.push("--cached");
    }
    args.push("-");

    return new Promise((resolve) => {
        try {
            const child = require("child_process").spawn("git", args, {
                cwd: workspacePath,
                windowsHide: true
            });

            let stderr = "";
            let stdout = "";

            child.stdout.on("data", (d) => { stdout += d.toString(); });
            child.stderr.on("data", (d) => { stderr += d.toString(); });

            child.on("error", (err) => {
                resolve({ success: false, error: err.message });
            });

            child.on("close", (code) => {
                if (code === 0) {
                    resolve({ success: true, stdout });
                } else {
                    resolve({ success: false, error: stderr || `git apply exited with code ${code}`, code });
                }
            });

            child.stdin.write(patchString);
            child.stdin.end();
        } catch (err) {
            resolve({ success: false, error: err.message });
        }
    });
});

/*
|--------------------------------------------------------------------------
| IPC: Get Raw Diff
|--------------------------------------------------------------------------
*/

handleIpc("git:get-raw-diff", async (event, workspacePath, relativePath, staged = false) => {
    if (!workspacePath || !relativePath) {
        return { success: false, error: "Missing parameters", diff: "" };
    }

    const normRel = relativePath.replace(/\\/g, "/");
    const args = ["diff", "--no-color", "-U3"];
    if (staged) {
        args.push("--cached");
    } else {
        args.push("HEAD");
    }
    args.push("--", normRel);

    const res = await runGit(args, workspacePath);
    return {
        success: res.success,
        diff: res.stdout || "",
        error: res.error || res.stderr
    };
});

module.exports = { runGit };
