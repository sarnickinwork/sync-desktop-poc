import { useState, useRef, useEffect } from 'react';
import { Box, Paper, Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, useTheme, Switch, FormControlLabel, Chip } from '@mui/material';
import { convertFileSrc } from '@tauri-apps/api/core';
import CircleIcon from '@mui/icons-material/Circle';
import { SmiSubtitle } from '../../utils/smiParsingUtils';
import { formatMs } from '../../utils';

type Props = {
    videoPath: string;
    subtitles: SmiSubtitle[];
    onUpdateSubtitles?: (updated: SmiSubtitle[]) => void;
};

// Start times are updated in edit mode.
// View mode: clicking row seeks video.
// Edit mode: clicking row selects it. Spacebar updates timestamp of selected row.

export default function EditorView({ videoPath, subtitles, onUpdateSubtitles }: Props) {
    const theme = useTheme();
    const videoSrc = convertFileSrc(videoPath);
    const videoRef = useRef<HTMLVideoElement>(null);

    const [currentTime, setCurrentTime] = useState(0);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

    // Update current time for highlighting and logic
    useEffect(() => {
        const video = videoRef.current;
        if (!video) return;

        const handleTimeUpdate = () => {
            setCurrentTime(video.currentTime * 1000); // Convert to ms
        };

        video.addEventListener('timeupdate', handleTimeUpdate);
        return () => video.removeEventListener('timeupdate', handleTimeUpdate);
    }, []);

    // Handle Spacebar in Edit Mode
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isEditMode || selectedIndex === null || !onUpdateSubtitles) return;

            if (e.code === 'Space') {
                // Prevent default scrolling usually associated with spacebar
                e.preventDefault();

                const newTime = currentTime;

                // Create a copy and update the specific subtitle
                const updated = [...subtitles];
                updated[selectedIndex] = {
                    ...updated[selectedIndex],
                    start: newTime
                };

                // Sort simply to keep time order (optional but good practice)
                // updated.sort((a, b) => a.start - b.start); 
                // Actually, user might jump back and forth, sorting might confuse selection index.
                // Let's keep index stable for now.

                onUpdateSubtitles(updated);

                // Optional: Toggle play/pause? Or just register time? 
                // User request: "when use clicks on the spacebar that video time gets registered"
                // Doesn't say stop/play. Default behavior of space usually play/pause, 
                // so we preventedDefault. Let's just update time.

                // Auto-advance selection?
                // setSelectedIndex(prev => (prev !== null && prev < subtitles.length - 1) ? prev + 1 : prev);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isEditMode, selectedIndex, currentTime, subtitles, onUpdateSubtitles]);


    const getConfidenceColor = (conf?: number) => {
        if (typeof conf === 'undefined') return 'success.main';
        // Confidence is stored as percentage (0-100), not 0-1
        if (conf >= 80) return 'success.main';
        if (conf >= 50) return 'warning.main';
        return 'error.main';
    };

    const formatConfidence = (conf?: number) => {
        if (typeof conf === 'undefined') return 'N/A';
        return `${conf.toFixed(1)}%`;
    };

    const handleRowClick = (index: number, start: number) => {
        if (isEditMode) {
            setSelectedIndex(index);
        } else {
            // Seek video
            if (videoRef.current) {
                videoRef.current.currentTime = start / 1000;
                videoRef.current.play();
            }
        }
    };

    return (
        <Box
            display="grid"
            gridTemplateColumns="1fr 1fr"
            gap={3}
            height="70vh"
            mt={2}
        >
            {/* LEFT: Video Player */}
            <Paper
                variant="outlined"
                sx={{
                    p: 2,
                    display: 'flex',
                    flexDirection: 'column',
                    bgcolor: 'black',
                    position: 'relative'
                }}
            >
                <video
                    ref={videoRef}
                    src={videoSrc}
                    controls // Always show controls so user can seek/play freely
                    controlsList="nodownload"
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
                {/* Simple Mode Indicator Overlay */}
                <Box position="absolute" top={16} left={16} zIndex={10}>
                    <Chip
                        label={isEditMode ? "EDIT MODE" : "VIEW MODE"}
                        color={isEditMode ? "error" : "default"}
                        size="small"
                    />
                </Box>
            </Paper>

            {/* RIGHT: Subtitle List */}
            <Paper
                variant="outlined"
                sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    overflow: 'hidden'
                }}
            >
                <Box p={2} borderBottom={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
                    <Box>
                        <Typography variant="h6">Subtitle Editor</Typography>
                        <Typography variant="caption" color="text.secondary">
                            {subtitles.length} lines • {isEditMode ? "Select row & hit Space to sync" : "Click row to seek"}
                        </Typography>
                    </Box>
                    <FormControlLabel
                        control={<Switch checked={isEditMode} onChange={(e) => setIsEditMode(e.target.checked)} />}
                        label="Edit Mode"
                    />
                </Box>

                <TableContainer sx={{ flexGrow: 1 }}>
                    <Table stickyHeader size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell style={{ width: 80 }}>Conf</TableCell>
                                <TableCell style={{ width: 100 }}>Start</TableCell>
                                <TableCell>Text</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {subtitles.map((sub, index) => {
                                const isActive = !isEditMode && (
                                    currentTime >= sub.start &&
                                    (subtitles[index + 1] ? currentTime < subtitles[index + 1].start : true)
                                );

                                const isSelected = isEditMode && selectedIndex === index;

                                return (
                                    <TableRow
                                        key={index}
                                        selected={isSelected || isActive}
                                        onClick={() => handleRowClick(index, sub.start)}
                                        sx={{
                                            cursor: 'pointer',
                                            ...(isSelected && {
                                                bgcolor: alpha(theme.palette.error.main, 0.1) + ' !important',
                                                borderLeft: `4px solid ${theme.palette.error.main}`
                                            }),
                                            ...(isActive && {
                                                bgcolor: alpha(theme.palette.primary.main, 0.1) + ' !important',
                                                borderLeft: `4px solid ${theme.palette.primary.main}`
                                            })
                                        }}
                                    >
                                        <TableCell>
                                            <Box display="flex" alignItems="center" gap={0.5}>
                                                <CircleIcon sx={{ fontSize: 10, color: getConfidenceColor(sub.confidence) }} />
                                                <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
                                                    {formatConfidence(sub.confidence)}
                                                </Typography>
                                            </Box>
                                        </TableCell>
                                        <TableCell sx={{ fontFamily: 'monospace' }}>
                                            {formatMs(sub.start)}
                                        </TableCell>
                                        <TableCell>{sub.text}</TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Paper>
        </Box>
    );
}
// Helper for alpha if not imported
import { alpha } from '@mui/material/styles';
