/*
|--------------------------------------------------------------------------
| Git Source Control Store
|--------------------------------------------------------------------------
| Manages Git repository status, staged/unstaged changes, commits,
| branch checkout, and remote synchronization.
|--------------------------------------------------------------------------
*/

import { writable, derived, get } from "svelte/store";
import { workspacePath, openFile } from "./workspace";
import { notify } from "./notifications";

export interface GitFileEntry {
    path: string;
    relativePath: string;
    fileName: string;
    status: string; // 'M' | 'A' | 'D' | 'R' | 'C' | '?'
}

export interface GitBranchEntry {
    fullName: string;
    name: string;
    isCurrent: boolean;
    isRemote: boolean;
}

/*
|--------------------------------------------------------------------------
| State Variables
|--------------------------------------------------------------------------
*/

export const isGitRepo = writable<boolean>(false);
export const currentBranch = writable<string>("");
export const upstreamBranch = writable<string>("");
export const aheadCount = writable<number>(0);
export const behindCount = writable<number>(0);

export const stagedFiles = writable<GitFileEntry[]>([]);
export const unstagedFiles = writable<GitFileEntry[]>([]);
export const untrackedFiles = writable<GitFileEntry[]>([]);

export const gitError = writable<string | null>(null);
export const isLoadingStatus = writable<boolean>(false);
export const isCommitting = writable<boolean>(false);
export const isSyncing = writable<boolean>(false);

export const commitMessage = writable<string>("");

export const branchList = writable<GitBranchEntry[]>([]);
export const isBranchModalOpen = writable<boolean>(false);

/*
|--------------------------------------------------------------------------
| Derived Stores
|--------------------------------------------------------------------------
*/

export const totalChangesCount = derived(
    [stagedFiles, unstagedFiles, untrackedFiles],
    ([$staged, $unstaged, $untracked]) =>
        $staged.length + $unstaged.length + $untracked.length
);

export const hasStagedChanges = derived(
    stagedFiles,
    ($staged) => $staged.length > 0
);

export const hasWorkingTreeChanges = derived(
    [unstagedFiles, untrackedFiles],
    ([$unstaged, $untracked]) => $unstaged.length > 0 || $untracked.length > 0
);

/*
|--------------------------------------------------------------------------
| Refresh Git Status
|--------------------------------------------------------------------------
*/

let refreshDebounceTimer: ReturnType<typeof setTimeout> | null = null;

export function triggerGitRefreshDebounced(delay = 400) {
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
    }
    refreshDebounceTimer = setTimeout(() => {
        void refreshGitStatus();
    }, delay);
}

export async function refreshGitStatus() {
    if (refreshDebounceTimer) {
        clearTimeout(refreshDebounceTimer);
        refreshDebounceTimer = null;
    }

    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.getStatus) {
        isGitRepo.set(false);
        currentBranch.set("");
        upstreamBranch.set("");
        aheadCount.set(0);
        behindCount.set(0);
        stagedFiles.set([]);
        unstagedFiles.set([]);
        untrackedFiles.set([]);
        gitError.set(null);
        return;
    }

    isLoadingStatus.set(true);

    try {
        const status = await window.craftale.git.getStatus(currentWorkspace);

        if (!status.isRepo) {
            isGitRepo.set(false);
            currentBranch.set("");
            upstreamBranch.set("");
            aheadCount.set(0);
            behindCount.set(0);
            stagedFiles.set([]);
            unstagedFiles.set([]);
            untrackedFiles.set([]);
            gitError.set(null);
            return;
        }

        isGitRepo.set(true);
        currentBranch.set(status.branch || "HEAD");
        upstreamBranch.set(status.upstream || "");
        aheadCount.set(status.ahead || 0);
        behindCount.set(status.behind || 0);
        stagedFiles.set(status.staged || []);
        unstagedFiles.set(status.unstaged || []);
        untrackedFiles.set(status.untracked || []);
        gitError.set(status.error || null);
    } catch (err: any) {
        console.warn("[GIT] Status fetch failed:", err);
        gitError.set(err.message || "Failed to query git status");
    } finally {
        isLoadingStatus.set(false);
    }
}

/*
|--------------------------------------------------------------------------
| Staging & Unstaging
|--------------------------------------------------------------------------
*/

export async function stageFiles(filePaths: string[] | "all") {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.stage) return;

    try {
        const res = await window.craftale.git.stage(currentWorkspace, filePaths);
        if (!res.success) {
            notify.error(`Stage failed: ${res.error || res.stderr}`);
            return;
        }
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Stage failed: ${err.message}`);
    }
}

export async function stageAll() {
    await stageFiles("all");
}

export async function unstageFiles(filePaths: string[] | "all") {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.unstage) return;

    try {
        const res = await window.craftale.git.unstage(currentWorkspace, filePaths);
        if (!res.success) {
            notify.error(`Unstage failed: ${res.error || res.stderr}`);
            return;
        }
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Unstage failed: ${err.message}`);
    }
}

export async function unstageAll() {
    await unstageFiles("all");
}

/*
|--------------------------------------------------------------------------
| Discard Changes
|--------------------------------------------------------------------------
*/

export async function discardFiles(filePaths: string[], isUntracked = false) {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.discard) return;

    try {
        const res = await window.craftale.git.discard(currentWorkspace, filePaths, isUntracked);
        if (!res.success) {
            notify.error(`Discard failed: ${res.error || res.stderr}`);
            return;
        }
        notify.info(`Discarded changes in ${filePaths.length} file(s)`, { duration: 2000 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Discard failed: ${err.message}`);
    }
}

export async function discardAllWorkingTree() {
    const unstaged = get(unstagedFiles).map((f) => f.path);
    const untracked = get(untrackedFiles).map((f) => f.path);

    if (unstaged.length > 0) {
        await discardFiles(unstaged, false);
    }
    if (untracked.length > 0) {
        await discardFiles(untracked, true);
    }
}

/*
|--------------------------------------------------------------------------
| Commit
|--------------------------------------------------------------------------
*/

export async function commitChanges() {
    const currentWorkspace = get(workspacePath);
    const msg = get(commitMessage).trim();

    if (!currentWorkspace || !window.craftale?.git?.commit) return;

    if (!msg) {
        notify.warning("Please provide a commit message before committing.");
        return;
    }

    const staged = get(stagedFiles);
    const working = get(unstagedFiles).length + get(untrackedFiles).length;

    /* Auto stage all if user commits with no staged changes */
    if (staged.length === 0 && working > 0) {
        await stageAll();
    }

    isCommitting.set(true);

    try {
        const res = await window.craftale.git.commit(currentWorkspace, msg);
        if (!res.success) {
            notify.error(`Commit failed: ${res.error || res.stderr}`);
            return;
        }

        commitMessage.set("");
        notify.success("Commit created successfully!", { duration: 2500 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Commit failed: ${err.message}`);
    } finally {
        isCommitting.set(false);
    }
}

/*
|--------------------------------------------------------------------------
| Sync: Pull, Push, Fetch
|--------------------------------------------------------------------------
*/

export async function pullChanges() {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.pull) return;

    isSyncing.set(true);

    try {
        const res = await window.craftale.git.pull(currentWorkspace);
        if (!res.success) {
            notify.error(`Pull failed: ${res.error || res.stderr}`);
            return;
        }
        notify.success("Pulled latest changes from remote.", { duration: 2500 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Pull failed: ${err.message}`);
    } finally {
        isSyncing.set(false);
    }
}

export async function pushChanges() {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.push) return;

    isSyncing.set(true);

    try {
        const res = await window.craftale.git.push(currentWorkspace);
        if (!res.success) {
            notify.error(`Push failed: ${res.error || res.stderr}`);
            return;
        }
        notify.success("Pushed commits to remote.", { duration: 2500 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Push failed: ${err.message}`);
    } finally {
        isSyncing.set(false);
    }
}

export async function fetchChanges() {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.fetch) return;

    isSyncing.set(true);

    try {
        const res = await window.craftale.git.fetch(currentWorkspace);
        if (!res.success) {
            notify.error(`Fetch failed: ${res.error || res.stderr}`);
            return;
        }
        notify.info("Fetched remote refs.", { duration: 2000 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Fetch failed: ${err.message}`);
    } finally {
        isSyncing.set(false);
    }
}

/*
|--------------------------------------------------------------------------
| Branch Management
|--------------------------------------------------------------------------
*/

export async function loadBranches() {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.getBranches) return;

    try {
        const res = await window.craftale.git.getBranches(currentWorkspace);
        if (res.success && res.branches) {
            branchList.set(res.branches);
        }
    } catch (err: any) {
        console.warn("[GIT] Failed to list branches:", err);
    }
}

export async function checkoutBranch(branchName: string, createNew = false) {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.checkout) return;

    try {
        const res = await window.craftale.git.checkout(currentWorkspace, branchName, createNew);
        if (!res.success) {
            notify.error(`Checkout failed: ${res.error || res.stderr}`);
            return;
        }
        notify.success(
            createNew
                ? `Created and switched to branch "${branchName}"`
                : `Switched to branch "${branchName}"`,
            { duration: 2500 }
        );
        isBranchModalOpen.set(false);
        await refreshGitStatus();
        await loadBranches();
    } catch (err: any) {
        notify.error(`Checkout failed: ${err.message}`);
    }
}

export function openBranchModal() {
    void loadBranches();
    isBranchModalOpen.set(true);
}

export function closeBranchModal() {
    isBranchModalOpen.set(false);
}

/*
|--------------------------------------------------------------------------
| Initialize Repository
|--------------------------------------------------------------------------
*/

export async function initRepository() {
    const currentWorkspace = get(workspacePath);
    if (!currentWorkspace || !window.craftale?.git?.init) return;

    try {
        const res = await window.craftale.git.init(currentWorkspace);
        if (!res.success) {
            notify.error(`Init failed: ${res.error || res.stderr}`);
            return;
        }
        notify.success("Initialized empty Git repository.", { duration: 3000 });
        await refreshGitStatus();
    } catch (err: any) {
        notify.error(`Init failed: ${err.message}`);
    }
}

/*
|--------------------------------------------------------------------------
| Open File in Editor
|--------------------------------------------------------------------------
*/

export async function openGitFile(entry: GitFileEntry) {
    try {
        const content = await window.craftale.filesystem.readFile(entry.path);
        openFile({
            name: entry.fileName,
            path: entry.path,
            content
        }, { preview: false });
    } catch (err: any) {
        notify.warning(`Could not open file: ${err.message}`);
    }
}

