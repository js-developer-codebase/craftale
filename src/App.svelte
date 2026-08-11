<script lang="ts">

    import FileExplorer
        from "./components/FileExplorer.svelte";


    import Editor
        from "./components/Editor.svelte";

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
    | Main Editor
    |--------------------------------------------------------------------------
    -->

    <main class="main">

        <Editor />

    </main>

</div>


<style>

    :global(html),
    :global(body) {

        margin: 0;

        padding: 0;

        width: 100%;

        height: 100%;

        overflow: hidden;

        background: #1e1e1e;

    }


    :global(body) {

        font-family:
            -apple-system,
            BlinkMacSystemFont,
            "Segoe UI",
            sans-serif;

    }


    :global(*) {

        box-sizing: border-box;

    }


    .app {

        width: 100vw;

        height: 100vh;

        display: flex;

        overflow: hidden;

        background: #1e1e1e;

    }


    .sidebar {

        width: 280px;

        min-width: 200px;

        max-width: 500px;

        flex-shrink: 0;

        border-right: 1px solid #333333;

        overflow: hidden;

    }


    .main {

        flex: 1;

        min-width: 0;

        height: 100%;

        overflow: hidden;

    }

</style>