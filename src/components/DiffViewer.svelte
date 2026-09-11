<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import * as monaco from "monaco-editor";
    import {
        activeDiff,
        isInlineDiff,
        closeDiff,
        toggleInlineDiff,
        stageSelectedLines,
        discardSelectedLines,
        revertEntireFile,
        openWorkingTreeDiff
    } from "../stores/diff";
    import { stageFiles, unstageFiles } from "../stores/git";
    import { notify } from "../stores/notifications";

    let containerEl: HTMLDivElement | null = null;
    let diffEditor: monaco.editor.IStandaloneDiffEditor | null = null;
    let originalModel: monaco.editor.ITextModel | null = null;
    let modifiedModel: monaco.editor.ITextModel | null = null;

    let selectedRange = $state<{ startLine: number; endLine: number } | null>(null);
    let selectedLineCount = $derived(
        selectedRange ? Math.max(1, selectedRange.endLine - selectedRange.startLine + 1) : 0
    );
    let showDiscardConfirm = $state(false);
    let isProcessing = $state(false);

    onMount(() => {
        if (!containerEl) return;

        diffEditor = monaco.editor.createDiffEditor(containerEl, {
            theme: "vs-dark",
            automaticLayout: true,
            readOnly: false,
            originalEditable: false,
            renderSideBySide: !$isInlineDiff,
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            renderIndicators: true,
            enableSplitViewResizing: true,
            fontSize: 14,
            fontFamily: "Consolas, 'Courier New', monospace",
            diffWordWrap: "off"
        });

        // Track selections on modified (right) editor
        const modifiedEditor = diffEditor.getModifiedEditor();
        modifiedEditor.onDidChangeCursorSelection((e) => {
            const sel = e.selection;
            if (sel && !sel.isEmpty()) {
                selectedRange = {
                    startLine: Math.min(sel.startLineNumber, sel.endLineNumber),
                    endLine: Math.max(sel.startLineNumber, sel.endLineNumber)
                };
            } else {
                selectedRange = null;
            }
        });

        // Keyboard shortcuts
        diffEditor.addCommand(monaco.KeyCode.F7, () => {
            diffEditor?.goToDiff("next");
        });
        diffEditor.addCommand(monaco.KeyMod.Shift | monaco.KeyCode.F7, () => {
            diffEditor?.goToDiff("previous");
        });

        updateDiffModels();
    });

    let modelVersion = 0;
    let lastLoadedDiffKey = "";

    // Reactive update when activeDiff changes
    $effect(() => {
        const diff = $activeDiff;
        if (!diffEditor || !diff) return;

        const currentKey = `${diff.id}:${diff.originalContent.length}:${diff.modifiedContent.length}`;
        if (currentKey !== lastLoadedDiffKey) {
            lastLoadedDiffKey = currentKey;
            updateDiffModels();
        }
    });

    $effect(() => {
        const inline = $isInlineDiff;
        if (diffEditor) {
            diffEditor.updateOptions({
                renderSideBySide: !inline
            });
        }
    });

    function updateDiffModels() {
        if (!diffEditor || !$activeDiff) return;

        const diff = $activeDiff;
        lastLoadedDiffKey = `${diff.id}:${diff.originalContent.length}:${diff.modifiedContent.length}`;

        // Save old models
        const oldOrig = originalModel;
        const oldMod = modifiedModel;
        originalModel = null;
        modifiedModel = null;

        // CRITICAL: Reset the diff editor model to null FIRST
        // Otherwise Monaco throws "Error: TextModel got disposed before DiffEditorWidget model got reset"
        diffEditor.setModel(null);

        // Now safe to dispose previous models
        if (oldOrig) {
            oldOrig.dispose();
        }
        if (oldMod) {
            oldMod.dispose();
        }

        const lang = diff.language || "plaintext";
        const v = ++modelVersion;
        const origUri = monaco.Uri.parse(`craftale-diff-original://${v}/${diff.relativePath}`);
        const modUri = monaco.Uri.parse(`craftale-diff-modified://${v}/${diff.relativePath}`);

        monaco.editor.getModel(origUri)?.dispose();
        monaco.editor.getModel(modUri)?.dispose();

        originalModel = monaco.editor.createModel(
            diff.originalContent || "",
            lang,
            origUri
        );

        modifiedModel = monaco.editor.createModel(
            diff.modifiedContent || "",
            lang,
            modUri
        );

        diffEditor.setModel({
            original: originalModel,
            modified: modifiedModel
        });
    }

    onDestroy(() => {
        if (diffEditor) {
            try {
                diffEditor.setModel(null);
            } catch {
                // Ignore if already disposed
            }
            diffEditor.dispose();
            diffEditor = null;
        }
        if (originalModel) {
            originalModel.dispose();
            originalModel = null;
        }
        if (modifiedModel) {
            modifiedModel.dispose();
            modifiedModel = null;
        }
    });

    function handleNextDiff() {
        diffEditor?.goToDiff("next");
    }

    function handlePrevDiff() {
        diffEditor?.goToDiff("previous");
    }

    async function handleStageFile() {
        if (!$activeDiff || isProcessing) return;
        isProcessing = true;
        try {
            await stageFiles([$activeDiff.filePath]);
            notify.success(`Staged "${$activeDiff.fileName}"`);
            await openWorkingTreeDiff({
                path: $activeDiff.filePath,
                relativePath: $activeDiff.relativePath,
                status: $activeDiff.status
            });
        } finally {
            isProcessing = false;
        }
    }

    async function handleUnstageFile() {
        if (!$activeDiff || isProcessing) return;
        isProcessing = true;
        try {
            await unstageFiles([$activeDiff.filePath]);
            notify.success(`Unstaged "${$activeDiff.fileName}"`);
            await openWorkingTreeDiff({
                path: $activeDiff.filePath,
                relativePath: $activeDiff.relativePath,
                status: $activeDiff.status
            });
        } finally {
            isProcessing = false;
        }
    }

    async function handleStageSelected() {
        if (!$activeDiff || !selectedRange || isProcessing) return;
        isProcessing = true;
        try {
            await stageSelectedLines($activeDiff, selectedRange);
        } finally {
            isProcessing = false;
        }
    }

    async function handleDiscardSelected() {
        if (!$activeDiff || !selectedRange || isProcessing) return;
        isProcessing = true;
        try {
            await discardSelectedLines($activeDiff, selectedRange);
        } finally {
            isProcessing = false;
        }
    }

    async function handleConfirmDiscardAll() {
        if (!$activeDiff || isProcessing) return;
        isProcessing = true;
        try {
            await revertEntireFile($activeDiff);
            showDiscardConfirm = false;
        } finally {
            isProcessing = false;
        }
    }

    function getStatusBadgeClass(status: string): string {
        switch (status) {
            case "M": return "badge-m";
            case "A": return "badge-a";
            case "D": return "badge-d";
            case "?": return "badge-u";
            default: return "badge-m";
        }
    }
</script>

{#if $activeDiff}
    <div class="diff-viewer-wrapper">
        <!-- Top Toolbar -->
        <div class="diff-toolbar" role="toolbar" aria-label="Diff Viewer Controls">
            <!-- Left Info -->
            <div class="diff-info">
                <span class="diff-status-badge {getStatusBadgeClass($activeDiff.status)}">
                    {$activeDiff.status === "?" ? "U" : $activeDiff.status}
                </span>
                <span class="diff-filename" title={$activeDiff.filePath}>
                    {$activeDiff.fileName}
                </span>
                <span class="diff-comparison-tag">
                    {$activeDiff.originalLabel} ↔ {$activeDiff.modifiedLabel}
                </span>
                {#if $activeDiff.relativePath !== $activeDiff.fileName}
                    <span class="diff-relpath" title={$activeDiff.relativePath}>
                        {$activeDiff.relativePath}
                    </span>
                {/if}
            </div>

            <!-- Center: Difference Navigation & Layout Toggle -->
            <div class="diff-center-controls">
                <button
                    type="button"
                    class="diff-btn"
                    title="Previous Difference (Shift+F7)"
                    onclick={handlePrevDiff}
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 12a.5.5 0 0 0 .5-.5V5.707l2.146 2.147a.5.5 0 0 0 .708-.708l-3-3a.5.5 0 0 0-.708 0l-3 3a.5.5 0 1 0 .708.708L7.5 5.707V11.5a.5.5 0 0 0 .5.5z"/>
                    </svg>
                </button>
                <button
                    type="button"
                    class="diff-btn"
                    title="Next Difference (F7)"
                    onclick={handleNextDiff}
                >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                        <path fill-rule="evenodd" d="M8 4a.5.5 0 0 1 .5.5v5.793l2.146-2.147a.5.5 0 0 1 .708.708l-3 3a.5.5 0 0 1-.708 0l-3-3a.5.5 0 1 1 .708-.708L7.5 10.293V4.5A.5.5 0 0 1 8 4z"/>
                    </svg>
                </button>

                <div class="v-divider"></div>

                <!-- Side-by-side vs Inline toggle -->
                <button
                    type="button"
                    class="diff-btn toggle-btn"
                    class:active={$isInlineDiff}
                    title={$isInlineDiff ? "Switch to Side-by-Side (Split) Diff" : "Switch to Inline (Unified) Diff"}
                    onclick={toggleInlineDiff}
                >
                    {#if $isInlineDiff}
                        <span class="icon">☷</span>
                        <span>Inline</span>
                    {:else}
                        <span class="icon">⚏</span>
                        <span>Split</span>
                    {/if}
                </button>
            </div>

            <!-- Right Actions -->
            <div class="diff-actions">
                <!-- Selection Actions -->
                {#if selectedRange}
                    <button
                        type="button"
                        class="diff-action-btn btn-stage-lines"
                        title="Stage Selected Lines ({selectedLineCount} lines)"
                        disabled={isProcessing}
                        onclick={handleStageSelected}
                    >
                        ✓ Stage {selectedLineCount} Lines
                    </button>
                    <button
                        type="button"
                        class="diff-action-btn btn-discard-lines"
                        title="Discard Selected Lines ({selectedLineCount} lines)"
                        disabled={isProcessing}
                        onclick={handleDiscardSelected}
                    >
                        ↺ Discard Lines
                    </button>
                    <div class="v-divider"></div>
                {/if}

                <!-- Stage / Unstage File -->
                {#if $activeDiff.mode === "working-tree"}
                    {#if $activeDiff.isStaged}
                        <button
                            type="button"
                            class="diff-action-btn"
                            title="Unstage Entire File"
                            disabled={isProcessing}
                            onclick={handleUnstageFile}
                        >
                            － Unstage
                        </button>
                    {:else}
                        <button
                            type="button"
                            class="diff-action-btn btn-primary"
                            title="Stage Entire File"
                            disabled={isProcessing}
                            onclick={handleStageFile}
                        >
                            ＋ Stage
                        </button>
                    {/if}

                    <!-- Revert / Discard All Changes -->
                    <button
                        type="button"
                        class="diff-action-btn btn-danger"
                        title="Discard All Changes in File"
                        disabled={isProcessing}
                        onclick={() => (showDiscardConfirm = true)}
                    >
                        🗑 Discard File
                    </button>
                {/if}

                <button
                    type="button"
                    class="diff-btn close-btn"
                    title="Close Diff Viewer (Esc)"
                    onclick={closeDiff}
                >
                    ✕
                </button>
            </div>
        </div>

        <!-- Monaco Diff Editor Container -->
        <div class="diff-editor-container" bind:this={containerEl}></div>

        <!-- Discard Confirmation Modal -->
        {#if showDiscardConfirm}
            <div class="modal-backdrop" onclick={() => (showDiscardConfirm = false)} role="presentation">
                <div class="confirm-card" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
                    <h3>Discard Changes?</h3>
                    <p>
                        Are you sure you want to discard all changes in <strong>{$activeDiff.fileName}</strong>?
                        This will permanently revert working tree edits.
                    </p>
                    <div class="confirm-buttons">
                        <button
                            type="button"
                            class="btn btn-secondary"
                            onclick={() => (showDiscardConfirm = false)}
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            class="btn btn-danger"
                            disabled={isProcessing}
                            onclick={handleConfirmDiscardAll}
                        >
                            {isProcessing ? "Discarding..." : "Discard Changes"}
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .diff-viewer-wrapper {
        display: flex;
        flex-direction: column;
        width: 100%;
        height: 100%;
        background: #1e1e1e;
        color: #cccccc;
        position: relative;
        overflow: hidden;
    }

    .diff-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 36px;
        min-height: 36px;
        background: #252526;
        border-bottom: 1px solid #333333;
        padding: 0 12px;
        gap: 12px;
        user-select: none;
        font-size: 12px;
        z-index: 5;
    }

    .diff-info {
        display: flex;
        align-items: center;
        gap: 8px;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
    }

    .diff-status-badge {
        font-weight: 700;
        font-size: 11px;
        padding: 1px 5px;
        border-radius: 3px;
    }

    .badge-m {
        background: #e2c08d22;
        color: #e2c08d;
        border: 1px solid #e2c08d44;
    }

    .badge-a, .badge-u {
        background: #73c99122;
        color: #73c991;
        border: 1px solid #73c99144;
    }

    .badge-d {
        background: #f14c4c22;
        color: #f14c4c;
        border: 1px solid #f14c4c44;
    }

    .diff-filename {
        font-weight: 600;
        color: #ffffff;
    }

    .diff-comparison-tag {
        font-size: 11px;
        color: #888888;
        background: #1e1e1e;
        padding: 2px 6px;
        border-radius: 3px;
        border: 1px solid #3c3c3c;
    }

    .diff-relpath {
        font-size: 11px;
        color: #666666;
    }

    .diff-center-controls {
        display: flex;
        align-items: center;
        gap: 4px;
    }

    .diff-actions {
        display: flex;
        align-items: center;
        gap: 6px;
    }

    .v-divider {
        width: 1px;
        height: 18px;
        background: #3c3c3c;
        margin: 0 4px;
    }

    .diff-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        height: 24px;
        min-width: 24px;
        padding: 0 6px;
        background: transparent;
        color: #cccccc;
        border: 1px solid transparent;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        transition: all 0.15s ease;
    }

    .diff-btn:hover {
        background: #333333;
        color: #ffffff;
    }

    .toggle-btn {
        border-color: #3c3c3c;
        background: #1e1e1e;
    }

    .toggle-btn.active {
        background: #094771;
        color: #ffffff;
        border-color: #007acc;
    }

    .close-btn:hover {
        background: #e81123 !important;
        color: #ffffff;
    }

    .diff-action-btn {
        height: 24px;
        padding: 0 8px;
        background: #2d2d2d;
        color: #cccccc;
        border: 1px solid #3c3c3c;
        border-radius: 3px;
        font-size: 11px;
        cursor: pointer;
        display: inline-flex;
        align-items: center;
        gap: 4px;
        transition: all 0.15s ease;
    }

    .diff-action-btn:hover:not(:disabled) {
        background: #3c3c3c;
        color: #ffffff;
    }

    .diff-action-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-primary {
        background: #0e639c;
        color: #ffffff;
        border-color: #1177bb;
    }

    .btn-primary:hover:not(:disabled) {
        background: #1177bb;
    }

    .btn-stage-lines {
        background: #1b4b2e;
        color: #73c991;
        border-color: #2e6d46;
    }

    .btn-stage-lines:hover:not(:disabled) {
        background: #235e39;
        color: #ffffff;
    }

    .btn-discard-lines {
        background: #4a2d18;
        color: #e2c08d;
        border-color: #6d4223;
    }

    .btn-discard-lines:hover:not(:disabled) {
        background: #5d381e;
        color: #ffffff;
    }

    .btn-danger {
        background: #4b1b1b;
        color: #f14c4c;
        border-color: #6d2e2e;
    }

    .btn-danger:hover:not(:disabled) {
        background: #5e2323;
        color: #ffffff;
    }

    .diff-editor-container {
        flex: 1;
        width: 100%;
        height: calc(100% - 36px);
        overflow: hidden;
    }

    /* Modal */
    .modal-backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0, 0, 0, 0.6);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .confirm-card {
        background: #252526;
        border: 1px solid #3c3c3c;
        border-radius: 6px;
        padding: 20px;
        max-width: 440px;
        width: 90%;
        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
    }

    .confirm-card h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #ffffff;
    }

    .confirm-card p {
        margin: 0 0 20px 0;
        font-size: 13px;
        color: #cccccc;
        line-height: 1.5;
    }

    .confirm-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
    }

    .btn {
        padding: 6px 14px;
        border-radius: 4px;
        font-size: 12px;
        cursor: pointer;
        border: 1px solid transparent;
    }

    .btn-secondary {
        background: #3c3c3c;
        color: #ffffff;
    }

    .btn-secondary:hover {
        background: #4c4c4c;
    }
</style>
