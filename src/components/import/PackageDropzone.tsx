import { Box, Typography, Button, Paper, useTheme, alpha } from '@mui/material';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import UploadFileIcon from '@mui/icons-material/UploadFile';

type Props = {
    onImport: () => void;
    isLoading: boolean;
};

export default function PackageDropzone({ onImport, isLoading }: Props) {
    const theme = useTheme();

    return (
        <Paper
            variant="outlined"
            sx={{
                p: 6,
                textAlign: 'center',
                cursor: 'pointer',
                border: '2px dashed',
                borderColor: 'text.secondary',
                borderRadius: 4,
                bgcolor: alpha(theme.palette.background.paper, 0.5),
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: alpha(theme.palette.primary.main, 0.05),
                    transform: 'scale(1.01)',
                },
            }}
            onClick={!isLoading ? onImport : undefined}
        >
            <Box
                display="flex"
                flexDirection="column"
                alignItems="center"
                gap={2}
            >
                <Box
                    sx={{
                        p: 2,
                        borderRadius: '50%',
                        bgcolor: alpha(theme.palette.primary.main, 0.1),
                        color: 'primary.main',
                    }}
                >
                    {isLoading ? (
                        <UploadFileIcon sx={{ fontSize: 48, animation: 'pulse 1s infinite' }} />
                    ) : (
                        <FolderOpenIcon sx={{ fontSize: 48 }} />
                    )}
                </Box>

                <Box>
                    <Typography variant="h5" fontWeight={600} gutterBottom>
                        Import Project Package
                    </Typography>
                    <Typography color="text.secondary">
                        Click to select a project folder containing a 'media' directory
                    </Typography>
                </Box>

                <Button
                    variant="contained"
                    size="large"
                    startIcon={<FolderOpenIcon />}
                    disabled={isLoading}
                    sx={{ mt: 2, borderRadius: 2, px: 4 }}
                >
                    {isLoading ? 'Scanning...' : 'Select Folder'}
                </Button>
            </Box>
        </Paper>
    );
}
