/*
|--------------------------------------------------------------------------
| Navigation & History Store
|--------------------------------------------------------------------------
| Manages location history (back/forward), MRU file tracking,
| Quick Open palette visibility, active symbols, and Ctrl+Tab switcher.
|--------------------------------------------------------------------------
*/

import { writable, derived, get } from "svelte/store";
import type { DocumentSymbolItem } from "../utils/symbols";
import { pathsEqual } from "./workspace";

/*
|--------------------------------------------------------------------------
| Navigation History (Back / Forward)
|--------------------------------------------------------------------------
*/

export interface LocationEntry {
    path: string;
    line: number;
    column: number;
    timestamp: number;
    label?: string;
}

export const backStack = writable<LocationEntry[]>([]);
export const forwardStack = writable<LocationEntry[]>([]);

export const canNavigateBack = derived(backStack, (s) => s.length > 0);
export const canNavigateForward = derived(forwardStack, (s) => s.length > 0);

const MAX_HISTORY = 50;

/**
 * Record a location before or during a significant jump.
 */
export function recordNavigationPoint(point: {
    path: string;
    line: number;
    column: number;
    label?: string;
}) {

    if (!point.path) return;

    backStack.update((stack) => {

        const last = stack[stack.length - 1];

        /* Skip duplicate or nearly identical consecutive positions */
        if (
            last &&
            pathsEqual(last.path, point.path) &&
            Math.abs(last.line - point.line) < 4
        ) {
            return stack;
        }

        const next = [
            ...stack,
            {
                ...point,
                timestamp: Date.now()
            }
        ];

        if (next.length > MAX_HISTORY) {
            return next.slice(next.length - MAX_HISTORY);
        }

        return next;

    });

    /* Clear forward stack when user initiates a new manual jump */
    forwardStack.set([]);

}

/**
 * Pop previous location from backStack and return it.
 * Pushes currentLocation into forwardStack.
 */
export function stepBack(currentLocation?: { path: string; line: number; column: number }): LocationEntry | null {

    const back = get(backStack);

    if (back.length === 0) return null;

    const target = back[back.length - 1];

    backStack.set(back.slice(0, -1));

    if (currentLocation) {

        forwardStack.update((f) => [
            ...f,
            {
                ...currentLocation,
                timestamp: Date.now()
            }
        ]);

    }

    return target;

}

/**
 * Pop next location from forwardStack and return it.
 * Pushes currentLocation into backStack.
 */
export function stepForward(currentLocation?: { path: string; line: number; column: number }): LocationEntry | null {

    const fwd = get(forwardStack);

    if (fwd.length === 0) return null;

    const target = fwd[fwd.length - 1];

    forwardStack.set(fwd.slice(0, -1));

    if (currentLocation) {

        backStack.update((b) => [
            ...b,
            {
                ...currentLocation,
                timestamp: Date.now()
            }
        ]);

    }

    return target;

}

/*
|--------------------------------------------------------------------------
| MRU (Most Recently Used) File History
|--------------------------------------------------------------------------
*/

export const mruFiles = writable<string[]>([]);

export function recordFileAccess(path: string) {

    if (!path) return;

    mruFiles.update((list) => {

        const filtered = list.filter((p) => !pathsEqual(p, path));

        return [path, ...filtered].slice(0, 50);

    });

}

export function removeFileFromMRU(path: string) {

    mruFiles.update((list) => list.filter((p) => !pathsEqual(p, path)));

}

/*
|--------------------------------------------------------------------------
| Quick Open State
|--------------------------------------------------------------------------
*/

export type QuickOpenMode = "file" | "line" | "symbol";

export interface QuickOpenState {
    visible: boolean;
    mode: QuickOpenMode;
    initialQuery: string;
}

export const quickOpenState = writable<QuickOpenState>({
    visible: false,
    mode: "file",
    initialQuery: ""
});

export function openQuickOpen(mode: QuickOpenMode = "file", initialQuery = "") {

    quickOpenState.set({
        visible: true,
        mode,
        initialQuery
    });

}

export function closeQuickOpen() {

    quickOpenState.update((s) => ({ ...s, visible: false }));

}

/*
|--------------------------------------------------------------------------
| Active Document Symbols & Enclosing Symbol
|--------------------------------------------------------------------------
*/

export const activeDocumentSymbols = writable<DocumentSymbolItem[]>([]);

export const currentEnclosingSymbol = writable<DocumentSymbolItem | null>(null);

/*
|--------------------------------------------------------------------------
| File History Switcher (Ctrl + Tab) State
|--------------------------------------------------------------------------
*/

export interface FileSwitcherState {
    visible: boolean;
    selectedIndex: number;
    files: string[];
}

export const fileSwitcherState = writable<FileSwitcherState>({
    visible: false,
    selectedIndex: 0,
    files: []
});

export function openFileSwitcher(files: string[], startIndex = 1) {

    if (files.length <= 1) return;

    fileSwitcherState.set({
        visible: true,
        selectedIndex: Math.min(startIndex, files.length - 1),
        files
    });

}

export function cycleFileSwitcher(direction: 1 | -1) {

    fileSwitcherState.update((state) => {

        if (!state.visible || state.files.length === 0) return state;

        const count = state.files.length;

        const next = (state.selectedIndex + direction + count) % count;

        return {
            ...state,
            selectedIndex: next
        };

    });

}

export function closeFileSwitcher(): string | null {

    const state = get(fileSwitcherState);

    if (!state.visible) return null;

    const selectedPath = state.files[state.selectedIndex] ?? null;

    fileSwitcherState.set({
        visible: false,
        selectedIndex: 0,
        files: []
    });

    return selectedPath;

}

/*
|--------------------------------------------------------------------------
| Jump Request Store (Editor Navigation Target)
|--------------------------------------------------------------------------
*/

export interface JumpRequest {
    path?: string;
    line: number;
    column?: number;
    length?: number;
    preview?: boolean;
    timestamp: number;
}

export const jumpRequest = writable<JumpRequest | null>(null);

export function requestJump(
    line: number,
    column = 1,
    path?: string,
    preview = false,
    length?: number
) {

    jumpRequest.set({
        path,
        line,
        column,
        length,
        preview,
        timestamp: Date.now()
    });

}


/*
|--------------------------------------------------------------------------
| Sidebar View State (Activity Bar)
|--------------------------------------------------------------------------
*/

export type SidebarView = "explorer" | "search";

export const activeSidebarView = writable<SidebarView>("explorer");
export const isSidebarVisible = writable<boolean>(true);

export function toggleSidebarView(view: SidebarView) {

    const current = get(activeSidebarView);
    const visible = get(isSidebarVisible);

    if (current === view && visible) {
        isSidebarVisible.set(false);
    } else {
        activeSidebarView.set(view);
        isSidebarVisible.set(true);
    }

}

export function openSidebarView(view: SidebarView) {

    activeSidebarView.set(view);
    isSidebarVisible.set(true);

}


