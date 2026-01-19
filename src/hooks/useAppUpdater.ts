import { useState, useEffect } from "react";
import { check, Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

interface UpdateInfo {
    version: string;
    currentVersion: string;
    body: string;
    date?: string;
}

interface UseAppUpdaterReturn {
    updateAvailable: boolean;
    updateInfo: UpdateInfo | null;
    isDownloading: boolean;
    downloadProgress: number;
    error: string | null;
    checkForUpdates: () => Promise<void>;
    installUpdate: () => Promise<void>;
    closeUpdateDialog: () => void;
    clearError: () => void;
}

export function useAppUpdater(): UseAppUpdaterReturn {
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isDownloading, setIsDownloading] = useState(false);
    const [downloadProgress, setDownloadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [pendingUpdate, setPendingUpdate] = useState<Update | null>(null);

    const checkForUpdates = async () => {
        try {
            console.log("Checking for updates...");
            setError(null);

            const update = await check();

            if (update) {
                console.log(`Update found: ${update.version}`, update);

                // Get current version from tauri.conf.json or package.json
                const currentVersion = "1.0.3"; // This should match your tauri.conf.json version

                setUpdateInfo({
                    version: update.version,
                    currentVersion: currentVersion,
                    body: update.body || "",
                    date: update.date,
                });

                setPendingUpdate(update);
                setUpdateAvailable(true);
            } else {
                console.log("No updates available. App is up to date.");
            }
        } catch (err) {
            let errorMessage = "Failed to check for updates";

            if (err instanceof Error) {
                errorMessage = err.message;
                console.error("Update check error:", err.message);
                console.error("Error stack:", err.stack);
            } else if (typeof err === 'string') {
                errorMessage = err;
            } else {
                console.error("Unknown error type:", err);
                errorMessage = JSON.stringify(err);
            }

            console.error("Error checking for updates:", errorMessage);

            // Don't show error to user if backend is just not available
            // This is normal in development or if the update server is down
            if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('ECONNREFUSED')) {
                console.warn("Update server not available - this is normal in development");
                setError(null); // Don't show error notification
            } else {
                setError(errorMessage);
            }
        }
    };

    const installUpdate = async () => {
        if (!pendingUpdate) {
            console.error("No pending update to install");
            return;
        }

        try {
            setIsDownloading(true);
            setDownloadProgress(0);

            console.log("Starting update download and installation...");

            let totalDownloaded = 0;
            const estimatedTotalSize = 10 * 1024 * 1024; // Estimate 10MB, adjust as needed

            // Download and install with progress tracking
            await pendingUpdate.downloadAndInstall((event) => {
                switch (event.event) {
                    case "Started":
                        console.log("Download started");
                        setDownloadProgress(0);
                        totalDownloaded = 0;
                        break;
                    case "Progress":
                        // event.data contains { chunkLength: number }
                        if (event.data && typeof event.data.chunkLength === 'number') {
                            totalDownloaded += event.data.chunkLength;
                            const progress = Math.min((totalDownloaded / estimatedTotalSize) * 100, 99);
                            console.log(`Download progress: ${progress.toFixed(2)}%`);
                            setDownloadProgress(progress);
                        }
                        break;
                    case "Finished":
                        console.log("Download finished");
                        setDownloadProgress(100);
                        break;
                }
            });

            console.log("Update installed successfully. Relaunching app...");

            // Relaunch the application
            await relaunch();
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : "Failed to install update";
            console.error("Error installing update:", err);
            setError(errorMessage);
            setIsDownloading(false);
        }
    };

    const closeUpdateDialog = () => {
        setUpdateAvailable(false);
        setUpdateInfo(null);
        setPendingUpdate(null);
        setIsDownloading(false);
        setDownloadProgress(0);
    };

    const clearError = () => {
        setError(null);
    };

    // Auto-check for updates on mount
    useEffect(() => {
        // Delay the check slightly to let the app fully initialize
        const timer = setTimeout(() => {
            checkForUpdates();
        }, 2000);

        return () => clearTimeout(timer);
    }, []);

    return {
        updateAvailable,
        updateInfo,
        isDownloading,
        downloadProgress,
        error,
        checkForUpdates,
        installUpdate,
        closeUpdateDialog,
        clearError,
    };
}
