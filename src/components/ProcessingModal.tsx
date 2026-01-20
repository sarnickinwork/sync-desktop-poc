import { Box, Modal, Typography, LinearProgress, keyframes } from "@mui/material";
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

const rotate = keyframes`
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(180deg);
  }
`;

type Props = {
    open: boolean;
    logs: string[];
    progress?: number;
};

export default function ProcessingModal({ open, logs, progress = 0 }: Props) {
    const latestLog = logs[logs.length - 1] || "Processing...";

    return (
        <Modal
            open={open}
            sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
        >
            <Box
                sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    boxShadow: 24,
                    p: 5,
                    minWidth: 400,
                    maxWidth: 500,
                    textAlign: 'center',
                    outline: 'none'
                }}
            >
                {/* Hourglass Animation */}
                <Box
                    sx={{
                        display: 'inline-flex',
                        animation: `${rotate} 2s ease-in-out infinite`,
                        mb: 3
                    }}
                >
                    <HourglassEmptyIcon
                        sx={{
                            fontSize: 64,
                            color: 'primary.main',
                            filter: 'drop-shadow(0 4px 8px rgba(13, 148, 136, 0.3))'
                        }}
                    />
                </Box>

                <Typography variant="h5" fontWeight={700} gutterBottom>
                    Processing Your Project
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {latestLog}
                </Typography>

                <LinearProgress
                    variant={progress > 0 ? "determinate" : "indeterminate"}
                    value={progress}
                    sx={{
                        height: 8,
                        borderRadius: 4,
                        bgcolor: 'action.hover',
                        '& .MuiLinearProgress-bar': {
                            background: 'linear-gradient(90deg, #0D9488 0%, #14B8A6 100%)',
                            borderRadius: 4
                        }
                    }}
                />

                {progress > 0 && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        {Math.round(progress)}% Complete
                    </Typography>
                )}
            </Box>
        </Modal>
    );
}
