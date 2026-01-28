import { useState, useMemo } from "react";
import { ThemeProvider, createTheme } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import { Snackbar, Alert, Box, Typography } from "@mui/material";
import VerifiedIcon from '@mui/icons-material/Verified';

// Context
import { ColorModeContext } from "./themes/ThemeContext";

// Pages
import TranscriptionPage from "./pages/TranscriptionPage";
import ImportEditPage from "./pages/ImportEditPage";
import LandingPage from "./components/landing/LandingPage";

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
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<"landing" | "project" | "import">("landing");

  // Handler to open a project
  const handleOpenProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentPage("project");
  }

  // Handler to go home
  const handleGoHome = () => {
    setCurrentProjectId(null);
    setCurrentPage("landing");
  }

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
            dark: "#059669",
          },
          warning: {
            main: "#F59E0B", // Amber-500
            light: "#FBBF24",
            dark: "#D97706",
          },
          error: {
            main: "#EF4444", // Red-500
            light: "#F87171",
            dark: "#B91C1C",
          },
          info: {
            main: "#3B82F6",
            light: "#60A5FA",
            dark: "#2563EB",
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
          button: {
            textTransform: 'none',
            fontWeight: 600,
          }
        },
        shape: {
          borderRadius: 12,
        },
        components: {
          MuiButton: {
            styleOverrides: {
              root: {
                borderRadius: 8,
              },
              contained: ({ ownerState }) => ({
                ...(ownerState.color === 'primary' && {
                  background: 'linear-gradient(45deg, #0D9488 30%, #3B82F6 90%)',
                  color: 'white',
                  boxShadow: mode === 'light' ? '0 4px 14px 0 rgba(13, 148, 136, 0.3)' : '0 3px 5px 2px rgba(13, 148, 136, .3)',
                  '&:hover': {
                    background: 'linear-gradient(45deg, #0F766E 30%, #2563EB 90%)',
                    boxShadow: '0 6px 12px 4px rgba(13, 148, 136, .4)',
                    transform: 'translateY(-1px)',
                  },
                }),
              }),
            },
          },
          MuiCard: {
            styleOverrides: {
              root: {
                borderRadius: 12,
                boxShadow: mode === 'light' ? '0 2px 8px rgba(0,0,0,0.05)' : '0 2px 8px rgba(0,0,0,0.2)',
              },
            },
          },
          MuiDialog: {
            styleOverrides: {
              paper: {
                borderRadius: 16
              }
            }
          }
        },
      }),
    [mode]
  );

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        <Box display="flex" flexDirection="column" minHeight="100vh">
          <Box component="main" flexGrow={1}>
            {currentPage === "landing" && (
              <LandingPage
                onProjectSelect={handleOpenProject}
                onNavigateToImport={() => setCurrentPage("import")}
              />
            )}

            {currentPage === "project" && currentProjectId && (
              <TranscriptionPage
                projectId={currentProjectId}
                onBackToHome={handleGoHome}
              />
            )}

            {currentPage === "import" && (
              <ImportEditPage onBack={handleGoHome} />
            )}

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
                sx={{ mb: 4 }}
              >
                <Alert severity="error" variant="filled" onClose={clearError}>
                  Update Error: {error}
                </Alert>
              </Snackbar>
            )}
          </Box>

          {/* FOOTER */}
          <Box
            component="footer"
            py={3}
            textAlign="center"
            bgcolor={mode === "light" ? "grey.50" : "grey.900"}
            borderTop={1}
            borderColor="divider"
            mt="auto"
          >
            <Typography variant="body2" color="text.secondary" display="flex" alignItems="center" justifyContent="center" gap={0.5}>
              © {new Date().getFullYear()} SyncExpress Live. Developed by{" "}
              <Typography component="span" fontWeight="bold" color="primary">
                Kaustubh Paul
              </Typography>{" "}
              and{" "}
              <Typography component="span" fontWeight="bold" color="primary">
                Sarnick Chakraborty
              </Typography>
              <VerifiedIcon color="primary" fontSize="small" sx={{ width: 16, height: 16 }} />
            </Typography>
          </Box>
        </Box>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
