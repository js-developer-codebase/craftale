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
    | Monaco
    |--------------------------------------------------------------------------
    */

    let editorContainer:
        HTMLDivElement;

    let editor:
        monaco.editor.IStandaloneCodeEditor | null = null;


    /*
    |--------------------------------------------------------------------------
    | Prevent Save Loop
    |--------------------------------------------------------------------------
    |
    | true while Monaco is receiving content from the filesystem.
    |
    */

    let loadingFile = false;


    /*
    |--------------------------------------------------------------------------
    | Get Language
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
    | Load File Into Monaco
    |--------------------------------------------------------------------------
    */

    function loadFile(
        file: {
            name: string;
            path: string;
            content: string;
        } | null
    ) {

        console.log(
            "[EDITOR] loadFile:",
            file
        );


        if (!editor) {

            console.warn(
                "[EDITOR] Monaco editor not ready"
            );

            return;

        }


        if (!file) {

            loadingFile = true;

            editor.setValue("");

            loadingFile = false;

            return;

        }


        /*
        |--------------------------------------------------------------------------
        | Prevent onDidChangeModelContent from updating the store
        |--------------------------------------------------------------------------
        */

        loadingFile = true;


        /*
        |--------------------------------------------------------------------------
        | Set Content
        |--------------------------------------------------------------------------
        */

        editor.setValue(
            file.content
        );


        /*
        |--------------------------------------------------------------------------
        | Set Language
        |--------------------------------------------------------------------------
        */

        const model =
            editor.getModel();


        if (model) {

            monaco.editor.setModelLanguage(
                model,
                getLanguage(file.name)
            );

        }


        /*
        |--------------------------------------------------------------------------
        | Finish Loading
        |--------------------------------------------------------------------------
        */

        loadingFile = false;


        /*
        |--------------------------------------------------------------------------
        | Layout
        |--------------------------------------------------------------------------
        */

        requestAnimationFrame(() => {

            editor?.layout();

        });

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


        console.log(
            "[EDITOR] Closing:",
            path
        );


        closeFile(path);

    }


    /*
    |--------------------------------------------------------------------------
    | Create Monaco
    |--------------------------------------------------------------------------
    */

    onMount(() => {

        console.log(
            "[EDITOR] Creating Monaco..."
        );


        /*
        |--------------------------------------------------------------------------
        | Create Editor
        |--------------------------------------------------------------------------
        */

        editor =
            monaco.editor.create(
                editorContainer,
                {

                    value: "",

                    language: "plaintext",

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


        console.log(
            "[EDITOR] Monaco created"
        );


        /*
        |--------------------------------------------------------------------------
        | Monaco Content Changed
        |--------------------------------------------------------------------------
        */

        const contentDisposable =
            editor.onDidChangeModelContent(
                () => {

                    /*
                    |--------------------------------------------------------------------------
                    | Ignore changes caused by loadFile()
                    |--------------------------------------------------------------------------
                    */

                    if (loadingFile) {

                        console.log(
                            "[EDITOR] Ignoring programmatic change"
                        );

                        return;

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | Get Active File
                    |--------------------------------------------------------------------------
                    */

                    let currentFile:
                        typeof $activeFile;


                    activeFile.subscribe(
                        value => {

                            currentFile = value;

                        }
                    )();


                    if (!currentFile) {

                        return;

                    }


                    /*
                    |--------------------------------------------------------------------------
                    | Get New Content
                    |--------------------------------------------------------------------------
                    */

                    const content =
                        editor?.getValue() ?? "";


                    console.log(
                        "[EDITOR] Content changed:",
                        currentFile.path
                    );


                    /*
                    |--------------------------------------------------------------------------
                    | Update Store
                    |--------------------------------------------------------------------------
                    */

                    updateFileContent(
                        currentFile.path,
                        content
                    );

                }
            );


        /*
        |--------------------------------------------------------------------------
        | Active File Changed
        |--------------------------------------------------------------------------
        */

        const activeFileUnsubscribe =
            activeFile.subscribe(
                file => {

                    console.log(
                        "[EDITOR] Active file changed:",
                        file
                    );


                    loadFile(file);

                }
            );


        /*
        |--------------------------------------------------------------------------
        | Window Resize
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

            console.log(
                "[EDITOR] Destroying Monaco"
            );


            contentDisposable.dispose();


            activeFileUnsubscribe();


            window.removeEventListener(
                "resize",
                resize
            );


            editor?.dispose();

            editor = null;

        };

    });

</script>


<!--
|--------------------------------------------------------------------------
| Editor Layout
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
                    file.path === $activePath
                }
                role="tab"
                tabindex="0"
                onclick={() =>
                    activateFile(file.path)
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
    | Monaco Container
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
        max-width: 220px;

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
    | Close Button
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


    /*
    |--------------------------------------------------------------------------
    | Monaco
    |--------------------------------------------------------------------------
    */

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