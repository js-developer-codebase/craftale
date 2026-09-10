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
    | Terminal State
    |--------------------------------------------------------------------------
    */

    let terminalHeight = 250;


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

        unregisterWorkspace = workspacePath.subscribe((path) => {
            if (path) {
                triggerGitRefreshDebounced(200);
            }
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

            {#if $activeSidebarView === "explorer"}
                <FileExplorer />
            {:else if $activeSidebarView === "search"}
                <WorkspaceSearch />
            {:else if $activeSidebarView === "sourceControl"}
                <SourceControl />
            {/if}

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
        | Terminal
        |--------------------------------------------------------------------------
        -->

        <section
            class="terminal-area"
            class:hidden={!$isTerminalVisible}
            style={`height: ${terminalHeight}px`}
        >

            <Terminal cwd={$workspacePath ?? ""} />

        </section>

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
    | Terminal Area
    |--------------------------------------------------------------------------
    */

    .terminal-area {

        flex-shrink:
            0;

        min-height:
            150px;

        border-top:
            1px solid #333333;

        overflow:
            hidden;

    }


    .terminal-area.hidden {

        display:
            none !important;

    }

</style>