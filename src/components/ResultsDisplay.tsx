import {
    Box,
    Card,
    CardContent,
    Typography,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Chip,
    useTheme,
    alpha,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import TimerIcon from "@mui/icons-material/Timer";
import SyncedPlayer from "./sync/SyncedPlayer";
import { MappedSentenceResult, VideoItem } from "../utils/types";

interface ResultsDisplayProps {
    mappedResults: MappedSentenceResult[];
    videos: VideoItem[];
    splitPoints: number[];
    smiContent: string | null;
    dvtContent?: string | null;
    synContent?: string | null;
    apiElapsedTime?: number | null;
    onDownloadSMI: () => void;
    onDownloadDVT?: () => void;
    onDownloadSYN?: () => void;
}

/**
 * Format milliseconds to human-readable time (MM:SS.mmm)
 */
function formatTime(ms: number): string {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor(ms % 1000);

    return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

/**
 * Get confidence color based on confidence score
 */
function getConfidenceColor(confidence: number, theme: any): string {
    if (confidence >= 80) return theme.palette.success.main;
    if (confidence >= 60) return theme.palette.warning.main;
    return theme.palette.error.main;
}


export default function ResultsDisplay({
    mappedResults,
    videos,
    splitPoints,
    smiContent,
    dvtContent,
    synContent,
    apiElapsedTime,
    onDownloadSMI,
    onDownloadDVT,
    onDownloadSYN,
}: ResultsDisplayProps) {
    const theme = useTheme();

    const averageConfidence =
        mappedResults.length > 0
            ? mappedResults.reduce((sum, r) => sum + r.confidence, 0) / mappedResults.length
            : 0;

    const highConfCount = mappedResults.filter((r) => r.confidence >= 80).length;
    const mediumConfCount = mappedResults.filter((r) => r.confidence >= 60 && r.confidence < 80).length;
    const lowConfCount = mappedResults.filter((r) => r.confidence < 60).length;

    // Convert mappedResults to format expected by SyncedPlayer
    const lines = mappedResults.map(r => ({
        text: r.sentence,
        start: r.start,
        end: r.end
    }));

    return (
        <Box>
            {/* Summary Card */}
            <Card
                variant="outlined"
                sx={{
                    mb: 3,
                    background: `linear-gradient(135deg, ${alpha(
                        theme.palette.primary.main,
                        0.1
                    )} 0%, ${alpha(theme.palette.primary.main, 0.05)} 100%)`,
                    borderColor: theme.palette.primary.main,
                }}
            >
                <CardContent>
                    <Box display="flex" alignItems="center" gap={2} mb={2}>
                        <CheckCircleIcon
                            sx={{ fontSize: 40, color: theme.palette.success.main }}
                        />
                        <Box>
                            <Typography variant="h5" fontWeight={600}>
                                Processing Complete!
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                                {mappedResults.length} sentences mapped with{" "}
                                {averageConfidence.toFixed(1)}% average confidence
                            </Typography>
                        </Box>
                    </Box>

                    <Box display="flex" gap={2} flexWrap="wrap" mt={2}>
                        <Chip
                            icon={<CheckCircleIcon />}
                            label={`${highConfCount} High Confidence`}
                            color="success"
                            variant="outlined"
                        />
                        <Chip
                            icon={<WarningIcon />}
                            label={`${mediumConfCount} Medium Confidence`}
                            color="warning"
                            variant="outlined"
                        />
                        <Chip
                            icon={<WarningIcon />}
                            label={`${lowConfCount} Low Confidence`}
                            color="error"
                            variant="outlined"
                        />
                        {apiElapsedTime !== null && apiElapsedTime !== undefined && (
                            <Chip
                                icon={<TimerIcon />}
                                label={`API Response: ${(apiElapsedTime / 1000).toFixed(2)}s`}
                                color="info"
                                variant="filled"
                                sx={{ fontWeight: 600 }}
                            />
                        )}
                    </Box>

                    {(smiContent || dvtContent || synContent) && (
                        <Box mt={3} display="flex" gap={2} flexWrap="wrap">
                            {smiContent && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    startIcon={<DownloadIcon />}
                                    onClick={onDownloadSMI}
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: 2,
                                        fontWeight: 600,
                                    }}
                                >
                                    Download SMI Subtitle
                                </Button>
                            )}
                            {dvtContent && onDownloadDVT && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    color="secondary"
                                    startIcon={<DownloadIcon />}
                                    onClick={onDownloadDVT}
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: 2,
                                        fontWeight: 600,
                                    }}
                                >
                                    Download DVT File
                                </Button>
                            )}
                            {synContent && onDownloadSYN && (
                                <Button
                                    variant="contained"
                                    size="large"
                                    color="info"
                                    startIcon={<DownloadIcon />}
                                    onClick={onDownloadSYN}
                                    sx={{
                                        px: 4,
                                        py: 1.5,
                                        borderRadius: 2,
                                        fontWeight: 600,
                                    }}
                                >
                                    Download SYN File
                                </Button>
                            )}
                        </Box>
                    )}
                </CardContent>
            </Card>

            {/* Split View: Video (Left) + Table (Right) */}
            <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
                <Box>
                    <SyncedPlayer
                        videos={videos}
                        splitPoints={splitPoints}
                        lines={lines}
                        hideTranscript={true}
                    />
                </Box>

                {/* Results Table */}
                <Card variant="outlined" sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                    <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                        <Typography variant="h6" fontWeight={600} mb={2}>
                            Mapped Transcript
                        </Typography>

                        <TableContainer
                            component={Paper}
                            variant="outlined"
                            sx={{ flex: 1, maxHeight: 400 }} // Limit height to match video approx
                        >
                            <Table stickyHeader size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Sentence</TableCell>
                                        <TableCell sx={{ fontWeight: 600 }}>Conf</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {mappedResults.map((result, index) => (
                                        <TableRow
                                            key={index}
                                            hover
                                            sx={{
                                                "&:nth-of-type(odd)": {
                                                    backgroundColor: alpha(
                                                        theme.palette.primary.main,
                                                        0.02
                                                    ),
                                                },
                                            }}
                                        >
                                            <TableCell sx={{ whiteSpace: 'nowrap', fontFamily: "monospace", color: theme.palette.primary.main }}>
                                                {formatTime(result.start)}
                                            </TableCell>
                                            <TableCell>
                                                <Typography variant="body2">
                                                    {result.sentence}
                                                </Typography>
                                            </TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={`${result.confidence.toFixed(0)}%`}
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: alpha(
                                                            getConfidenceColor(result.confidence, theme),
                                                            0.1
                                                        ),
                                                        color: getConfidenceColor(result.confidence, theme),
                                                        borderColor: getConfidenceColor(result.confidence, theme),
                                                        height: 20,
                                                        fontSize: '0.75rem'
                                                    }}
                                                    variant="outlined"
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </CardContent>
                </Card>
            </Box>
        </Box>
    );
}
