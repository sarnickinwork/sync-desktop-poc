import {
    Box,
    Typography,
    useTheme,
    alpha,
    CircularProgress,
} from "@mui/material";
import { useState, useRef, useEffect, useMemo } from "react";

import SyncedPlayer from "./sync/SyncedPlayer";
import { MappedSentenceResult, VideoItem } from "../utils/types";
import { parseSYNForLineInfo, parseSYNForLineInfoByTime, enrichWithLineNumbers } from "../utils/dvtParser";

interface ResultsDisplayProps {
    mappedResults: MappedSentenceResult[];
    videos: VideoItem[];
    splitPoints: number[];
    apiElapsedTime?: number | null;
    synContent?: string | null;
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
    synContent
}: ResultsDisplayProps) {
    const theme = useTheme();

    // Enrich results with Page/Line info or calculate fallback
    const enrichedResults = useMemo(() => {
        let results = mappedResults;

        if (synContent) {
            try {
                const lineInfoMap = parseSYNForLineInfo(synContent);
                const timeInfoMap = parseSYNForLineInfoByTime(synContent);
                results = enrichWithLineNumbers(mappedResults, lineInfoMap, timeInfoMap) as MappedSentenceResult[];
            } catch (e) {
                console.error("Error enriching results:", e);
                results = mappedResults;
            }
        }

        // Filter out completely blank lines that are not in transcript (ghost lines)
        return results.filter(r => r.sentence && r.sentence.trim().length > 0);
    }, [mappedResults, synContent]);

    // Infinite Scroll State - Start with enough lines to fill viewport
    const [displayedCount, setDisplayedCount] = useState(200);
    const observerTarget = useRef<HTMLDivElement>(null);

    // Convert enrichedResults to format expected by SyncedPlayer
    const lines = enrichedResults.map(r => ({
        text: r.text || r.sentence, // Use clean text (no speaker labels)
        start: r.start,
        end: r.end
    }));

    // Infinite Scroll Observer
    useEffect(() => {
        const observer = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting) {
                    setDisplayedCount((prev) => Math.min(prev + 100, enrichedResults.length));
                }
            },
            { threshold: 0.1 }
        );

        if (observerTarget.current) {
            observer.observe(observerTarget.current);
        }

        return () => observer.disconnect();
    }, [enrichedResults.length]);

    const visibleResults = enrichedResults.slice(0, displayedCount);

    // Calculate summary statistics
    const avgConfidence = enrichedResults.length > 0
        ? enrichedResults.reduce((sum, r) => sum + (r.confidence || 0), 0) / enrichedResults.length
        : 0;

    const highConfidenceCount = enrichedResults.filter(r => r.confidence >= 80).length;
    const mediumConfidenceCount = enrichedResults.filter(r => r.confidence >= 50 && r.confidence < 80).length;
    const lowConfidenceCount = enrichedResults.filter(r => r.confidence < 50).length;

    // Aesthetics matching TranscriptPreview
    const isDark = theme.palette.mode === 'dark';
    const listBgColor = isDark ? alpha(theme.palette.background.paper, 0.6) : '#fafafa';
    const headerColor = isDark ? theme.palette.background.paper : '#ffffff';
    const borderColor = theme.palette.divider;

    return (
        <Box>
            {/* Vertical Layout: Video on Top + Transcript Below (full width) */}
            <Box display="flex" flexDirection="column" gap={3}>
                {/* Video Section - Fixed height, centered */}
                <Box
                    sx={{
                        height: '400px',
                        display: 'flex',
                        justifyContent: 'center',
                        width: '100%'
                    }}
                >
                    <Box sx={{ width: '400px', height: '100%' }}>
                        <SyncedPlayer
                            videos={videos}
                            splitPoints={splitPoints}
                            lines={lines}
                            hideTranscript={true}
                        />
                    </Box>
                </Box>

                {/* Results List - Matching TranscriptPreview structure EXACTLY */}
                <Box
                    sx={{
                        height: "50vh",
                        minHeight: "300px",
                        border: 1,
                        borderColor: borderColor,
                        borderRadius: 2,
                        overflowY: "auto",
                        overflowX: "auto",
                        bgcolor: listBgColor,
                        backdropFilter: isDark ? "blur(10px)" : "none",
                        color: theme.palette.text.primary,
                        display: "flex",
                        flexDirection: "column",
                        fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
                        boxShadow: theme.shadows[1]
                    }}
                >
                    {/* Header - Matching TranscriptPreview */}
                    <Box
                        sx={{
                            px: 2,
                            py: 1.5,
                            borderBottom: 1,
                            borderColor: borderColor,
                            position: "sticky",
                            top: 0,
                            bgcolor: headerColor,
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
                        <Box display="flex" gap={2} alignItems="center">
                            <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
                                {enrichedResults.length > 0
                                    ? `${enrichedResults.length} lines • Avg: ${avgConfidence.toFixed(0)}%`
                                    : "No lines"
                                }
                            </Typography>
                            <Box display="flex" gap={1}>
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: alpha(theme.palette.success.main, 0.8),
                                        title: `${highConfidenceCount} high confidence`
                                    }}
                                />
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: alpha(theme.palette.warning.main, 0.8),
                                        title: `${mediumConfidenceCount} medium confidence`
                                    }}
                                />
                                <Box
                                    sx={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: '50%',
                                        bgcolor: alpha(theme.palette.error.main, 0.8),
                                        title: `${lowConfidenceCount} low confidence`
                                    }}
                                />
                            </Box>
                        </Box>
                    </Box>

                    {/* Content area - Matching TranscriptPreview */}
                    <Box sx={{ flexGrow: 1, p: 2, pb: 10 }}>
                        {visibleResults.map((result, index) => {
                            let rowBgColor = 'transparent';
                            let indicatorColor = theme.palette.success.main;
                            // Check if line is just a page number (digits only)
                            const isPageNumLine = /^\d+$/.test((result.sentence || "").trim());
                            const hasTimestamp = result.start > 0 && !isPageNumLine;

                            if (hasTimestamp) {
                                if (result.confidence < 50) {
                                    indicatorColor = theme.palette.error.main;
                                } else if (result.confidence < 80) {
                                    indicatorColor = theme.palette.warning.main;
                                }
                                // High confidence keeps default success color
                            } else {
                                indicatorColor = 'transparent'; // No indicator line
                            }

                            return (
                                <Box
                                    key={index}
                                    sx={{
                                        display: 'flex',
                                        position: 'relative',
                                        bgcolor: rowBgColor,
                                        cursor: 'default',
                                        transition: 'background-color 0.15s ease, filter 0.15s ease',
                                        '&:hover': {
                                            filter: 'brightness(0.95)'
                                        },
                                        lineHeight: 1.6,
                                        minHeight: '1.6em',
                                        borderRadius: '2px',
                                        my: '4px',
                                        pl: 12 // Room for Time (80px) + spacing
                                    }}
                                >
                                    {/* Confidence Indicator Bar (Left edge) - only if hasTimestamp */}
                                    {hasTimestamp && (
                                        <Box
                                            sx={{
                                                position: 'absolute',
                                                left: 0,
                                                top: 0,
                                                bottom: 0,
                                                width: '3px',
                                                bgcolor: indicatorColor,
                                                opacity: 0.6,
                                                borderTopLeftRadius: '2px',
                                                borderBottomLeftRadius: '2px',
                                                transition: 'opacity 0.15s ease'
                                            }}
                                        />
                                    )}

                                    {/* Timestamp (Left) */}
                                    <Typography
                                        component="span"
                                        sx={{
                                            position: 'absolute',
                                            left: 0,
                                            top: 0,
                                            width: 80,
                                            color: 'primary.main',
                                            fontSize: '0.75rem',
                                            opacity: hasTimestamp ? 0.8 : 0, // Hidden if no timestamp
                                            userSelect: 'none',
                                            textAlign: 'right',
                                            pr: 1,
                                            pl: 0.5
                                        }}
                                    >
                                        {hasTimestamp ? formatTime(result.start) : ""}
                                    </Typography>

                                    {/* Original line text */}
                                    <Typography
                                        component="pre"
                                        sx={{
                                            m: 0,
                                            fontFamily: 'inherit',
                                            fontSize: '0.9rem',
                                            whiteSpace: 'pre-wrap',
                                            width: 'auto',
                                            minWidth: '100%',
                                            color: 'inherit',
                                            pr: 6,
                                            pl: 1
                                        }}
                                    >
                                        {result.sentence || " "}
                                    </Typography>

                                    {/* Confidence Badge (Right) */}
                                    {result.confidence > 0 && (
                                        <Typography
                                            component="span"
                                            sx={{
                                                position: 'absolute',
                                                right: 8,
                                                top: 0,
                                                color: indicatorColor,
                                                fontSize: '0.7rem',
                                                fontWeight: 600,
                                                opacity: 0.7,
                                                userSelect: 'none'
                                            }}
                                        >
                                            {result.confidence.toFixed(0)}%
                                        </Typography>
                                    )}
                                </Box>
                            );
                        })}

                        {/* Scroll Target - Matching TranscriptPreview */}
                        {displayedCount < enrichedResults.length && (
                            <Box ref={observerTarget} py={3} textAlign="center" sx={{ opacity: 0.5 }}>
                                <CircularProgress size={20} thickness={4} />
                            </Box>
                        )}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
}