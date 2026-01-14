import { useEffect } from "react";
// Updater Imports (From your branch)
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// UI Import (From friend's branch)
import TranscriptionPage from "./pages/TranscriptionPage";

/**
 * Custom Hook: useAppUpdater
 * Handles checking for updates on mount and managing the update flow.
 */
function useAppUpdater() {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          console.log(`Found update: ${update.version}`);
          const yes = await window.confirm(
            `Update to ${update.version} is available!\n\nRelease notes: ${update.body}\n\nInstall now?`
          );
          
          if (yes) {
            await update.downloadAndInstall();
            // Restart the app after install
            await relaunch();
          }
        } else {
            console.log("No updates found.");
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    };

    checkForUpdates();
  }, []);
}

export default function App() {
  // 1. Initialize the Updater (Your Logic)
  useAppUpdater();

  // 2. Render the Refactored UI (Friend's Logic)
  return <TranscriptionPage />;
}