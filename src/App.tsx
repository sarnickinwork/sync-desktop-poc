import { useEffect, useState, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";

// Updater Imports
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

// Context
import { ColorModeContext } from "./themes/ThemeContext";

// Pages
import TranscriptionPage from "./pages/TranscriptionPage";

/**
 * Custom Hook: useAppUpdater
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
  // 1. Initialize the Updater
  useAppUpdater();

  // 2. Theme State Management
  const [mode, setMode] = useState<"light" | "dark">("light");

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prevMode) => (prevMode === "light" ? "dark" : "light"));
      },
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: { main: "#1976d2" },
          // We define specific background colors to ensure contrast in both modes
          background: {
            default: mode === "light" ? "#f4f6f8" : "#121212",
            paper: mode === "light" ? "#ffffff" : "#1e1e1e",
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <TranscriptionPage />
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
