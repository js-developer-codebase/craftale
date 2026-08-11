<script lang="ts">

    import {
        onMount,
        onDestroy
    } from "svelte";


    import {
        openedFiles,
        activeFile,
        updateFileContent,
        saveFile,
        activateFile,
        closeFile
    } from "../stores/workspace";


    import * as monaco
        from "monaco-editor";


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
    | Models
    |--------------------------------------------------------------------------
    */

    const models =
        new Map<
            string,
            monaco.editor.ITextModel
        >();


    /*
    |--------------------------------------------------------------------------
    | Prevent Content Change During
    | Model Switching
    |--------------------------------------------------------------------------
    */

    let switchingModel =
        false;


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
    | Get Monaco Language
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
                return "typescript";

            case "tsx":
                return "typescript";

            case "js":
                return "javascript";

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
    | Create Model
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


        /*
        |--------------------------------------------------------------------------
        | Existing Model
        |--------------------------------------------------------------------------
        */

        const existingModel =
            models.get(
                key
            );


        if (
            existingModel
        ) {

            return existingModel;

        }


        /*
        |--------------------------------------------------------------------------
        | Create URI
        |--------------------------------------------------------------------------
        */

        const uri =
            monaco.Uri.file(
                file.path
            );


        /*
        |--------------------------------------------------------------------------
        | Create Model
        |--------------------------------------------------------------------------
        */

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
    | Show Active File
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
            model.uri.fsPath;


        const content =
            model.getValue();


        console.log(
            "[EDITOR] Saving:",
            path
        );


        /*
        |--------------------------------------------------------------------------
        | Make Sure Store Has Latest Content
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


        if (
            success
        ) {

            console.log(
                "[EDITOR] Saved:",
                path
            );

        } else {

            console.error(
                "[EDITOR] Save failed:",
                path
            );

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Keyboard Handler
    |--------------------------------------------------------------------------
    */

    function handleKeyDown(
        event: KeyboardEvent
    ) {

        /*
        |--------------------------------------------------------------------------
        | Ctrl + S
        |--------------------------------------------------------------------------
        */

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
    | Close Tab
    |--------------------------------------------------------------------------
    */

    function handleClose(
        event: MouseEvent,
        filePath: string
    ) {

        event.stopPropagation();


        console.log(
            "[EDITOR] Closing:",
            filePath
        );


        closeFile(
            filePath
        );


        /*
        |--------------------------------------------------------------------------
        | Dispose Model
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
    | Monaco Change Listener
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


    /*
    |--------------------------------------------------------------------------
    | Component Mount
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
                            model.uri.fsPath;


                        const content =
                            model.getValue();


                        console.log(
                            "[MONACO] Content changed:",
                            path
                        );


                        console.log(
                            "[MONACO] Calling updateFileContent..."
                        );


                        updateFileContent(
                            path,
                            content
                        );

                    }
                );


            /*
            |--------------------------------------------------------------------------
            | Active File Subscription
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
            | Ctrl + S
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


            /*
            |--------------------------------------------------------------------------
            | Dispose Models
            |--------------------------------------------------------------------------
            */

            for (
                const model
                of models.values()
            ) {

                model.dispose();

            }


            models.clear();


            /*
            |--------------------------------------------------------------------------
            | Dispose Editor
            |--------------------------------------------------------------------------
            */

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
                onclick={() =>
                    activateFile(
                        file.path
                    )
                }
                onkeydown={(event) => {

                    if (
                        event.key === "Enter" ||
                        event.key === " "
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


                {#if file.isDirty}

                    <span
                        class="dirty"
                        title="Unsaved changes"
                    >
                        ●
                    </span>

                {/if}


                <button
                    class="close"
                    title="Close"
                    onclick={(event) =>
                        handleClose(
                            event,
                            file.path
                        )
                    }
                >

                    ×

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


<style>

    .editor {

        width: 100%;

        height: 100%;

        display: flex;

        flex-direction: column;

        background: #1e1e1e;

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

        background: #181818;

        border-bottom:
            1px solid #333;

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

        background: #181818;

        border-right:
            1px solid #2d2d2d;

        color: #858585;

        cursor: pointer;

        user-select: none;

    }


    .tab:hover {

        background: #202020;

        color: #cccccc;

    }


    .tab.active {

        background: #1e1e1e;

        color: #ffffff;

        border-top:
            1px solid #007acc;

    }


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
    | Dirty Indicator
    |--------------------------------------------------------------------------
    */

    .dirty {

        color: #ffffff;

        font-size: 10px;

        line-height: 1;

        flex-shrink: 0;

    }


    /*
    |--------------------------------------------------------------------------
    | Close
    |--------------------------------------------------------------------------
    */

    .close {

        width: 22px;

        height: 22px;

        display: flex;

        align-items: center;

        justify-content: center;

        border: none;

        background: transparent;

        color: #858585;

        font-size: 16px;

        cursor: pointer;

        padding: 0;

        flex-shrink: 0;

    }


    .close:hover {

        background: #333;

        color: #ffffff;

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