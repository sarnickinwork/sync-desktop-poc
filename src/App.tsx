import { useState, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Snackbar, Alert } from "@mui/material";

// Context
import { ColorModeContext } from "./themes/ThemeContext";

// Pages
import TranscriptionPage from "./pages/TranscriptionPage";
import ImportEditPage from "./pages/ImportEditPage";

// ... imports ...

// Components
import UpdateDialog from "./components/UpdateDialog";

// Hooks
import { useAppUpdater } from "./hooks/useAppUpdater";
import { useWindowPersistence } from "./hooks/useWindowPersistence";

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

  // 1b. Initialize Window Persistence
  useWindowPersistence();

  // Navigation State
  const [currentPage, setCurrentPage] = useState<"home" | "import">("home");

  // 2. Theme State Management
  // Initialize from localStorage or default to light
  const [mode, setMode] = useState<"light" | "dark">(() => {
    const savedMode = localStorage.getItem("themeMode");
    return (savedMode === "dark" || savedMode === "light") ? savedMode : "light";
  });

  const colorMode = useMemo(
    () => ({
      mode,
      toggleColorMode: () => {
        setMode((prevMode) => {
          const newMode = prevMode === "light" ? "dark" : "light";
          localStorage.setItem("themeMode", newMode);
          return newMode;
        });
      },
    }),
    [mode]
  );

  const theme = useMemo(
    () =>
      createTheme({
        palette: {
          mode,
          primary: {
            main: "#0D9488", // Teal-600
            light: "#14B8A6", // Teal-500
            dark: "#0F766E", // Teal-700
          },
          secondary: {
            main: "#3B82F6", // Blue-500
          },
          success: {
            main: "#10B981", // Green-500
            light: "#34D399",
          },
          warning: {
            main: "#F59E0B", // Amber-500
          },
          error: {
            main: "#EF4444", // Red-500
          },
          info: {
            main: "#3B82F6",
          },
          background: {
            default: mode === "light" ? "#F9FAFB" : "#0F172A",
            paper: mode === "light" ? "#FFFFFF" : "#1E293B",
          },
          divider: mode === "light" ? "#E5E7EB" : "#334155",
        },
        typography: {
          fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
          h4: {
            fontWeight: 700,
          },
          h5: {
            fontWeight: 700,
          },
          h6: {
            fontWeight: 600,
          },
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                textTransform: 'none',
                fontWeight: 600,
                borderRadius: 8,
              },
              contained: {
                boxShadow: 'none',
                '&:hover': {
                  boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)',
                },
              },
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
              },
            },
          },
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {currentPage === "home" ? (
          <TranscriptionPage onNavigateToImport={() => setCurrentPage("import")} />
        ) : (
          <ImportEditPage onBack={() => setCurrentPage("home")} />
        )}

        {/* Update Dialog ... */}

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
