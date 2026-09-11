<script lang="ts">

    import {
        onMount,
        onDestroy
    } from "svelte";

    import FileExplorer
        from "./components/FileExplorer.svelte";

    import WorkspaceSearch
        from "./components/WorkspaceSearch.svelte";

    import SourceControl
        from "./components/SourceControl.svelte";

    import BranchModal
        from "./components/BranchModal.svelte";

    import ActivityBar
        from "./components/ActivityBar.svelte";

    import Editor
        from "./components/Editor.svelte";


    import Terminal
        from "./components/Terminal.svelte";

    import NotificationContainer
        from "./components/NotificationContainer.svelte";

    import ExternalChangeModal
        from "./components/ExternalChangeModal.svelte";

    import QuickOpen
        from "./components/QuickOpen.svelte";

    import FileHistorySwitcher
        from "./components/FileHistorySwitcher.svelte";

    import LspStatusBar
        from "./components/LspStatusBar.svelte";

    import ProblemsPanel
        from "./components/ProblemsPanel.svelte";

    import {
        activeBottomTab,
        isBottomPanelVisible,
        bottomPanelHeight,
        toggleBottomPanel,
        openBottomPanel,
        setBottomPanelHeight
    } from "./stores/panel";

    import {
        problemsSummary
    } from "./stores/problems";

    import {
        lspManager
    } from "./services/lsp/LspClientManager";

    import {
        notify
    } from "./stores/notifications";

    import {
        formatErrorMessage
    } from "./utils/errors";

    import {
        workspacePath,
        isTerminalVisible,
        toggleTerminal,
        openedFiles
    } from "./stores/workspace";

    import {
        openQuickOpen,
        openFileSwitcher,
        cycleFileSwitcher,
        fileSwitcherState,
        mruFiles,
        activeSidebarView,
        isSidebarVisible,
        openSidebarView,
        toggleSidebarView
    } from "./stores/navigation";

    import {
        searchQuery,
        isReplaceOpen,
        runWorkspaceSearch,
        navigateNextMatch,
        navigatePrevMatch
    } from "./stores/search";

    import {
        refreshGitStatus,
        triggerGitRefreshDebounced
    } from "./stores/git";

    import {
        registerWatcherCallback
    } from "./stores/watcher";

    import { get } from "svelte/store";


    /*
    |--------------------------------------------------------------------------
    | Bottom Panel Resizer State
    |--------------------------------------------------------------------------
    */

    let isResizingPanel = false;
    let startY = 0;
    let startHeight = 0;

    function handleResizerMouseDown(e: MouseEvent) {
        e.preventDefault();
        isResizingPanel = true;
        startY = e.clientY;
        startHeight = get(bottomPanelHeight);

        window.addEventListener("mousemove", handleResizerMouseMove);
        window.addEventListener("mouseup", handleResizerMouseUp);
    }

    function handleResizerMouseMove(e: MouseEvent) {
        if (!isResizingPanel) return;
        const delta = startY - e.clientY;
        setBottomPanelHeight(startHeight + delta);
    }

    function handleResizerMouseUp() {
        if (isResizingPanel) {
            isResizingPanel = false;
            window.removeEventListener("mousemove", handleResizerMouseMove);
            window.removeEventListener("mouseup", handleResizerMouseUp);
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Global Keydown (Ctrl+`, Ctrl+P, Ctrl+G, Ctrl+Shift+O, Ctrl+Tab)
    |--------------------------------------------------------------------------
    */

    function handleGlobalKeyDown(event: KeyboardEvent) {

        /* Toggle Terminal: Ctrl + ` */
        if (
            (event.ctrlKey || event.metaKey) &&
            (
                event.key === "`" ||
                event.key === "~" ||
                event.code === "Backquote"
            )
        ) {

            event.preventDefault();

            event.stopPropagation();

            toggleTerminal();

            return;

        }

        /* Toggle Problems: Ctrl + Shift + M */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "m"
        ) {
            event.preventDefault();
            event.stopPropagation();
            toggleBottomPanel("problems");
            return;
        }

        /* Quick Open File: Ctrl + P */
        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "p"
        ) {

            event.preventDefault();

            openQuickOpen("file");

            return;

        }

        /* Go to Line: Ctrl + G */
        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "g"
        ) {

            event.preventDefault();

            openQuickOpen("line");

            return;

        }

        /* Go to Symbol: Ctrl + Shift + O */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "o"
        ) {

            event.preventDefault();

            openQuickOpen("symbol");

            return;

        }

        /* File History Switcher: Ctrl + Tab */
        if ((event.ctrlKey || event.metaKey) && event.key === "Tab") {

            event.preventDefault();

            const isAlreadyOpen = get(fileSwitcherState).visible;

            if (isAlreadyOpen) {

                cycleFileSwitcher(event.shiftKey ? -1 : 1);

            } else {

                const allOpen = get(openedFiles);

                if (allOpen.length > 1) {

                    const openPaths = new Set(allOpen.map((f) => f.path.toLowerCase()));

                    const ordered = [
                        ...get(mruFiles).filter((p) => openPaths.has(p.toLowerCase())),
                        ...allOpen.map((f) => f.path).filter((p) => !get(mruFiles).some((m) => m.toLowerCase() === p.toLowerCase()))
                    ];

                    openFileSwitcher(ordered, event.shiftKey ? ordered.length - 1 : 1);

                }

            }

            return;

        }

        /* Search Workspace: Ctrl + Shift + F */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "f"
        ) {

            event.preventDefault();

            openSidebarView("search");

            void runWorkspaceSearch();

            return;

        }

        /* Replace in Workspace: Ctrl + Shift + H */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "h"
        ) {

            event.preventDefault();

            isReplaceOpen.set(true);

            openSidebarView("search");

            void runWorkspaceSearch();

            return;

        }

        /* Explorer: Ctrl + Shift + E */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "e"
        ) {

            event.preventDefault();

            openSidebarView("explorer");

            return;

        }

        /* Source Control: Ctrl + Shift + G */
        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "g"
        ) {

            event.preventDefault();

            openSidebarView("sourceControl");

            void refreshGitStatus();

            return;

        }

        /* Next/Prev Search Match: F4 / Shift + F4 */
        if (event.key === "F4") {

            event.preventDefault();

            if (event.shiftKey) {

                navigatePrevMatch();

            } else {

                navigateNextMatch();

            }

            return;

        }

    }



    /*
    |--------------------------------------------------------------------------
    | Global Error Handlers
    |--------------------------------------------------------------------------
    */

    function handleWindowError(event: ErrorEvent) {

        console.error("[GLOBAL ERROR]", event.error || event.message);

        const formatted = formatErrorMessage(event.error || event.message);

        notify.error(formatted.message, {
            description: "An unexpected runtime error occurred.",
            details: formatted.details
        });

    }


    function handleUnhandledRejection(event: PromiseRejectionEvent) {

        console.error("[UNHANDLED REJECTION]", event.reason);

        const formatted = formatErrorMessage(event.reason);

        notify.error(formatted.message, {
            description: "An asynchronous operation failed.",
            details: formatted.details
        });

    }


    let unregisterWatcher: (() => void) | null = null;
    let unregisterWorkspace: (() => void) | null = null;

    onMount(() => {

        window.addEventListener(
            "keydown",
            handleGlobalKeyDown,
            true
        );

        window.addEventListener(
            "error",
            handleWindowError
        );

        window.addEventListener(
            "unhandledrejection",
            handleUnhandledRejection
        );

        unregisterWatcher = registerWatcherCallback(() => {
            triggerGitRefreshDebounced();
        });

        lspManager.init(get(workspacePath));

        unregisterWorkspace = workspacePath.subscribe((path) => {
            if (path) {
                triggerGitRefreshDebounced(200);
            }
            void lspManager.setWorkspace(path);
        });

    });


    onDestroy(() => {

        window.removeEventListener(
            "keydown",
            handleGlobalKeyDown,
            true
        );

        window.removeEventListener(
            "error",
            handleWindowError
        );

        window.removeEventListener(
            "unhandledrejection",
            handleUnhandledRejection
        );

        if (unregisterWatcher) {
            unregisterWatcher();
            unregisterWatcher = null;
        }

        if (unregisterWorkspace) {
            unregisterWorkspace();
            unregisterWorkspace = null;
        }

        void lspManager.shutdownAll();

    });

</script>


<div class="app">


    <!--
    |--------------------------------------------------------------------------
    | Activity Bar
    |--------------------------------------------------------------------------
    -->

    <ActivityBar />


    <!--
    |--------------------------------------------------------------------------
    | Sidebar (Collapsible)
    |--------------------------------------------------------------------------
    -->

    {#if $isSidebarVisible}
        <aside class="sidebar">

            <div class="sidebar-view" class:hidden={$activeSidebarView !== "explorer"}>
                <FileExplorer />
            </div>

            <div class="sidebar-view" class:hidden={$activeSidebarView !== "search"}>
                <WorkspaceSearch />
            </div>

            <div class="sidebar-view" class:hidden={$activeSidebarView !== "sourceControl"}>
                <SourceControl />
            </div>

        </aside>
    {/if}


    <!--
    |--------------------------------------------------------------------------
    | Main
    |--------------------------------------------------------------------------
    -->

    <main class="main">


        <!--
        |--------------------------------------------------------------------------
        | Editor
        |--------------------------------------------------------------------------
        -->

        <section class="editor-area">

            <Editor />

        </section>


        <!--
        |--------------------------------------------------------------------------
        | Bottom Panel (Problems & Terminal)
        |--------------------------------------------------------------------------
        -->

        <section
            class="bottom-panel"
            class:hidden={!$isBottomPanelVisible}
            style={`height: ${$bottomPanelHeight}px`}
        >
            <!-- Panel Resizer -->
            <div
                class="panel-resizer"
                onmousedown={handleResizerMouseDown}
                role="separator"
                aria-orientation="horizontal"
                tabindex="-1"
                title="Drag to resize panel"
            ></div>

            <!-- Panel Header with Tabs -->
            <header class="bottom-panel-header">
                <div class="panel-tabs">
                    <button
                        type="button"
                        class="panel-tab"
                        class:active={$activeBottomTab === "problems"}
                        onclick={() => $activeBottomTab = "problems"}
                    >
                        <span>PROBLEMS</span>
                        {#if $problemsSummary.totalCount > 0}
                            <span class="tab-badge" class:has-errors={$problemsSummary.errorCount > 0}>
                                {$problemsSummary.totalCount}
                            </span>
                        {/if}
                    </button>

                    <button
                        type="button"
                        class="panel-tab"
                        class:active={$activeBottomTab === "terminal"}
                        onclick={() => $activeBottomTab = "terminal"}
                    >
                        <span>TERMINAL</span>
                    </button>
                </div>

                <div class="panel-header-actions">
                    <button
                        type="button"
                        class="btn-panel-action"
                        onclick={() => $isBottomPanelVisible = false}
                        title="Close Panel"
                    >
                        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z"/>
                        </svg>
                    </button>
                </div>
            </header>

            <!-- Panel Content Bodies -->
            <div class="bottom-panel-body">
                <div class="panel-view" class:hidden={$activeBottomTab !== "problems"}>
                    <ProblemsPanel />
                </div>
                <div class="panel-view" class:hidden={$activeBottomTab !== "terminal"}>
                    <Terminal cwd={$workspacePath ?? ""} />
                </div>
            </div>

        </section>

        <!-- Status Bar -->
        <footer class="app-status-bar">
            <div class="status-bar-left">
                {#if $workspacePath}
                    <span class="status-workspace-name">
                        {$workspacePath.split(/[\\/]/).pop()}
                    </span>
                {/if}
            </div>
            <div class="status-bar-right">
                <LspStatusBar />
            </div>
        </footer>

    </main>

    <!-- Global Toast Notifications -->
    <NotificationContainer />

    <!-- External Change Conflict Modal -->
    <ExternalChangeModal />

    <!-- Global Quick Open (Ctrl+P, Ctrl+G, Ctrl+Shift+O) -->
    <QuickOpen />

    <!-- File History Switcher (Ctrl+Tab) -->
    <FileHistorySwitcher />

    <!-- Branch Modal -->
    <BranchModal />

</div>


<style>

    /*
    |--------------------------------------------------------------------------
    | Global
    |--------------------------------------------------------------------------
    */

    :global(html),
    :global(body) {

        width:
            100%;

        height:
            100%;

        margin:
            0;

        padding:
            0;

        overflow:
            hidden;

        background:
            #1e1e1e;

    }


    :global(body) {

        font-family:
            Inter,
            system-ui,
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

    }


    :global(*) {

        box-sizing:
            border-box;

    }


    /*
    |--------------------------------------------------------------------------
    | App
    |--------------------------------------------------------------------------
    */

    .app {

        width:
            100vw;

        height:
            100vh;

        display:
            flex;

        overflow:
            hidden;

        background:
            #1e1e1e;

    }


    /*
    |--------------------------------------------------------------------------
    | Sidebar
    |--------------------------------------------------------------------------
    */

    .sidebar {

        width:
            280px;

        min-width:
            200px;

        max-width:
            500px;

        flex-shrink:
            0;

        overflow:
            hidden;

        border-right:
            1px solid #333333;

    }


    .sidebar-view {

        width: 100%;

        height: 100%;

        display: flex;

        flex-direction: column;

        overflow: hidden;

    }


    .sidebar-view.hidden {

        display: none !important;

    }


    /*
    |--------------------------------------------------------------------------
    | Main
    |--------------------------------------------------------------------------
    */

    .main {

        flex:
            1;

        min-width:
            0;

        min-height:
            0;

        height:
            100%;

        display:
            flex;

        flex-direction:
            column;

        overflow:
            hidden;

        background:
            #1e1e1e;

    }


    /*
    |--------------------------------------------------------------------------
    | Editor Area
    |--------------------------------------------------------------------------
    */

    .editor-area {

        flex:
            1;

        min-width:
            0;

        min-height:
            0;

        overflow:
            hidden;

    }


    /*
    |--------------------------------------------------------------------------
    | Bottom Panel (Problems & Terminal)
    |--------------------------------------------------------------------------
    */

    .bottom-panel {
        position: relative;
        flex-shrink: 0;
        min-height: 120px;
        max-height: 80vh;
        border-top: 1px solid #333333;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        background: #1e1e1e;
    }

    .bottom-panel.hidden {
        display: none !important;
    }

    .panel-resizer {
        position: absolute;
        top: -3px;
        left: 0;
        right: 0;
        height: 6px;
        cursor: row-resize;
        z-index: 20;
    }

    .panel-resizer:hover {
        background: rgba(0, 122, 204, 0.4);
    }

    .bottom-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        height: 28px;
        min-height: 28px;
        background: #252526;
        border-bottom: 1px solid #333333;
        padding: 0 8px;
        user-select: none;
    }

    .panel-tabs {
        display: flex;
        align-items: center;
        height: 100%;
        gap: 2px;
    }

    .panel-tab {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        height: 100%;
        padding: 0 12px;
        background: transparent;
        border: none;
        border-bottom: 2px solid transparent;
        color: #999999;
        font-size: 11px;
        font-weight: 600;
        letter-spacing: 0.5px;
        cursor: pointer;
        transition: color 0.15s ease;
    }

    .panel-tab:hover {
        color: #ffffff;
    }

    .panel-tab.active {
        color: #ffffff;
        border-bottom-color: #007acc;
    }

    .tab-badge {
        font-size: 10px;
        padding: 1px 6px;
        border-radius: 8px;
        background: #444444;
        color: #ffffff;
        font-weight: 700;
    }

    .tab-badge.has-errors {
        background: #f48771;
        color: #ffffff;
    }

    .panel-header-actions {
        display: flex;
        align-items: center;
    }

    .btn-panel-action {
        background: transparent;
        border: none;
        color: #888888;
        padding: 4px;
        border-radius: 3px;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .btn-panel-action:hover {
        color: #ffffff;
        background: rgba(255, 255, 255, 0.08);
    }

    .bottom-panel-body {
        flex: 1;
        overflow: hidden;
        position: relative;
        height: calc(100% - 28px);
    }

    .panel-view {
        width: 100%;
        height: 100%;
        overflow: hidden;
    }

    .panel-view.hidden {
        display: none !important;
    }


    /*
    |--------------------------------------------------------------------------
    | Status Bar
    |--------------------------------------------------------------------------
    */

    .app-status-bar {
        height: 22px;
        min-height: 22px;
        background: #181818;
        color: #cccccc;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0 10px;
        font-size: 11px;
        z-index: 10;
        border-top: 1px solid #2d2d2d;
    }

    .status-bar-left {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .status-workspace-name {
        font-weight: 500;
        color: #999999;
    }

    .status-bar-right {
        display: flex;
        align-items: center;
        gap: 8px;
    }

</style>