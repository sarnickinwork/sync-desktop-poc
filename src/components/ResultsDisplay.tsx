import {
    Box,
    Typography,
    useTheme,
    alpha,
} from "@mui/material";

import SyncedPlayer from "./sync/SyncedPlayer";
import { MappedSentenceResult, VideoItem } from "../utils/types";

interface ResultsDisplayProps {
    mappedResults: MappedSentenceResult[];
    videos: VideoItem[];
    splitPoints: number[];
    apiElapsedTime?: number | null;
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

export default function ResultsDisplay({
    mappedResults,
    videos,
    splitPoints,
    apiElapsedTime,
}: ResultsDisplayProps) {
    const theme = useTheme();

    // Convert mappedResults to format expected by SyncedPlayer
    const lines = mappedResults.map(r => ({
        text: r.sentence,
        start: r.start,
        end: r.end
    }));

    // Aesthetics similar to TranscriptPreview
    const isDark = theme.palette.mode === 'dark';
    const listBgColor = isDark ? alpha(theme.palette.background.paper, 0.6) : '#fafafa';
    const borderColor = theme.palette.divider;

    return (
        <Box>
            {/* Split View: Video (Small Fixed Left) + Transcript List (Main Focus Right) */}
            <Box display="flex" gap={3} height="80vh">
                {/* Smaller Video Width - 200px */}
                <Box flex="0 0 200px">
                    <SyncedPlayer
                        videos={videos}
                        splitPoints={splitPoints}
                        lines={lines}
                        hideTranscript={true}
                    />
                </Box>

                {/* Results List - EXACT copy of TranscriptPreview structure */}
                <Box
                    sx={{
                        flex: 1,
                        border: 1,
                        borderColor: borderColor,
                        borderRadius: 2,
                        height: "100%",
                        overflowY: "auto",
                        overflowX: "auto", // Allow horizontal scroll if lines are long
                        bgcolor: listBgColor,
                        backdropFilter: isDark ? "blur(10px)" : "none",
                        color: theme.palette.text.primary,
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                        boxShadow: theme.shadows[1]
                    }}
                >
                    {/* Header - same as TranscriptPreview */}
                    <Box
                        sx={{
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: borderColor,
                            position: "sticky",
                            top: 0,
                            bgcolor: isDark ? theme.palette.background.paper : '#ffffff',
                            zIndex: 2,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
                        }}
                    >
                        <Typography variant="subtitle2" fontWeight={600} sx={{ letterSpacing: '0.5px' }}>
                            Mapped Transcript
                        </Typography>
                        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                            {mappedResults.length > 0
                                ? `${mappedResults.length} lines • Synced`
                                : "No lines"
                            }
                        </Typography>
                    </Box>

                    {/* Content area - same as TranscriptPreview */}
                    <Box sx={{ flexGrow: 1, p: 2, pb: 10 }}>
                        {mappedResults.map((result, index) => {
                            const confColor = result.confidence >= 80 ? theme.palette.success.main :
                                result.confidence >= 60 ? theme.palette.warning.main : theme.palette.error.main;

                            return (
                                <Box
                                    key={index}
                                    sx={{
                                        display: 'flex',
                                        position: 'relative',
                                        bgcolor: 'transparent',
                                        cursor: 'default',
                                        transition: 'background-color 0.15s ease',
                                        '&:hover': {
                                            bgcolor: alpha(theme.palette.text.primary, 0.05)
                                        },
                                        lineHeight: 1.6,
                                        minHeight: '1.6em',
                                        borderRadius: '2px',
                                        my: '1px',
                                        pl: 10  // Make room for timestamp overlay
                                    }}
                                >
                                    {/* Timestamp floating on the left - only show if > 0 */}
                                    {result.start > 0 && (
                                        <Typography
                                            component="span"
                                            sx={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                width: 80,
                                                color: 'primary.main',
                                                fontSize: '0.75rem',
                                                opacity: 0.7,
                                                userSelect: 'none',
                                                textAlign: 'right',
                                                pr: 1
                                            }}
                                        >
                                            {formatTime(result.start)}
                                        </Typography>
                                    )}

                                    {/* Original line text - NO WRAPPING */}
                                    <Typography
                                        component="pre"
                                        sx={{
                                            m: 0,
                                            fontFamily: 'inherit',
                                            fontSize: '0.9rem',
                                            whiteSpace: 'pre',  // No wrapping
                                            width: 'auto',
                                            minWidth: '100%',
                                            color: 'inherit',
                                            pr: 6  // Make room for confidence badge
                                        }}
                                    >
                                        {result.sentence || " "}
                                    </Typography>

                                    {/* Confidence - floating on the right - only show if > 0 */}
                                    {result.confidence > 0 && (
                                        <Typography
                                            component="span"
                                            sx={{
                                                position: 'absolute',
                                                right: 8,
                                                top: 0,
                                                color: alpha(confColor, 0.6),
                                                fontSize: '0.7rem',
                                                userSelect: 'none'
                                            }}
                                        >
                                            {result.confidence.toFixed(0)}%
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}
