<script lang="ts">

    import {
        onMount,
        onDestroy
    } from "svelte";


    import * as monaco
        from "monaco-editor";


    import ConfirmModal
        from "./ConfirmModal.svelte";


    import {
        openedFiles,
        activeFile,
        updateFileContent,
        saveFile,
        activateFile,
        closeFile,
        toggleTerminal,
        pathsEqual
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
    | Close Modal
    |--------------------------------------------------------------------------
    */

    let showCloseModal =
        false;


    let filePendingClose:
        string | null = null;


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
    | Keyboard
    |--------------------------------------------------------------------------
    */

    function handleKeyDown(
        event: KeyboardEvent
    ) {

        if (
            (
                event.ctrlKey ||
                event.metaKey
            ) &&
            event.key.toLowerCase() === "s"
        ) {

            event.preventDefault();

            void saveCurrentFile();

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Close Tab Click
    |--------------------------------------------------------------------------
    */

    function handleClose(
        event: MouseEvent,
        filePath: string
    ) {

        event.stopPropagation();


        const file =
            $openedFiles.find(
                (item) =>
                    pathsEqual(
                        item.path,
                        filePath
                    )
            );


        if (!file) {

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Clean File
        |--------------------------------------------------------------------------
        */

        if (
            !file.isDirty
        ) {

            performClose(
                filePath
            );

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Dirty File
        |--------------------------------------------------------------------------
        */

        filePendingClose =
            filePath;


        showCloseModal =
            true;

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

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Keyboard
            |--------------------------------------------------------------------------
            */

            window.addEventListener(
                "keydown",
                handleKeyDown
            );

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


            contentDisposable?.dispose();


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

</script>


<!--
|--------------------------------------------------------------------------
| Editor
|--------------------------------------------------------------------------
-->

<div class="editor">


    <!--
    |--------------------------------------------------------------------------
    | Tabs
    |--------------------------------------------------------------------------
    -->

    <div class="tabs">

        {#each $openedFiles as file (
            file.path
        )}

            <div
                class="tab"
                class:active={
                    file.path ===
                    $activeFile?.path
                }
                role="tab"
                tabindex="0"
                aria-selected={
                    file.path ===
                    $activeFile?.path
                }
                onclick={() =>
                    activateFile(
                        file.path
                    )
                }
                onkeydown={(event) => {

                    if (
                        event.key ===
                            "Enter" ||
                        event.key ===
                            " "
                    ) {

                        event.preventDefault();

                        activateFile(
                            file.path
                        );

                    }

                }}
            >

                <span class="file-icon">

                    📄

                </span>


                <span class="file-name">

                    {file.name}

                </span>


                <button
                    type="button"
                    class="tab-close"
                    class:is-dirty={file.isDirty}
                    title={
                        file.isDirty
                            ? "Unsaved changes (Click to close)"
                            : "Close"
                    }
                    aria-label={
                        `Close ${file.name}`
                    }
                    onclick={(event) =>
                        handleClose(
                            event,
                            file.path
                        )
                    }
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
| Confirmation Modal
|--------------------------------------------------------------------------
-->

<ConfirmModal

    visible={
        showCloseModal
    }

    title="Save Changes"

    message={
        "This file has unsaved changes. " +
        "Do you want to save them before closing?"
    }

    fileName={

        filePendingClose

            ? (
                $openedFiles.find(
                    (file) =>
                        pathsEqual(
                            file.path,
                            filePendingClose!
                        )
                )?.name ?? ""
            )

            : ""

    }

    confirmText="Save"

    secondaryText="Don't Save"

    cancelText="Cancel"

    onConfirm={
        confirmCloseSave
    }

    onSecondary={
        confirmCloseWithoutSave
    }

    onCancel={
        cancelClose
    }

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
    | Tabs
    |--------------------------------------------------------------------------
    */

    .tabs {

        height: 36px;

        min-height: 36px;

        display: flex;

        align-items: stretch;

        background:
            #181818;

        border-bottom:
            1px solid #333333;

        overflow-x: auto;

        overflow-y: hidden;

    }


    .tabs::-webkit-scrollbar {

        height: 4px;

    }


    .tab {

        height: 36px;

        min-width: 130px;

        max-width: 220px;

        display: flex;

        align-items: center;

        gap: 6px;

        padding:
            0 8px;

        background:
            #181818;

        border-right:
            1px solid #2d2d2d;

        color:
            #858585;

        cursor:
            pointer;

        user-select:
            none;

    }


    .tab:hover {

        background:
            #202020;

        color:
            #cccccc;

    }


    .tab.active {

        background:
            #1e1e1e;

        color:
            #ffffff;

        border-top:
            1px solid #007acc;

    }


    /*
    |--------------------------------------------------------------------------
    | File Icon
    |--------------------------------------------------------------------------
    */

    .file-icon {

        font-size:
            12px;

        flex-shrink:
            0;

    }


    /*
    |--------------------------------------------------------------------------
    | File Name
    |--------------------------------------------------------------------------
    */

    .file-name {

        flex:
            1;

        min-width:
            0;

        overflow:
            hidden;

        text-overflow:
            ellipsis;

        white-space:
            nowrap;

    }


    /*
    |--------------------------------------------------------------------------
    | Tab Close Button & Dirty Indicator (VS Code Style)
    |--------------------------------------------------------------------------
    */

    .tab-close {

        width:
            20px;

        height:
            20px;

        display:
            flex;

        align-items:
            center;

        justify-content:
            center;

        border:
            none;

        border-radius:
            3px;

        background:
            transparent;

        color:
            #858585;

        font-size:
            14px;

        cursor:
            pointer;

        padding:
            0;

        margin-left:
            4px;

        flex-shrink:
            0;

        position:
            relative;

    }


    .tab-close:hover {

        background:
            #3a3a3a;

        color:
            #ffffff;

    }


    .dirty-indicator {

        font-size:
            10px;

        color:
            #ffffff;

        display:
            block;

    }


    .close-icon {

        font-size:
            14px;

        line-height:
            1;

        display:
            block;

    }


    /* When file is dirty: show dot by default; when hovering the tab, show × */
    .tab-close.is-dirty .close-icon {

        display:
            none;

    }


    .tab:hover .tab-close.is-dirty .dirty-indicator {

        display:
            none;

    }


    .tab:hover .tab-close.is-dirty .close-icon {

        display:
            block;

    }


    /*
    |--------------------------------------------------------------------------
    | Monaco
    |--------------------------------------------------------------------------
    */

    .monaco-container {

        flex:
            1;

        min-height:
            0;

        width:
            100%;

    }

</style>