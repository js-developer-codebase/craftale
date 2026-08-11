<script lang="ts">

    import { onMount } from "svelte";

    import * as monaco from "monaco-editor";

    import {
        activeFile,
        openedFiles,
        activePath,
        activateFile,
        closeFile,
        updateFileContent
    } from "../stores/workspace";


    /*
    |--------------------------------------------------------------------------
    | Editor Container
    |--------------------------------------------------------------------------
    */

    let editorContainer:
        HTMLDivElement;


    let editor:
        monaco.editor.IStandaloneCodeEditor | null =
        null;


    /*
    |--------------------------------------------------------------------------
    | Monaco Models
    |--------------------------------------------------------------------------
    |
    | One model per file.
    |
    */

    const models =
        new Map<
            string,
            monaco.editor.ITextModel
        >();


    /*
    |--------------------------------------------------------------------------
    | Prevent Store Update While Switching Files
    |--------------------------------------------------------------------------
    */

    let switchingModel = false;


    /*
    |--------------------------------------------------------------------------
    | Language Detection
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

            case "html":
                return "html";

            case "css":
                return "css";

            case "scss":
                return "scss";

            case "svelte":
                return "html";

            case "md":
                return "markdown";

            case "xml":
                return "xml";

            case "yaml":
            case "yml":
                return "yaml";

            case "sql":
                return "sql";

            case "java":
                return "java";

            case "py":
                return "python";

            case "c":
                return "c";

            case "cpp":
                return "cpp";

            case "cs":
                return "csharp";

            case "sh":
                return "shell";

            case "bat":
                return "bat";

            case "ps1":
                return "powershell";

            default:
                return "plaintext";

        }

    }


    /*
    |--------------------------------------------------------------------------
    | Get Or Create Model
    |--------------------------------------------------------------------------
    */

    function getModel(
        file: {
            name: string;
            path: string;
            content: string;
        }
    ) {

        /*
        |--------------------------------------------------------------------------
        | Existing Model
        |--------------------------------------------------------------------------
        */

        const existing =
            models.get(file.path);


        if (existing) {

            return existing;

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
            file.path,
            model
        );
        return model;

    }


    /*
    |--------------------------------------------------------------------------
    | Open File In Monaco
    |--------------------------------------------------------------------------
    */

    function showFile(
        file: {
            name: string;
            path: string;
            content: string;
        } | null
    ) {

        if (!editor) {

            return;

        }


        if (!file) {

            editor.setModel(null);

            return;

        }
        switchingModel = true;


        /*
        |--------------------------------------------------------------------------
        | Get Model
        |--------------------------------------------------------------------------
        */

        const model =
            getModel(file);


        /*
        |--------------------------------------------------------------------------
        | Attach Model
        |--------------------------------------------------------------------------
        */

        editor.setModel(
            model
        );


        switchingModel = false;


        /*
        |--------------------------------------------------------------------------
        | Layout
        |--------------------------------------------------------------------------
        */

        requestAnimationFrame(
            () => {

                editor?.layout();

            }
        );

    }


    /*
    |--------------------------------------------------------------------------
    | Close Tab
    |--------------------------------------------------------------------------
    */

    function handleClose(
        event: MouseEvent,
        path: string
    ) {

        event.stopPropagation();


        closeFile(path);

    }


    /*
    |--------------------------------------------------------------------------
    | Mount
    |--------------------------------------------------------------------------
    */

    onMount(() => {
        /*
        |--------------------------------------------------------------------------
        | Create Editor
        |--------------------------------------------------------------------------
        */

        editor =
            monaco.editor.create(
                editorContainer,
                {

                    theme: "vs-dark",

                    automaticLayout: true,

                    fontSize: 14,

                    fontFamily:
                        "Consolas, 'Courier New', monospace",

                    lineNumbers: "on",

                    minimap: {

                        enabled: true

                    },

                    wordWrap: "off",

                    tabSize: 4,

                    insertSpaces: true,

                    scrollBeyondLastLine: false,

                    smoothScrolling: true,

                    cursorBlinking: "smooth",

                    padding: {

                        top: 10,

                        bottom: 10

                    }

                }
            );


        /*
        |--------------------------------------------------------------------------
        | Content Changed
        |--------------------------------------------------------------------------
        */

       const contentDisposable =
    editor.onDidChangeModelContent(
        () => {

            /*
            |--------------------------------------------------------------------------
            | Ignore changes while switching files
            |--------------------------------------------------------------------------
            */

            if (switchingModel) {

                return;

            }


            /*
            |--------------------------------------------------------------------------
            | Get Current Monaco Model
            |--------------------------------------------------------------------------
            */

            const model =
                editor?.getModel();


            if (!model) {

                return;

            }


            /*
            |--------------------------------------------------------------------------
            | Get File Path
            |--------------------------------------------------------------------------
            */

            const path =
                model.uri.fsPath;


            /*
            |--------------------------------------------------------------------------
            | Get Current Editor Content
            |--------------------------------------------------------------------------
            */

            const content =
                model.getValue();


            /*
            |--------------------------------------------------------------------------
            | Debug
            |--------------------------------------------------------------------------
            */

            /*
            |--------------------------------------------------------------------------
            | Update Workspace Store
            |--------------------------------------------------------------------------
            */

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

        const activeUnsubscribe =
            activeFile.subscribe(
                file => {

                    showFile(file);

                }
            );


        /*
        |--------------------------------------------------------------------------
        | Resize
        |--------------------------------------------------------------------------
        */

        const resize =
            () => {

                editor?.layout();

            };


        window.addEventListener(
            "resize",
            resize
        );


        /*
        |--------------------------------------------------------------------------
        | Cleanup
        |--------------------------------------------------------------------------
        */

        return () => {

            contentDisposable.dispose();

            activeUnsubscribe();

            window.removeEventListener(
                "resize",
                resize
            );


            /*
            |--------------------------------------------------------------------------
            | Dispose Models
            |--------------------------------------------------------------------------
            */

            models.forEach(
                model => {

                    model.dispose();

                }
            );


            models.clear();


            editor?.dispose();

            editor = null;

        };

    });

</script>


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
                    file.path === $activePath
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

                    <span class="dirty">
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
    | Editor
    |--------------------------------------------------------------------------
    -->

    <div class="editor-body">

        <div
            class="monaco-container"
            bind:this={editorContainer}
        ></div>


        {#if !$activeFile}

            <div class="welcome">

                <div class="logo">
                    C
                </div>


                <h1>
                    Craftale
                </h1>


                <p>
                    Open a file from the Explorer
                </p>

            </div>

        {/if}

    </div>

</div>


<style>

    .editor {

        width: 100%;

        height: 100%;

        display: flex;

        flex-direction: column;

        overflow: hidden;

        background: #1e1e1e;

    }


    /*
    |--------------------------------------------------------------------------
    | Tabs
    |--------------------------------------------------------------------------
    */

    .tabs {

        height: 35px;

        min-height: 35px;

        display: flex;

        overflow-x: auto;

        overflow-y: hidden;

        background: #252526;

        border-bottom:
            1px solid #333;

    }


    .tab {

        height: 35px;

        min-width: 140px;

        max-width: 240px;

        display: flex;

        align-items: center;

        gap: 6px;

        padding:
            0 8px 0 12px;

        background: #2d2d2d;

        border-right:
            1px solid #1e1e1e;

        color: #969696;

        font-size: 13px;

        cursor: pointer;

        user-select: none;

    }


    .tab:hover {

        background: #323232;

    }


    .tab.active {

        background: #1e1e1e;

        color: #ffffff;

        border-top:
            1px solid #007acc;

    }


    .file-icon {

        flex-shrink: 0;

    }


    .file-name {

        flex: 1;

        min-width: 0;

        overflow: hidden;

        white-space: nowrap;

        text-overflow: ellipsis;

    }


    /*
    |--------------------------------------------------------------------------
    | Dirty Indicator
    |--------------------------------------------------------------------------
    */

    .dirty {

        color: #ffffffff;

        font-size: 10px;

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

        color: #999;

        font-size: 18px;

        cursor: pointer;

    }


    .close:hover {

        background: #444;

        color: white;

    }


    /*
    |--------------------------------------------------------------------------
    | Editor Body
    |--------------------------------------------------------------------------
    */

    .editor-body {

        position: relative;

        flex: 1;

        min-width: 0;

        min-height: 0;

        overflow: hidden;

    }


    .monaco-container {

        position: absolute;

        inset: 0;

        width: 100%;

        height: 100%;

    }


    /*
    |--------------------------------------------------------------------------
    | Welcome
    |--------------------------------------------------------------------------
    */

    .welcome {

        position: absolute;

        inset: 0;

        z-index: 10;

        display: flex;

        flex-direction: column;

        align-items: center;

        justify-content: center;

        background: #1e1e1e;

        color: #858585;

        pointer-events: none;

    }


    .logo {

        width: 70px;

        height: 70px;

        display: flex;

        align-items: center;

        justify-content: center;

        margin-bottom: 20px;

        border:
            2px solid #858585;

        border-radius: 12px;

        color: #cccccc;

        font-size: 40px;

    }


    .welcome h1 {

        margin:
            0 0 8px;

        color: #cccccc;

        font-size: 28px;

        font-weight: 400;

    }


    .welcome p {

        margin: 0;

        font-size: 13px;

    }

</style>