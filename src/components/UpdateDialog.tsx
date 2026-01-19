import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    Box,
    LinearProgress,
    Chip,
    useTheme,
    alpha,
} from "@mui/material";
import SystemUpdateIcon from "@mui/icons-material/SystemUpdate";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import NewReleasesIcon from "@mui/icons-material/NewReleases";

interface UpdateDialogProps {
    open: boolean;
    updateInfo: {
        version: string;
        currentVersion: string;
        body: string;
        date?: string;
    } | null;
    isDownloading: boolean;
    downloadProgress?: number;
    onConfirm: () => void;
    onCancel: () => void;
}

export default function UpdateDialog({
    open,
    updateInfo,
    isDownloading,
    downloadProgress = 0,
    onConfirm,
    onCancel,
}: UpdateDialogProps) {
    const theme = useTheme();

    if (!updateInfo) return null;

    return (
        <Dialog
            open={open}
            maxWidth="sm"
            fullWidth
            PaperProps={{
                sx: {
                    borderRadius: 3,
                    background: `linear-gradient(135deg, ${alpha(
                        theme.palette.primary.main,
                        0.05
                    )} 0%, ${alpha(theme.palette.background.paper, 1)} 100%)`,
                },
            }}
        >
            <DialogTitle>
                <Box display="flex" alignItems="center" gap={2}>
                    <NewReleasesIcon
                        sx={{ fontSize: 40, color: theme.palette.primary.main }}
                    />
                    <Box>
                        <Typography variant="h6" fontWeight={700}>
                            Update Available!
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                            A new version is ready to install
                        </Typography>
                    </Box>
                </Box>
            </DialogTitle>

            <DialogContent>
                <Box mb={3}>
                    <Box display="flex" gap={2} mb={2}>
                        <Chip
                            icon={<CheckCircleIcon />}
                            label={`Current: v${updateInfo.currentVersion}`}
                            color="default"
                            variant="outlined"
                        />
                        <Chip
                            icon={<SystemUpdateIcon />}
                            label={`New: v${updateInfo.version}`}
                            color="primary"
                            variant="filled"
                        />
                    </Box>

                    {updateInfo.date && (
                        <Typography variant="caption" color="text.secondary" display="block" mb={2}>
                            Released on {new Date(updateInfo.date).toLocaleDateString()}
                        </Typography>
                    )}
                </Box>

                <Box
                    p={2}
                    borderRadius={2}
                    bgcolor={alpha(theme.palette.background.default, 0.5)}
                    border={1}
                    borderColor="divider"
                >
                    <Typography variant="subtitle2" fontWeight={600} mb={1}>
                        Release Notes:
                    </Typography>
                    <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                            whiteSpace: "pre-wrap",
                            maxHeight: 200,
                            overflowY: "auto",
                        }}
                    >
                        {updateInfo.body || "• Bug fixes and improvements"}
                    </Typography>
                </Box>

                {isDownloading && (
                    <Box mt={3}>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                            <CloudDownloadIcon
                                sx={{
                                    color: theme.palette.info.main,
                                    animation: "bounce 1s ease-in-out infinite",
                                    "@keyframes bounce": {
                                        "0%, 100%": { transform: "translateY(0)" },
                                        "50%": { transform: "translateY(-4px)" },
                                    },
                                }}
                            />
                            <Typography variant="body2" color="info.main" fontWeight={600}>
                                Downloading update... {downloadProgress.toFixed(0)}%
                            </Typography>
                        </Box>
                        <LinearProgress
                            variant="determinate"
                            value={downloadProgress}
                            sx={{ height: 6, borderRadius: 3 }}
                        />
                    </Box>
                )}
            </DialogContent>

            <DialogActions sx={{ px: 3, pb: 3 }}>
                <Button
                    onClick={onCancel}
                    color="inherit"
                    disabled={isDownloading}
                    sx={{ borderRadius: 2 }}
                >
                    {isDownloading ? "Please Wait..." : "Later"}
                </Button>
                <Button
                    onClick={onConfirm}
                    variant="contained"
                    startIcon={<CloudDownloadIcon />}
                    disabled={isDownloading}
                    sx={{
                        px: 3,
                        borderRadius: 2,
                        fontWeight: 600,
                    }}
                >
                    {isDownloading ? "Installing..." : "Install Now"}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
