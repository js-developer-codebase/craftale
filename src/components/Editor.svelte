<script lang="ts">

    import {
        onMount,
        onDestroy
    } from "svelte";

    import { get } from "svelte/store";


    import * as monaco
        from "monaco-editor";


    import ConfirmModal
        from "./ConfirmModal.svelte";

    import TabContextMenu
        from "./TabContextMenu.svelte";

    import BatchCloseModal
        from "./BatchCloseModal.svelte";

    import Breadcrumbs from "./Breadcrumbs.svelte";

    import {
        activeDocumentSymbols,
        currentEnclosingSymbol,
        recordNavigationPoint,
        stepBack,
        stepForward,
        recordFileAccess,
        openQuickOpen,
        jumpRequest,
        openSidebarView,
        type LocationEntry
    } from "../stores/navigation";

    import {
        searchQuery,
        isReplaceOpen,
        navigateNextMatch,
        navigatePrevMatch,
        runWorkspaceSearch
    } from "../stores/search";

    import {
        parseDocumentSymbols,
        findEnclosingSymbol,
        type DocumentSymbolItem
    } from "../utils/symbols";

    import {
        openedFiles,
        activeFile,
        updateFileContent,
        saveFile,
        activateFile,
        closeFile,
        toggleTerminal,
        pathsEqual,
        recentlyClosedTabs,
        popClosedTab,
        pinTab,
        unpinTab,
        promotePreviewTab,
        reorderTabs,
        closeMultipleFiles,
        openFile,
        type OpenFile
    } from "../stores/workspace";

    import {
        notify
    } from "../stores/notifications";


    /*
    |--------------------------------------------------------------------------
    | Editor Container
    |--------------------------------------------------------------------------
    */

    let editorContainer:
        HTMLDivElement;


    /*
    |--------------------------------------------------------------------------
    | Monaco Editor
    |--------------------------------------------------------------------------
    */

    let editor:
        monaco.editor.IStandaloneCodeEditor;


    /*
    |--------------------------------------------------------------------------
    | Monaco Models
    |--------------------------------------------------------------------------
    */

    const models =
        new Map<
            string,
            monaco.editor.ITextModel
        >();


    /*
    |--------------------------------------------------------------------------
    | Prevent Change During Model Switch
    |--------------------------------------------------------------------------
    */

    let switchingModel =
        false;


    /*
    |--------------------------------------------------------------------------
    | Close Single File Modal
    |--------------------------------------------------------------------------
    */

    let showCloseModal = $state(false);

    let filePendingClose = $state<string | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Batch Close Modal State
    |--------------------------------------------------------------------------
    */

    let batchCloseModal = $state<{
        visible: boolean;
        filesToClose: OpenFile[];
        dirtyFiles: OpenFile[];
    }>({
        visible: false,
        filesToClose: [],
        dirtyFiles: []
    });


    /*
    |--------------------------------------------------------------------------
    | Tab Context Menu State
    |--------------------------------------------------------------------------
    */

    let tabContextMenu = $state<{
        visible: boolean;
        x: number;
        y: number;
        targetFile: OpenFile | null;
    }>({
        visible: false,
        x: 0,
        y: 0,
        targetFile: null
    });


    /*
    |--------------------------------------------------------------------------
    | Tab Scrolling & Overflow State
    |--------------------------------------------------------------------------
    */

    let tabsContainer = $state<HTMLDivElement | null>(null);

    let canScrollLeft = $state(false);

    let canScrollRight = $state(false);

    let showMoreTabsDropdown = $state(false);


    /*
    |--------------------------------------------------------------------------
    | Tab Drag and Drop State
    |--------------------------------------------------------------------------
    */

    let draggedTabIndex = $state<number | null>(null);

    let dragOverTabIndex = $state<number | null>(null);

    let dropPlacement = $state<"before" | "after" | null>(null);


    /*
    |--------------------------------------------------------------------------
    | Normalize Path
    |--------------------------------------------------------------------------
    */

    function normalizePath(
        filePath: string
    ): string {

        return filePath
            .replace(/\\/g, "/")
            .toLowerCase();

    }


    /*
    |--------------------------------------------------------------------------
    | Monaco Language
    |--------------------------------------------------------------------------
    */

    function getLanguage(
        fileName: string
    ): string {

        const extension =
            fileName
                .split(".")
                .pop()
                ?.toLowerCase();


        switch (extension) {

            case "ts":

            case "tsx":

                return "typescript";


            case "js":

            case "jsx":

                return "javascript";


            case "json":

                return "json";


            case "css":

                return "css";


            case "html":

                return "html";


            case "svelte":

                return "html";


            case "md":

                return "markdown";


            case "xml":

                return "xml";


            case "yml":

            case "yaml":

                return "yaml";


            default:

                return "plaintext";

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Get Or Create Model
    |--------------------------------------------------------------------------
    */

    function getOrCreateModel(
        file: {
            name: string;
            path: string;
            content: string;
        }
    ) {

        const key =
            normalizePath(
                file.path
            );


        const existingModel =
            models.get(
                key
            );


        if (
            existingModel
        ) {

            return existingModel;

        }


        const uri =
            monaco.Uri.file(
                file.path
            );


        const model =
            monaco.editor.createModel(

                file.content,

                getLanguage(
                    file.name
                ),

                uri

            );


        models.set(
            key,
            model
        );


        return model;

    }


    /*
    |--------------------------------------------------------------------------
    | Show File
    |--------------------------------------------------------------------------
    */

    function showFile(
        file: {
            name: string;
            path: string;
            content: string;
        }
    ) {

        if (
            !editor
        ) {

            return;

        }


        console.log(
            "[EDITOR] Showing:",
            file.path
        );


        const model =
            getOrCreateModel(
                file
            );


        switchingModel =
            true;


        editor.setModel(
            model
        );


        switchingModel =
            false;

        recordFileAccess(file.path);

        const syms = parseDocumentSymbols(file.content, file.name);
        activeDocumentSymbols.set(syms);

        const pos = editor.getPosition();
        if (pos) {
            currentEnclosingSymbol.set(findEnclosingSymbol(syms, pos.lineNumber));
        } else {
            currentEnclosingSymbol.set(null);
        }

    }


    /*
    |--------------------------------------------------------------------------
    | Save Current File
    |--------------------------------------------------------------------------
    */

    async function saveCurrentFile() {

        if (
            !editor
        ) {

            return;

        }


        const model =
            editor.getModel();


        if (
            !model
        ) {

            return;

        }


        const path =
            $activeFile?.path ||
            model.uri.fsPath;


        const content =
            model.getValue();


        console.log(
            "[EDITOR] Saving:",
            path
        );


        /*
        |--------------------------------------------------------------------------
        | Update Store
        |--------------------------------------------------------------------------
        */

        updateFileContent(
            path,
            content
        );


        /*
        |--------------------------------------------------------------------------
        | Save
        |--------------------------------------------------------------------------
        */

        const success =
            await saveFile(
                path
            );


        const fileName =
            path.split(/[\\/]/).pop() || path;


        if (
            success
        ) {

            console.log(
                "[EDITOR] Saved successfully:",
                path
            );

            notify.success(`Saved "${fileName}"`);

        } else {

            console.error(
                "[EDITOR] Save failed:",
                path
            );

            notify.error(`Failed to save "${fileName}"`, {
                description: "Could not write file to disk. It may be locked, read-only, or deleted.",
                actions: [
                    {
                        label: "Retry",
                        primary: true,
                        onClick: () => {
                            void saveCurrentFile();
                        }
                    }
                ]
            });

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Keyboard Shortcuts & Chord Handling
    |--------------------------------------------------------------------------
    */

    let pendingChordK = false;

    let chordTimeout: ReturnType<typeof setTimeout> | null = null;


    function handleKeyDown(
        event: KeyboardEvent
    ) {

        /* Handle Chord K (Ctrl+K W, Ctrl+K U) */

        if (pendingChordK) {

            if (event.key.toLowerCase() === "w") {

                event.preventDefault();

                pendingChordK = false;

                if (chordTimeout) clearTimeout(chordTimeout);

                handleCloseAll();

                return;

            } else if (event.key.toLowerCase() === "u") {

                event.preventDefault();

                pendingChordK = false;

                if (chordTimeout) clearTimeout(chordTimeout);

                handleCloseSaved();

                return;

            } else if (event.key !== "Control" && event.key !== "Meta") {

                pendingChordK = false;

                if (chordTimeout) clearTimeout(chordTimeout);

            }

        }


        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {

            pendingChordK = true;

            if (chordTimeout) clearTimeout(chordTimeout);

            chordTimeout = setTimeout(() => {

                pendingChordK = false;

            }, 1500);

            return;

        }


        /* Ctrl + S Save */

        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "s"
        ) {

            event.preventDefault();

            void saveCurrentFile();

            return;

        }


        /* Ctrl + W Close Active Tab */

        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "w"
        ) {

            event.preventDefault();

            closeActiveTab();

            return;

        }


        /* Ctrl + Shift + T Reopen Closed Tab */

        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "t"
        ) {

            event.preventDefault();

            void reopenLastClosedTab();

            return;

        }


        /* Ctrl + P Quick Open File */

        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "p"
        ) {

            event.preventDefault();

            openQuickOpen("file");

            return;

        }


        /* Ctrl + G Go to Line */

        if (
            (event.ctrlKey || event.metaKey) &&
            !event.shiftKey &&
            event.key.toLowerCase() === "g"
        ) {

            event.preventDefault();

            openQuickOpen("line");

            return;

        }


        /* Ctrl + Shift + O Go to Symbol */

        if (
            (event.ctrlKey || event.metaKey) &&
            event.shiftKey &&
            event.key.toLowerCase() === "o"
        ) {

            event.preventDefault();

            openQuickOpen("symbol");

            return;

        }


        /* Alt + LeftArrow Navigate Back */

        if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowLeft") {

            event.preventDefault();

            handleNavigateBack();

            return;

        }


        /* Alt + RightArrow Navigate Forward */

        if (event.altKey && !event.ctrlKey && !event.metaKey && event.key === "ArrowRight") {

            event.preventDefault();

            handleNavigateForward();

            return;

        }


        /* F12 Go to Definition */

        if (event.key === "F12" && !event.ctrlKey && !event.shiftKey && !event.altKey) {

            event.preventDefault();

            void handleGoToDefinition();

            return;

        }


        /* Ctrl + F12 Go to Implementation */

        if (event.key === "F12" && (event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {

            event.preventDefault();

            void handleGoToImplementation();

            return;

        }


        /* Shift + F12 Find References */

        if (event.key === "F12" && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {

            event.preventDefault();

            void handleFindReferences();

            return;

        }


        /* Ctrl + F Find in Current File */

        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "f") {

            if (editor) {

                event.preventDefault();

                editor.focus();

                editor.getAction("actions.find")?.run();

                return;

            }

        }


        /* Ctrl + H Replace in Current File */

        if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "h") {

            if (editor) {

                event.preventDefault();

                editor.focus();

                editor.getAction("editor.action.startFindReplaceAction")?.run();

                return;

            }

        }


        /* F4 / Shift + F4 Next / Previous Search Match */

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
    | Tab Operations & Close Handlers
    |--------------------------------------------------------------------------
    */

    function closeActiveTab() {

        if (!$activeFile) return;

        handleCloseFile($activeFile.path);

    }


    function handleClose(
        event: MouseEvent,
        filePath: string
    ) {

        event.stopPropagation();

        handleCloseFile(filePath);

    }


    function handleCloseFile(filePath: string) {

        const file =
            $openedFiles.find(
                (item) =>
                    pathsEqual(
                        item.path,
                        filePath
                    )
            );

        if (!file) return;


        /* Clean File -> Close immediately */

        if (!file.isDirty) {

            performClose(filePath);

            return;

        }


        /* Dirty File -> Show confirmation modal */

        filePendingClose = filePath;

        showCloseModal = true;

    }


    /*
    |--------------------------------------------------------------------------
    | Batch Close Handlers (Close Others, Close to Right, Close Saved, Close All)
    |--------------------------------------------------------------------------
    */

    function handleCloseOthers(targetFile: OpenFile) {

        const targets = $openedFiles.filter(
            f => !pathsEqual(f.path, targetFile.path) && !f.isPinned
        );

        if (targets.length === 0) return;

        const dirty = targets.filter(f => f.isDirty);

        if (dirty.length > 0) {

            batchCloseModal = {
                visible: true,
                filesToClose: targets,
                dirtyFiles: dirty
            };

        } else {

            closeMultipleFiles(targets.map(f => f.path));

        }

    }


    function handleCloseToTheRight(targetFile: OpenFile) {

        const idx = $openedFiles.findIndex(f => pathsEqual(f.path, targetFile.path));

        if (idx === -1) return;

        const targets = $openedFiles.slice(idx + 1).filter(f => !f.isPinned);

        if (targets.length === 0) return;

        const dirty = targets.filter(f => f.isDirty);

        if (dirty.length > 0) {

            batchCloseModal = {
                visible: true,
                filesToClose: targets,
                dirtyFiles: dirty
            };

        } else {

            closeMultipleFiles(targets.map(f => f.path));

        }

    }


    function handleCloseSaved() {

        const targets = $openedFiles.filter(f => !f.isDirty && !f.isPinned);

        if (targets.length === 0) return;

        closeMultipleFiles(targets.map(f => f.path));

        notify.info(`Closed ${targets.length} saved tabs.`);

    }


    function handleCloseAll() {

        const unpinned = $openedFiles.filter(f => !f.isPinned);

        const targets = unpinned.length > 0 ? unpinned : [...$openedFiles];

        if (targets.length === 0) return;

        const dirty = targets.filter(f => f.isDirty);

        if (dirty.length > 0) {

            batchCloseModal = {
                visible: true,
                filesToClose: targets,
                dirtyFiles: dirty
            };

        } else {

            closeMultipleFiles(targets.map(f => f.path));

        }

    }


    async function handleBatchSaveAll() {

        const dirty = batchCloseModal.dirtyFiles;

        const all = batchCloseModal.filesToClose;

        batchCloseModal.visible = false;

        for (const file of dirty) {

            await saveFile(file.path);

        }

        closeMultipleFiles(all.map(f => f.path));

    }


    function handleBatchDiscardAll() {

        const all = batchCloseModal.filesToClose;

        batchCloseModal.visible = false;

        closeMultipleFiles(all.map(f => f.path));

    }


    function handleBatchCancel() {

        batchCloseModal.visible = false;

    }


    /*
    |--------------------------------------------------------------------------
    | Reopen Last Closed Tab
    |--------------------------------------------------------------------------
    */

    async function reopenLastClosedTab() {

        const record = popClosedTab();

        if (!record) {

            notify.info("No recently closed tabs to reopen.");

            return;

        }

        try {

            const content = await window.craftale.filesystem.readFile(record.path);

            openFile(
                {
                    name: record.name,
                    path: record.path,
                    content
                },
                { preview: false }
            );

        } catch (err) {

            console.error("[EDITOR] Failed to reopen tab:", err);

            notify.warning(
                `Could not reopen "${record.name}". The file may have been moved or deleted.`
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Tab Overflow & Scrolling
    |--------------------------------------------------------------------------
    */

    function updateScrollButtons() {

        if (!tabsContainer) return;

        canScrollLeft = tabsContainer.scrollLeft > 2;

        canScrollRight =
            tabsContainer.scrollLeft + tabsContainer.clientWidth <
            tabsContainer.scrollWidth - 2;

    }


    function scrollTabs(direction: "left" | "right") {

        if (!tabsContainer) return;

        const offset = direction === "left" ? -180 : 180;

        tabsContainer.scrollBy({ left: offset, behavior: "smooth" });

        setTimeout(updateScrollButtons, 200);

    }


    function handleTabWheel(event: WheelEvent) {

        if (!tabsContainer) return;

        event.preventDefault();

        tabsContainer.scrollLeft += event.deltaY || event.deltaX;

        updateScrollButtons();

    }


    /*
    |--------------------------------------------------------------------------
    | Tab Drag and Drop Reordering
    |--------------------------------------------------------------------------
    */

    function handleTabDragStart(event: DragEvent, index: number) {

        draggedTabIndex = index;

        if (event.dataTransfer) {

            event.dataTransfer.effectAllowed = "move";

            event.dataTransfer.setData("application/craftale-tab-index", String(index));

        }

    }


    function handleTabDragOver(event: DragEvent, index: number) {

        event.preventDefault();

        if (draggedTabIndex === null || draggedTabIndex === index) {

            dragOverTabIndex = null;

            dropPlacement = null;

            return;

        }

        const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();

        const midpoint = rect.left + rect.width / 2;

        dropPlacement = event.clientX < midpoint ? "before" : "after";

        dragOverTabIndex = index;

        if (event.dataTransfer) {

            event.dataTransfer.dropEffect = "move";

        }

    }


    function handleTabDragLeave(event: DragEvent) {

        const currentTarget = event.currentTarget as HTMLElement | null;

        const relatedTarget = event.relatedTarget as HTMLElement | null;

        if (currentTarget && relatedTarget && currentTarget.contains(relatedTarget)) {

            return;

        }

        dragOverTabIndex = null;

        dropPlacement = null;

    }


    function handleTabDrop(event: DragEvent, index: number) {

        event.preventDefault();

        if (draggedTabIndex === null || draggedTabIndex === index) {

            handleTabDragEnd();

            return;

        }

        let targetIndex = index;

        if (dropPlacement === "after" && draggedTabIndex < index) {

            targetIndex = index;

        } else if (dropPlacement === "after" && draggedTabIndex > index) {

            targetIndex = index + 1;

        } else if (dropPlacement === "before" && draggedTabIndex > index) {

            targetIndex = index;

        } else if (dropPlacement === "before" && draggedTabIndex < index) {

            targetIndex = Math.max(0, index - 1);

        }

        reorderTabs(draggedTabIndex, targetIndex);

        handleTabDragEnd();

    }


    function handleTabDragEnd() {

        draggedTabIndex = null;

        dragOverTabIndex = null;

        dropPlacement = null;

    }


    /*
    |--------------------------------------------------------------------------
    | Context Menu Handlers
    |--------------------------------------------------------------------------
    */

    function handleTabContextMenu(event: MouseEvent, file: OpenFile) {

        event.preventDefault();

        event.stopPropagation();

        tabContextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            targetFile: file
        };

    }


    function handleTabsBarContextMenu(event: MouseEvent) {

        if ((event.target as HTMLElement).closest(".tab")) return;

        event.preventDefault();

        tabContextMenu = {
            visible: true,
            x: event.clientX,
            y: event.clientY,
            targetFile: $activeFile
        };

    }


    /*
    |--------------------------------------------------------------------------
    | Actually Close File
    |--------------------------------------------------------------------------
    */

    function performClose(
        filePath: string
    ) {

        console.log(
            "[EDITOR] Closing:",
            filePath
        );


        /*
        |--------------------------------------------------------------------------
        | Store
        |--------------------------------------------------------------------------
        */

        closeFile(
            filePath
        );


        /*
        |--------------------------------------------------------------------------
        | Monaco Model
        |--------------------------------------------------------------------------
        */

        const key =
            normalizePath(
                filePath
            );


        const model =
            models.get(
                key
            );


        if (
            model
        ) {

            model.dispose();

            models.delete(
                key
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Save And Close
    |--------------------------------------------------------------------------
    */

    async function confirmCloseSave() {

        if (
            !filePendingClose
        ) {

            return;

        }


        const path =
            filePendingClose;


        /*
        |--------------------------------------------------------------------------
        | Save
        |--------------------------------------------------------------------------
        */

        const saved =
            await saveFile(
                path
            );


        if (!saved) {

            console.error(
                "[EDITOR] Could not save:",
                path
            );

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Close
        |--------------------------------------------------------------------------
        */

        performClose(
            path
        );


        /*
        |--------------------------------------------------------------------------
        | Reset Modal
        |--------------------------------------------------------------------------
        */

        showCloseModal =
            false;


        filePendingClose =
            null;

    }


    /*
    |--------------------------------------------------------------------------
    | Close Without Saving
    |--------------------------------------------------------------------------
    */

    function confirmCloseWithoutSave() {

        if (
            !filePendingClose
        ) {

            return;

        }


        const path =
            filePendingClose;


        performClose(
            path
        );


        showCloseModal =
            false;


        filePendingClose =
            null;

    }


    /*
    |--------------------------------------------------------------------------
    | Cancel Close
    |--------------------------------------------------------------------------
    */

    function cancelClose() {

        showCloseModal =
            false;


        filePendingClose =
            null;

    }


    /*
    |--------------------------------------------------------------------------
    | Code Navigation & Location Jumps
    |--------------------------------------------------------------------------
    */

    let cursorDisposable: monaco.IDisposable | undefined;
    let openerDisposable: monaco.IDisposable | undefined;
    let jumpRequestUnsubscribe: (() => void) | undefined;

    function recordCurrentLocation() {
        if (!$activeFile || !editor) return;
        const pos = editor.getPosition();
        if (pos) {
            recordNavigationPoint({
                path: $activeFile.path,
                line: pos.lineNumber,
                column: pos.column
            });
        }
    }

    function handleNavigateBack() {
        recordCurrentLocation();
        const target = stepBack();
        if (target) {
            void jumpToLocation(target);
        }
    }

    function handleNavigateForward() {
        recordCurrentLocation();
        const target = stepForward();
        if (target) {
            void jumpToLocation(target);
        }
    }

    async function jumpToLocation(location: { path: string; line: number; column?: number; length?: number }) {
        if (!location.path) return;

        let targetPath = location.path;

        if (!$activeFile || !pathsEqual($activeFile.path, targetPath)) {
            const existing = $openedFiles.find(f => pathsEqual(f.path, targetPath));
            if (existing) {
                activateFile(existing.path);
            } else {
                if (window.craftale?.filesystem?.resolveFile) {
                    targetPath = await window.craftale.filesystem.resolveFile(targetPath);
                }

                const alreadyOpen = $openedFiles.find(f => pathsEqual(f.path, targetPath));
                if (alreadyOpen) {
                    activateFile(alreadyOpen.path);
                } else {
                    const exists = window.craftale?.filesystem?.exists
                        ? await window.craftale.filesystem.exists(targetPath)
                        : true;

                    if (!exists) {
                        console.warn("[EDITOR] Cannot navigate, file not found:", targetPath);
                        return;
                    }

                    try {
                        const content = await window.craftale.filesystem.readFile(targetPath);
                        const name = targetPath.split(/[\\/]/).pop() || targetPath;
                        openFile({ name, path: targetPath, content }, { preview: false });
                    } catch (err) {
                        console.warn("[EDITOR] Failed to open file for navigation:", err);
                        return;
                    }
                }
            }
        }

        setTimeout(() => {
            if (!editor) return;
            const col = location.column || 1;
            editor.revealPositionInCenter(new monaco.Position(location.line, col));
            if (location.length && location.length > 0) {
                editor.setSelection(new monaco.Selection(
                    location.line,
                    col,
                    location.line,
                    col + location.length
                ));
            } else {
                editor.setPosition({ lineNumber: location.line, column: col });
            }
            editor.focus();
        }, 60);
    }

    function jumpToSymbol(symbol: DocumentSymbolItem) {
        recordCurrentLocation();
        if (editor) {
            editor.revealPositionInCenter(new monaco.Position(symbol.line, symbol.column));
            editor.setPosition({ lineNumber: symbol.line, column: symbol.column });
            editor.focus();
        }
    }

    function jumpToLine(line: number, column = 1, preview = false) {
        if (!editor) return;
        if (!preview) {
            recordCurrentLocation();
        }
        editor.revealPositionInCenter(new monaco.Position(line, column));
        editor.setPosition({ lineNumber: line, column });
        if (!preview) {
            editor.focus();
        }
    }

    async function openFileFromOpener(targetPath: string, line: number, column = 1) {
        recordCurrentLocation();
        await jumpToLocation({ path: targetPath, line, column });
    }

    async function handleGoToDefinition() {
        recordCurrentLocation();
        const action = editor?.getAction("editor.action.revealDefinition");
        if (action) {
            await action.run();
        }
        await handleImportPathFallback();
    }

    async function handleGoToImplementation() {
        recordCurrentLocation();
        const action = editor?.getAction("editor.action.goToImplementation");
        if (action) {
            await action.run();
        }
    }

    async function handleFindReferences() {
        const action = editor?.getAction("editor.action.referenceSearch.trigger");
        if (action) {
            await action.run();
        }
    }

    async function handleImportPathFallback() {
        if (!editor || !$activeFile) return;
        const pos = editor.getPosition();
        if (!pos) return;
        const model = editor.getModel();
        if (!model) return;
        const lineContent = model.getLineContent(pos.lineNumber);
        const importMatch = lineContent.match(/(?:import|require|from)\s*\(?['"]([^'"]+)['"]\)?/);
        if (importMatch) {
            const relPath = importMatch[1];
            if (relPath.startsWith("./") || relPath.startsWith("../")) {
                const currentDir = $activeFile.path.replace(/[\\/][^\\/]+$/, "");
                const candidateBase = `${currentDir}/${relPath}`.replace(/\\/g, "/");

                let resolved = candidateBase;
                if (window.craftale?.filesystem?.resolveFile) {
                    resolved = await window.craftale.filesystem.resolveFile(candidateBase);
                }

                const exists = window.craftale?.filesystem?.exists
                    ? await window.craftale.filesystem.exists(resolved)
                    : true;

                if (exists) {
                    try {
                        const content = await window.craftale.filesystem.readFile(resolved);
                        const name = resolved.split(/[\\/]/).pop() || resolved;
                        openFile({ name, path: resolved, content }, { preview: false });
                    } catch {
                        // ignore
                    }
                }
            }
        }
    }


    /*
    |--------------------------------------------------------------------------
    | Content Disposable
    |--------------------------------------------------------------------------
    */

    let contentDisposable:
        monaco.IDisposable;


    /*
    |--------------------------------------------------------------------------
    | Active File Subscription
    |--------------------------------------------------------------------------
    */

    let activeFileUnsubscribe:
        () => void;

    let openedFilesUnsubscribe:
        () => void;


    /*
    |--------------------------------------------------------------------------
    | Mount
    |--------------------------------------------------------------------------
    */

    onMount(
        () => {

            /*
            |--------------------------------------------------------------------------
            | Create Monaco
            |--------------------------------------------------------------------------
            */

            editor =
                monaco.editor.create(
                    editorContainer,
                    {

                        theme:
                            "vs-dark",

                        automaticLayout:
                            true,

                        minimap: {

                            enabled: true

                        },

                        fontSize:
                            14,

                        fontFamily:
                            "Consolas, 'Courier New', monospace",

                        lineNumbers:
                            "on",

                        wordWrap:
                            "off",

                        scrollBeyondLastLine:
                            false,

                        tabSize:
                            4,

                        insertSpaces:
                            true

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Ctrl + ` Toggle Terminal Command
            |--------------------------------------------------------------------------
            */

            editor.addCommand(
                monaco.KeyMod.CtrlCmd |
                monaco.KeyCode.Backquote,
                () => {
                    toggleTerminal();
                }
            );


            /*
            |--------------------------------------------------------------------------
            | Ctrl + S Save Command
            |--------------------------------------------------------------------------
            */

            editor.addCommand(
                monaco.KeyMod.CtrlCmd |
                monaco.KeyCode.KeyS,
                () => {
                    void saveCurrentFile();
                }
            );


            /*
            |--------------------------------------------------------------------------
            | Ctrl + W Close Tab Command
            |--------------------------------------------------------------------------
            */

            editor.addCommand(
                monaco.KeyMod.CtrlCmd |
                monaco.KeyCode.KeyW,
                () => {
                    closeActiveTab();
                }
            );


            /*
            |--------------------------------------------------------------------------
            | Ctrl + Shift + T Reopen Closed Tab Command
            |--------------------------------------------------------------------------
            */

            editor.addCommand(
                monaco.KeyMod.CtrlCmd |
                monaco.KeyMod.Shift |
                monaco.KeyCode.KeyT,
                () => {
                    void reopenLastClosedTab();
                }
            );


            /*
            |--------------------------------------------------------------------------
            | Quick Open & Code Navigation Commands
            |--------------------------------------------------------------------------
            */

            /* Quick Open File: Ctrl + P */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyP,
                () => {
                    openQuickOpen("file");
                }
            );

            /* Go to Line: Ctrl + G */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG,
                () => {
                    openQuickOpen("line");
                }
            );

            /* Go to Symbol: Ctrl + Shift + O */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyO,
                () => {
                    openQuickOpen("symbol");
                }
            );

            /* Go to Definition: F12 */
            editor.addCommand(
                monaco.KeyCode.F12,
                () => {
                    void handleGoToDefinition();
                }
            );

            /* Go to Implementation: Ctrl + F12 */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.F12,
                () => {
                    void handleGoToImplementation();
                }
            );

            /* Find References: Shift + F12 */
            editor.addCommand(
                monaco.KeyMod.Shift | monaco.KeyCode.F12,
                () => {
                    void handleFindReferences();
                }
            );

            /* Peek Definition: Alt + F12 */
            editor.addCommand(
                monaco.KeyMod.Alt | monaco.KeyCode.F12,
                () => {
                    recordCurrentLocation();
                    void editor?.getAction("editor.action.peekDefinition")?.run();
                }
            );

            /* Navigate Back: Alt + LeftArrow */
            editor.addCommand(
                monaco.KeyMod.Alt | monaco.KeyCode.LeftArrow,
                () => {
                    handleNavigateBack();
                }
            );

            /* Navigate Forward: Alt + RightArrow */
            editor.addCommand(
                monaco.KeyMod.Alt | monaco.KeyCode.RightArrow,
                () => {
                    handleNavigateForward();
                }
            );

            /* Search Workspace: Ctrl + Shift + F */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF,
                () => {
                    const sel = editor?.getSelection();
                    if (sel && !sel.isEmpty()) {
                        const text = editor.getModel()?.getValueInRange(sel);
                        if (text && text.trim()) {
                            searchQuery.set(text.trim());
                        }
                    }
                    openSidebarView("search");
                    void runWorkspaceSearch();
                }
            );

            /* Replace in Workspace: Ctrl + Shift + H */
            editor.addCommand(
                monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyH,
                () => {
                    const sel = editor?.getSelection();
                    if (sel && !sel.isEmpty()) {
                        const text = editor.getModel()?.getValueInRange(sel);
                        if (text && text.trim()) {
                            searchQuery.set(text.trim());
                        }
                    }
                    isReplaceOpen.set(true);
                    openSidebarView("search");
                    void runWorkspaceSearch();
                }
            );

            /* Next Search Match: F4 */
            editor.addCommand(
                monaco.KeyCode.F4,
                () => {
                    navigateNextMatch();
                }
            );

            /* Previous Search Match: Shift + F4 */
            editor.addCommand(
                monaco.KeyMod.Shift | monaco.KeyCode.F4,
                () => {
                    navigatePrevMatch();
                }
            );

            /* Register Monaco Opener for Cross-File Navigation */
            openerDisposable = monaco.editor.registerEditorOpener({
                openCodeEditor(_sourceEditor, resource, selectionOrPosition) {
                    const targetPath = resource.fsPath || resource.path;
                    const targetLine = (selectionOrPosition as any)?.startLineNumber || (selectionOrPosition as any)?.lineNumber || 1;
                    const targetCol = (selectionOrPosition as any)?.startColumn || (selectionOrPosition as any)?.column || 1;
                    void openFileFromOpener(targetPath, targetLine, targetCol);
                    return true;
                }
            });

            /* Track Cursor Position for Symbol and Location Tracking */
            cursorDisposable = editor.onDidChangeCursorPosition((e) => {
                const line = e.position.lineNumber;
                const symbols = get(activeDocumentSymbols);
                const enclosing = findEnclosingSymbol(symbols, line);
                currentEnclosingSymbol.set(enclosing);
            });

            /* Listen for Jump Requests from Breadcrumbs, Outline, Quick Open, Search */
            jumpRequestUnsubscribe = jumpRequest.subscribe((req) => {
                if (req) {
                    void jumpToLocation({
                        path: req.path || $activeFile?.path || "",
                        line: req.line,
                        column: req.column || 1,
                        length: req.length
                    });
                }
            });



            /*
            |--------------------------------------------------------------------------
            | Content Changed
            |--------------------------------------------------------------------------
            */

            contentDisposable =
                editor.onDidChangeModelContent(
                    () => {

                        if (
                            switchingModel
                        ) {

                            return;

                        }


                        const model =
                            editor.getModel();


                        if (
                            !model
                        ) {

                            return;

                        }


                        const path =
                            $activeFile?.path ||
                            model.uri.fsPath;


                        const content =
                            model.getValue();


                        console.log(
                            "[MONACO] Content changed:",
                            path
                        );


                        updateFileContent(
                            path,
                            content
                        );

                        const syms = parseDocumentSymbols(content, $activeFile?.name || path);
                        activeDocumentSymbols.set(syms);
                        const pos = editor.getPosition();
                        if (pos) {
                            currentEnclosingSymbol.set(findEnclosingSymbol(syms, pos.lineNumber));
                        }

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Active File
            |--------------------------------------------------------------------------
            */

            activeFileUnsubscribe =
                activeFile.subscribe(
                    (file) => {

                        if (
                            !file
                        ) {

                            editor.setModel(
                                null
                            );

                            return;

                        }


                        showFile(
                            file
                        );

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Clean Up Closed / Renamed Models
            |--------------------------------------------------------------------------
            */

            openedFilesUnsubscribe =
                openedFiles.subscribe(
                    (files) => {

                        const currentKeys =
                            new Set(
                                files.map(
                                    (f) =>
                                        normalizePath(f.path)
                                )
                            );


                        for (
                            const [key, model]
                            of models.entries()
                        ) {

                            if (!currentKeys.has(key)) {

                                model.dispose();

                                models.delete(key);

                            }

                        }


                        /*
                        |--------------------------------------------------------------------------
                        | Sync Model Content with External / Store Updates
                        |--------------------------------------------------------------------------
                        */

                        for (const file of files) {

                            const key = normalizePath(file.path);

                            const existingModel = models.get(key);

                            if (
                                existingModel &&
                                existingModel.getValue() !== file.content
                            ) {

                                switchingModel = true;

                                existingModel.setValue(file.content);

                                switchingModel = false;

                            }

                        }

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Keyboard & Resize Listeners
            |--------------------------------------------------------------------------
            */

            window.addEventListener(
                "keydown",
                handleKeyDown
            );

            window.addEventListener(
                "resize",
                updateScrollButtons
            );

            setTimeout(updateScrollButtons, 100);

        }
    );


    /*
    |--------------------------------------------------------------------------
    | Destroy
    |--------------------------------------------------------------------------
    */

    onDestroy(
        () => {

            window.removeEventListener(
                "keydown",
                handleKeyDown
            );

            window.removeEventListener(
                "resize",
                updateScrollButtons
            );


            contentDisposable?.dispose();

            cursorDisposable?.dispose();

            openerDisposable?.dispose();

            jumpRequestUnsubscribe?.();


            activeFileUnsubscribe?.();

            openedFilesUnsubscribe?.();


            for (
                const model
                of models.values()
            ) {

                model.dispose();

            }


            models.clear();


            editor?.dispose();

        }
    );


    /*
    |--------------------------------------------------------------------------
    | Tab Scroll & Auto-Scroll Active Tab
    |--------------------------------------------------------------------------
    */

    $effect(() => {
        const _ = $openedFiles;
        setTimeout(updateScrollButtons, 50);
    });

    $effect(() => {
        if ($activeFile && tabsContainer) {
            setTimeout(() => {
                const activeEl = tabsContainer?.querySelector<HTMLElement>(".tab.active");
                activeEl?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
                updateScrollButtons();
            }, 60);
        }
    });

</script>


<!--
|--------------------------------------------------------------------------
| Editor
|--------------------------------------------------------------------------
-->

<div class="editor">


    <!--
    |--------------------------------------------------------------------------
    | Tabs Bar
    |--------------------------------------------------------------------------
    -->

    <div class="tabs-bar">

        {#if canScrollLeft}

            <button
                type="button"
                class="tab-scroll-btn left"
                onclick={() => scrollTabs("left")}
                title="Scroll Tabs Left"
                aria-label="Scroll Tabs Left"
            >
                ‹
            </button>

        {/if}


        <div
            bind:this={tabsContainer}
            class="tabs"
            role="tablist"
            tabindex="-1"
            aria-label="Open editor tabs"
            onscroll={updateScrollButtons}
            onwheel={handleTabWheel}
            oncontextmenu={handleTabsBarContextMenu}
        >

            {#each $openedFiles as file, index (file.path)}

                <div
                    class="tab"
                    class:active={file.path === $activeFile?.path}
                    class:is-pinned={file.isPinned}
                    class:is-preview={file.isPreview}
                    class:drag-over-before={dragOverTabIndex === index && dropPlacement === "before"}
                    class:drag-over-after={dragOverTabIndex === index && dropPlacement === "after"}
                    class:is-dragging={draggedTabIndex === index}
                    role="tab"
                    tabindex="0"
                    aria-selected={file.path === $activeFile?.path}
                    draggable="true"
                    title={
                        file.isPinned
                            ? `${file.name} (Pinned)`
                            : file.isPreview
                                ? `${file.name} (Preview)`
                                : file.name
                    }
                    onclick={() => activateFile(file.path)}
                    ondblclick={() => {
                        if (file.isPreview) {
                            promotePreviewTab(file.path);
                        }
                    }}
                    onauxclick={(event) => {
                        if (event.button === 1) {
                            event.preventDefault();
                            event.stopPropagation();
                            handleCloseFile(file.path);
                        }
                    }}
                    oncontextmenu={(event) => handleTabContextMenu(event, file)}
                    ondragstart={(event) => handleTabDragStart(event, index)}
                    ondragover={(event) => handleTabDragOver(event, index)}
                    ondragleave={handleTabDragLeave}
                    ondrop={(event) => handleTabDrop(event, index)}
                    ondragend={handleTabDragEnd}
                    onkeydown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            activateFile(file.path);
                        }
                    }}
                >

                    <!-- Pin Badge -->

                    {#if file.isPinned}

                        <span class="pin-icon" title="Pinned">
                            📌
                        </span>

                    {/if}


                    <!-- File Icon -->

                    <span class="file-icon">
                        📄
                    </span>


                    <!-- File Name -->

                    <span class="file-name" class:preview-text={file.isPreview}>
                        {file.name}
                    </span>


                    <!-- Close / Dirty Button -->

                    <button
                        type="button"
                        class="tab-close"
                        class:is-dirty={file.isDirty}
                        class:is-pinned-close={file.isPinned}
                        title={
                            file.isDirty
                                ? "Unsaved changes (Click to close)"
                                : "Close"
                        }
                        aria-label={`Close ${file.name}`}
                        onclick={(event) => handleClose(event, file.path)}
                    >

                        {#if file.isDirty}

                            <span class="dirty-indicator">
                                ●
                            </span>

                        {/if}

                        <span class="close-icon">
                            ×
                        </span>

                    </button>

                </div>

            {/each}

        </div>


        {#if canScrollRight}

            <button
                type="button"
                class="tab-scroll-btn right"
                onclick={() => scrollTabs("right")}
                title="Scroll Tabs Right"
                aria-label="Scroll Tabs Right"
            >
                ›
            </button>

        {/if}


        <!-- More Tabs Dropdown Button -->

        {#if $openedFiles.length > 0}

            <div class="more-tabs-wrapper">

                <button
                    type="button"
                    class="more-tabs-btn"
                    class:active={showMoreTabsDropdown}
                    onclick={() => (showMoreTabsDropdown = !showMoreTabsDropdown)}
                    title="More Open Tabs"
                    aria-label="More Open Tabs"
                >
                    ⌄
                </button>

                {#if showMoreTabsDropdown}

                    <div
                        class="more-tabs-backdrop"
                        role="presentation"
                        onclick={() => (showMoreTabsDropdown = false)}
                    ></div>

                    <div class="more-tabs-menu" role="menu">

                        <div class="more-tabs-header">
                            OPEN TABS ({$openedFiles.length})
                        </div>

                        <div class="more-tabs-list">

                            {#each $openedFiles as f}

                                <button
                                    type="button"
                                    class="more-tabs-item"
                                    class:active={f.path === $activeFile?.path}
                                    onclick={() => {
                                        activateFile(f.path);
                                        showMoreTabsDropdown = false;
                                    }}
                                >

                                    <span class="more-tabs-icon">📄</span>

                                    <span
                                        class="more-tabs-title"
                                        class:preview={f.isPreview}
                                    >
                                        {f.name}
                                    </span>

                                    {#if f.isPinned}

                                        <span class="more-tabs-pin" title="Pinned">📌</span>

                                    {/if}

                                    {#if f.isDirty}

                                        <span class="more-tabs-dirty" title="Unsaved">●</span>

                                    {/if}

                                </button>

                            {/each}

                        </div>

                    </div>

                {/if}

            </div>

        {/if}

    </div>


    <!--
    |--------------------------------------------------------------------------
    | Breadcrumbs Navigation Bar
    |--------------------------------------------------------------------------
    -->

    <Breadcrumbs
        onJumpToSymbol={jumpToSymbol}
        onNavigateLocation={jumpToLocation}
    />


    <!--
    |--------------------------------------------------------------------------
    | Monaco
    |--------------------------------------------------------------------------
    -->

    <div
        class="monaco-container"
        bind:this={editorContainer}
    ></div>


</div>


<!--
|--------------------------------------------------------------------------
| Single File Confirmation Modal
|--------------------------------------------------------------------------
-->

<ConfirmModal
    visible={showCloseModal}
    title="Save Changes"
    message="This file has unsaved changes. Do you want to save them before closing?"
    fileName={filePendingClose ? ($openedFiles.find(f => pathsEqual(f.path, filePendingClose!))?.name ?? "") : ""}
    confirmText="Save"
    secondaryText="Don't Save"
    cancelText="Cancel"
    onConfirm={confirmCloseSave}
    onSecondary={confirmCloseWithoutSave}
    onCancel={cancelClose}
/>


<!--
|--------------------------------------------------------------------------
| Batch Close Confirmation Modal
|--------------------------------------------------------------------------
-->

<BatchCloseModal
    visible={batchCloseModal.visible}
    files={batchCloseModal.dirtyFiles}
    onSaveAll={handleBatchSaveAll}
    onDiscardAll={handleBatchDiscardAll}
    onCancel={handleBatchCancel}
/>


<!--
|--------------------------------------------------------------------------
| Tab Context Menu
|--------------------------------------------------------------------------
-->

<TabContextMenu
    visible={tabContextMenu.visible}
    x={tabContextMenu.x}
    y={tabContextMenu.y}
    targetFile={tabContextMenu.targetFile}
    canReopen={$recentlyClosedTabs.length > 0}
    onClose={() => (tabContextMenu.visible = false)}
    onCloseTab={(file) => handleCloseFile(file.path)}
    onCloseOthers={handleCloseOthers}
    onCloseToTheRight={handleCloseToTheRight}
    onCloseSaved={handleCloseSaved}
    onCloseAll={handleCloseAll}
    onReopenClosed={reopenLastClosedTab}
    onPinTab={(file) => pinTab(file.path)}
    onUnpinTab={(file) => unpinTab(file.path)}
    onKeepOpen={(file) => promotePreviewTab(file.path)}
/>


<style>

    /*
    |--------------------------------------------------------------------------
    | Editor
    |--------------------------------------------------------------------------
    */

    .editor {

        width: 100%;

        height: 100%;

        display: flex;

        flex-direction: column;

        background:
            #1e1e1e;

    }


    /*
    |--------------------------------------------------------------------------
    | Tabs Bar
    |--------------------------------------------------------------------------
    */

    .tabs-bar {

        height: 36px;

        min-height: 36px;

        display: flex;

        align-items: stretch;

        background: #181818;

        border-bottom: 1px solid #333333;

        position: relative;

        overflow: hidden;

    }


    .tab-scroll-btn {

        width: 24px;

        height: 36px;

        display: flex;

        align-items: center;

        justify-content: center;

        background: #181818;

        border: none;

        color: #858585;

        cursor: pointer;

        font-size: 18px;

        flex-shrink: 0;

        z-index: 2;

        transition: background 0.1s ease, color 0.1s ease;

        user-select: none;

    }


    .tab-scroll-btn.left {

        border-right: 1px solid #2d2d2d;

    }


    .tab-scroll-btn.right {

        border-left: 1px solid #2d2d2d;

    }


    .tab-scroll-btn:hover {

        background: #252526;

        color: #ffffff;

    }


    /*
    |--------------------------------------------------------------------------
    | Tabs Container
    |--------------------------------------------------------------------------
    */

    .tabs {

        flex: 1;

        height: 36px;

        min-height: 36px;

        display: flex;

        align-items: stretch;

        background: #181818;

        overflow-x: auto;

        overflow-y: hidden;

        scrollbar-width: none;

    }


    .tabs::-webkit-scrollbar {

        display: none;

    }


    .tab {

        height: 36px;

        min-width: 120px;

        max-width: 220px;

        display: flex;

        align-items: center;

        gap: 6px;

        padding: 0 8px;

        background: #181818;

        border-right: 1px solid #2d2d2d;

        color: #858585;

        cursor: pointer;

        user-select: none;

        position: relative;

        transition: background 0.1s ease;

        outline: none;

    }


    .tab:hover {

        background: #202020;

        color: #cccccc;

    }


    .tab.active {

        background: #1e1e1e;

        color: #ffffff;

        border-top: 1px solid #007acc;

    }


    /* Drag and Drop Drop Indicators */

    .tab.drag-over-before::before {

        content: "";

        position: absolute;

        left: 0;

        top: 0;

        bottom: 0;

        width: 2px;

        background: #007acc;

        z-index: 10;

    }


    .tab.drag-over-after::after {

        content: "";

        position: absolute;

        right: 0;

        top: 0;

        bottom: 0;

        width: 2px;

        background: #007acc;

        z-index: 10;

    }


    .tab.is-dragging {

        opacity: 0.35;

    }


    /* Pinned Tab Styles */

    .tab.is-pinned {

        min-width: 80px;

        max-width: 140px;

        background: #1a1a1a;

        border-right: 1px solid #303030;

    }


    .tab.is-pinned.active {

        background: #1e1e1e;

    }


    .pin-icon {

        font-size: 11px;

        flex-shrink: 0;

    }


    .tab.is-pinned .tab-close {

        display: none;

    }


    .tab.is-pinned:hover .tab-close {

        display: flex;

    }


    /* Preview Tab Style */

    .preview-text {

        font-style: italic;

    }


    /*
    |--------------------------------------------------------------------------
    | File Icon & File Name
    |--------------------------------------------------------------------------
    */

    .file-icon {

        font-size: 12px;

        flex-shrink: 0;

    }


    .file-name {

        flex: 1;

        min-width: 0;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

    }


    /*
    |--------------------------------------------------------------------------
    | Tab Close Button & Dirty Indicator
    |--------------------------------------------------------------------------
    */

    .tab-close {

        width: 20px;

        height: 20px;

        display: flex;

        align-items: center;

        justify-content: center;

        border: none;

        border-radius: 3px;

        background: transparent;

        color: #858585;

        font-size: 14px;

        cursor: pointer;

        padding: 0;

        margin-left: 4px;

        flex-shrink: 0;

        position: relative;

    }


    .tab-close:hover {

        background: #3a3a3a;

        color: #ffffff;

    }


    .dirty-indicator {

        font-size: 10px;

        color: #ffffff;

        display: block;

    }


    .close-icon {

        font-size: 14px;

        line-height: 1;

        display: block;

    }


    .tab-close.is-dirty .close-icon {

        display: none;

    }


    .tab:hover .tab-close.is-dirty .dirty-indicator {

        display: none;

    }


    .tab:hover .tab-close.is-dirty .close-icon {

        display: block;

    }


    /*
    |--------------------------------------------------------------------------
    | More Tabs Dropdown Button & Menu
    |--------------------------------------------------------------------------
    */

    .more-tabs-wrapper {

        position: relative;

        display: flex;

        align-items: center;

        flex-shrink: 0;

    }


    .more-tabs-btn {

        width: 28px;

        height: 36px;

        display: flex;

        align-items: center;

        justify-content: center;

        background: #181818;

        border: none;

        border-left: 1px solid #2d2d2d;

        color: #858585;

        cursor: pointer;

        font-size: 11px;

        transition: background 0.1s ease, color 0.1s ease;

    }


    .more-tabs-btn:hover,
    .more-tabs-btn.active {

        background: #252526;

        color: #ffffff;

    }


    .more-tabs-backdrop {

        position: fixed;

        inset: 0;

        z-index: 99998;

    }


    .more-tabs-menu {

        position: absolute;

        top: 36px;

        right: 0;

        z-index: 99999;

        width: 250px;

        background: #252526;

        border: 1px solid #454545;

        border-radius: 4px;

        box-shadow: 0 6px 20px rgba(0, 0, 0, 0.5);

        overflow: hidden;

        display: flex;

        flex-direction: column;

        animation: modal-appear 0.1s ease-out;

    }


    .more-tabs-header {

        padding: 7px 12px;

        font-size: 11px;

        font-weight: 600;

        color: #888888;

        border-bottom: 1px solid #333333;

        letter-spacing: 0.5px;

    }


    .more-tabs-list {

        overflow-y: auto;

        max-height: 260px;

    }


    .more-tabs-list::-webkit-scrollbar {

        width: 5px;

    }


    .more-tabs-list::-webkit-scrollbar-thumb {

        background: #424242;

        border-radius: 3px;

    }


    .more-tabs-item {

        width: 100%;

        height: 28px;

        display: flex;

        align-items: center;

        gap: 8px;

        padding: 0 12px;

        background: transparent;

        border: none;

        color: #cccccc;

        font-size: 12px;

        cursor: pointer;

        text-align: left;

        outline: none;

    }


    .more-tabs-item:hover {

        background: #094771;

        color: #ffffff;

    }


    .more-tabs-item.active {

        background: #1e1e1e;

        color: #ffffff;

        font-weight: 500;

        border-left: 2px solid #007acc;

    }


    .more-tabs-icon {

        font-size: 12px;

        flex-shrink: 0;

    }


    .more-tabs-title {

        flex: 1;

        overflow: hidden;

        text-overflow: ellipsis;

        white-space: nowrap;

    }


    .more-tabs-title.preview {

        font-style: italic;

    }


    .more-tabs-pin {

        font-size: 10px;

        margin-left: auto;

        flex-shrink: 0;

    }


    .more-tabs-dirty {

        color: #ffffff;

        font-size: 10px;

        margin-left: auto;

        flex-shrink: 0;

    }


    /*
    |--------------------------------------------------------------------------
    | Monaco
    |--------------------------------------------------------------------------
    */

    .monaco-container {

        flex: 1;

        min-height: 0;

        width: 100%;

    }

</style>