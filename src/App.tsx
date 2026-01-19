import { useState, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Snackbar, Alert } from "@mui/material";

// Context
import { ColorModeContext } from "./themes/ThemeContext";

// Pages
import TranscriptionPage from "./pages/TranscriptionPage";

// Components
import UpdateDialog from "./components/UpdateDialog";

// Hooks
import { useAppUpdater } from "./hooks/useAppUpdater";

export default function App() {
  // 1. Initialize the Updater
  const {
    updateAvailable,
    updateInfo,
    isDownloading,
    downloadProgress,
    error,
    installUpdate,
    closeUpdateDialog,
    clearError,
  } = useAppUpdater();

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

        {/* Update Dialog */}
        <UpdateDialog
          open={updateAvailable}
          updateInfo={updateInfo}
          isDownloading={isDownloading}
          downloadProgress={downloadProgress}
          onConfirm={installUpdate}
          onCancel={closeUpdateDialog}
        />

        {/* Error Notification */}
        {error && (
          <Snackbar
            open={!!error}
            autoHideDuration={8000}
            onClose={clearError}
            anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
          >
            <Alert severity="error" variant="filled" onClose={clearError}>
              Update Error: {error}
            </Alert>
          </Snackbar>
        )}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
