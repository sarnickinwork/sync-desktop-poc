import { useEffect } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export function useWindowPersistence() {
    useEffect(() => {
        const appWindow = getCurrentWindow();

        const saveState = async () => {
            try {
                const isMaximized = await appWindow.isMaximized();
                localStorage.setItem("windowState", isMaximized ? "maximized" : "normal");
            } catch (err) {
                console.error("Failed to save window state", err);
            }
        };

        const restoreState = async () => {
            try {
                const savedState = localStorage.getItem("windowState");
                if (savedState === "maximized") {
                    await appWindow.maximize();
                }
            } catch (err) {
                console.error("Failed to restore window state", err);
            }
        };

        // Restore on mount
        restoreState();

        // Listen to resize to update state
        // Note: unlisten is returned promise
        let unlistenResize: (() => void) | undefined;

        appWindow.listen("tauri://resize", saveState).then((unlisten) => {
            unlistenResize = unlisten;
        });

        return () => {
            if (unlistenResize) unlistenResize();
        };
    }, []);
}
