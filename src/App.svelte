<script lang="ts">

    import FileExplorer
        from "./components/FileExplorer.svelte";


    import Editor
        from "./components/Editor.svelte";


    import Terminal
        from "./components/Terminal.svelte";


    /*
    |--------------------------------------------------------------------------
    | Terminal State
    |--------------------------------------------------------------------------
    */

    let terminalHeight = 250;

</script>


<div class="app">


    <!--
    |--------------------------------------------------------------------------
    | Sidebar
    |--------------------------------------------------------------------------
    -->

    <aside class="sidebar">

        <FileExplorer />

    </aside>


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
            style={`height: ${terminalHeight}px`}
        >

            <Terminal />

        </section>

    </main>

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

</style>