import { Box, Card, CardContent, Typography, Chip, Divider } from "@mui/material";
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import SpeedIcon from '@mui/icons-material/Speed';

type Props = {
    videoCount: number;
    totalDuration: number; // in seconds
    sentenceCount: number;
    avgConfidence: number;
    processingTime: number; // in ms
    estimatedCost: number; // in USD
};

export default function JobSummaryCard({
    videoCount,
    totalDuration,
    sentenceCount,
    avgConfidence,
    processingTime,
    estimatedCost
}: Props) {

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const kpis = [
        {
            label: "Aligned",
            value: sentenceCount,
            color: "#0D9488"
        },
        {
            label: "Avg. Confidence",
            value: `${avgConfidence.toFixed(1)}%`,
            color: "#3B82F6"
        },
        {
            label: "Videos",
            value: videoCount,
            color: "#8B5CF6"
        },
        {
            label: "Processing Time",
            value: `${(processingTime / 1000).toFixed(1)}s`,
            color: "#F59E0B"
        }
    ];

    return (
        <Card
            elevation={0}
            sx={{
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                overflow: 'visible'
            }}
        >
            <CardContent sx={{ p: 3 }}>
                <Box display="flex" alignItems="center" justifyContent="space-between" mb={3}>
                    <Box>
                        <Typography variant="h5" fontWeight={700} gutterBottom>
                            Job Summary
                        </Typography>
                        <Chip
                            icon={<CheckCircleIcon />}
                            label="Alignment Complete"
                            color="success"
                            size="small"
                            sx={{ fontWeight: 600 }}
                        />
                    </Box>

                    {/* Cost Badge */}
                    <Box
                        sx={{
                            background: 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
                            borderRadius: 3,
                            p: 2.5,
                            color: 'white',
                            minWidth: 140,
                            textAlign: 'center',
                            boxShadow: '0 4px 12px rgba(13, 148, 136, 0.3)'
                        }}
                    >
                        <AttachMoneyIcon sx={{ fontSize: 28, mb: 0.5 }} />
                        <Typography variant="h4" fontWeight={800}>
                            ${estimatedCost.toFixed(2)}
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.9 }}>
                            Estimated Cost
                        </Typography>
                    </Box>
                </Box>

                <Divider sx={{ my: 2 }} />

                {/* Key Performance Indicators */}
                <Typography variant="subtitle2" color="text.secondary" fontWeight={600} mb={2}>
                    Key Performance Indicators
                </Typography>

                <Box display="grid" gridTemplateColumns="repeat(4, 1fr)" gap={2} sx={{ mb: 3 }}>
                    {kpis.map((kpi, idx) => (
                        <Box
                            key={idx}
                            sx={{
                                p: 2,
                                borderRadius: 2,
                                bgcolor: 'action.hover',
                                textAlign: 'center',
                                border: '1px solid',
                                borderColor: 'divider'
                            }}
                        >
                            <Typography
                                variant="h4"
                                fontWeight={700}
                                sx={{ color: kpi.color }}
                            >
                                {kpi.value}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                {kpi.label}
                            </Typography>
                        </Box>
                    ))}
                </Box>

                {/* Additional Details */}
                <Box display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
                    <Box display="flex" alignItems="center" gap={1}>
                        <AccessTimeIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                            Total Duration: <strong>{formatDuration(totalDuration)}</strong>
                        </Typography>
                    </Box>
                    <Box display="flex" alignItems="center" gap={1}>
                        <SpeedIcon fontSize="small" color="action" />
                        <Typography variant="body2" color="text.secondary">
                            Processing Speed: <strong>{(totalDuration / (processingTime / 1000)).toFixed(1)}x</strong>
                        </Typography>
                    </Box>
                </Box>

                {/* Pricing Note */}
                <Box
                    sx={{
                        mt: 3,
                        p: 2,
                        bgcolor: 'action.hover',
                        borderRadius: 2,
                        border: '1px solid',
                        borderColor: 'divider'
                    }}
                >
                    <Typography variant="caption" color="text.secondary">
                        💡 <strong>Cost Breakdown:</strong> AssemblyAI charges $0.00025 per second of audio.
                        This estimate is based on {totalDuration}s of total audio across {videoCount} video(s).
                    </Typography>
                </Box>
            </CardContent>
        </Card>
    );
}
