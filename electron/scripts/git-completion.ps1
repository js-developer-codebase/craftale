# -----------------------------------------------------------------------
# Craftale IDE – Git Tab-Completion for PowerShell
# -----------------------------------------------------------------------
# Registers an ArgumentCompleter for the `git` command so that pressing
# Tab after git subcommands autocompletes branch names, remotes, tags,
# and common subcommands.
# -----------------------------------------------------------------------

Register-ArgumentCompleter -Native -CommandName git -ScriptBlock {
    param($wordToComplete, $commandAst, $cursorPosition)

    $tokens = $commandAst.ToString().Substring(0, $cursorPosition).Trim() -split '\s+'

    # ── Subcommands that accept branch/ref names ──
    $branchCmds = @(
        'checkout', 'switch', 'merge', 'rebase', 'branch',
        'diff', 'log', 'cherry-pick', 'revert',
        'push', 'pull', 'fetch', 'reset', 'show',
        'stash', 'worktree'
    )

    $subCmd = if ($tokens.Count -ge 2) { $tokens[1] } else { $null }

    # ── No subcommand yet → complete subcommand names ──
    if (-not $subCmd -or ($tokens.Count -eq 2 -and $wordToComplete)) {
        $subCommands = @(
            'add', 'bisect', 'branch', 'checkout', 'cherry-pick',
            'clean', 'clone', 'commit', 'config', 'diff',
            'fetch', 'grep', 'init', 'log', 'merge',
            'mv', 'pull', 'push', 'rebase', 'remote',
            'reset', 'restore', 'revert', 'rm', 'show',
            'stash', 'status', 'switch', 'tag', 'worktree'
        )
        $subCommands | Where-Object { $_ -like "$wordToComplete*" } | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_, $_, 'ParameterValue', $_
            )
        }
        return
    }

    # ── Subcommand is a branch command → complete refs ──
    if ($subCmd -in $branchCmds) {

        # Skip flags (tokens starting with -)
        $completing = $wordToComplete

        # Get local branches
        try {
            $branches = git branch --no-color 2>$null |
                ForEach-Object { $_.Trim().TrimStart('* ').Trim() } |
                Where-Object { $_ -and $_ -notmatch '^\(' }
        } catch { $branches = @() }

        # Get remote branches (without remote/ prefix for checkout)
        try {
            $remoteBranches = git branch -r --no-color 2>$null |
                ForEach-Object { $_.Trim() } |
                Where-Object { $_ -and $_ -notmatch 'HEAD' } |
                ForEach-Object {
                    # e.g. origin/main → offer both origin/main and main
                    $_
                    $_ -replace '^[^/]+/', ''
                } | Select-Object -Unique
        } catch { $remoteBranches = @() }

        # Get tags
        try {
            $tags = git tag --no-color 2>$null
        } catch { $tags = @() }

        $allRefs = @($branches) + @($remoteBranches) + @($tags) |
            Select-Object -Unique |
            Where-Object { $_ -like "$completing*" }

        $allRefs | ForEach-Object {
            [System.Management.Automation.CompletionResult]::new(
                $_, $_, 'ParameterValue', $_
            )
        }
        return
    }

    # ── Default: fall back to file path completion (PowerShell default) ──
}
