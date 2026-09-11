import { writable, get } from "svelte/store";

export type BottomPanelTab = "problems" | "terminal";

export const activeBottomTab = writable<BottomPanelTab>("terminal");
export const isBottomPanelVisible = writable<boolean>(false);
export const bottomPanelHeight = writable<number>(250);

export function openBottomPanel(tab: BottomPanelTab) {
    activeBottomTab.set(tab);
    isBottomPanelVisible.set(true);
}

export function toggleBottomPanel(tab?: BottomPanelTab) {
    const isVisible = get(isBottomPanelVisible);
    const currentTab = get(activeBottomTab);

    if (tab) {
        if (isVisible && currentTab === tab) {
            isBottomPanelVisible.set(false);
        } else {
            activeBottomTab.set(tab);
            isBottomPanelVisible.set(true);
        }
    } else {
        isBottomPanelVisible.update((v) => !v);
    }
}

export function closeBottomPanel() {
    isBottomPanelVisible.set(false);
}

export function setBottomPanelHeight(height: number) {
    const clamped = Math.max(120, Math.min(height, window.innerHeight * 0.8));
    bottomPanelHeight.set(clamped);
}
