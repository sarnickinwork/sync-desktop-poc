import { useState, useEffect, useRef } from 'react';
import { Box, Typography, Button, IconButton, Alert, Paper, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestartAltIcon from '@mui/icons-material/RestartAlt';

import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudDoneIcon from '@mui/icons-material/CloudDone';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { readTextFile, writeTextFile, exists } from '@tauri-apps/plugin-fs';
import { join, dirname } from '@tauri-apps/api/path';
import { open } from '@tauri-apps/plugin-dialog';

import EditorView from '../components/import/EditorView';
import ThemeToggle from '../components/ThemeToggle';
import { SmiSubtitle } from '../utils/smiParsingUtils';
import { parseSYN, SynData } from '../utils/synParsingUtils';
import { generateSMI, generateDVT, generateSYN } from '../utils';

type Props = {
    onBack: () => void;
};

export default function ImportEditPage({ onBack }: Props) {
    const [synFilePath, setSynFilePath] = useState<string | null>(null);
    const [parsedSubtitles, setParsedSubtitles] = useState<SmiSubtitle[]>([]);
    const [originalSynData, setOriginalSynData] = useState<SynData | null>(null);
    const [isParsing, setIsParsing] = useState(false);

    const [parsingError, setParsingError] = useState<string | null>(null);
    const [splitPoints, setSplitPoints] = useState<number[]>([]);
    const [videoItems, setVideoItems] = useState<{ id: string; path: string; name: string }[]>([]);


    // Auto-save debounce timer
    const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'editing' | 'saving' | 'saved'>('idle');

    // Handle .syn file selection
    const handleSelectSynFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'SYN Files',
                    extensions: ['syn']
                }]
            });

            if (!selected || typeof selected !== 'string') return;

            setSynFilePath(selected);
            await loadSynFile(selected);
        } catch (err: any) {
            console.error("File selection error:", err);
            setParsingError(err.message || 'Failed to select file');
        }
    };

    // Load and parse .syn file
    const loadSynFile = async (filePath: string) => {
        setIsParsing(true);
        setParsingError(null);

        try {
            // Parse .syn file
            const content = await readTextFile(filePath);
            const syn = parseSYN(content);
            setOriginalSynData(syn);

            // Validate required metadata
            if (!syn.video?.path) {
                throw new Error("SYN file missing video path metadata");
            }
            if (!syn.subtitle?.path) {
                throw new Error("SYN file missing subtitle path metadata");
            }

            // Get directory of .syn file to resolve relative paths
            const synDir = await dirname(filePath);

            // Resolve video path (handle both relative and absolute)
            let videoPath = syn.video.path;
            if (!videoPath.includes(':') && !videoPath.startsWith('/')) {
                // Relative path - resolve from .syn directory
                videoPath = await join(synDir, videoPath);
            }

            // Verify video file exists
            const videoExists = await exists(videoPath);
            if (!videoExists) {
                throw new Error(`Video file not found at: ${videoPath}`);
            }

            // Load subtitles from .syn synchronization data
            // Filter out empty lines and page numbers to avoid duplicate timestamps
            const subs: SmiSubtitle[] = syn.synchronization.sentences
                .filter(s => {
                    const cleanText = (s.text || "").trim();
                    // Remove completely empty lines only
                    if (cleanText.length === 0) return false;
                    return true;
                })
                .map(s => ({
                    start: s.start,
                    end: s.end,
                    text: s.text,
                    confidence: s.confidence
                }))
                .sort((a, b) => a.start - b.start); // Sort by start time to ensure correct page order
            setParsedSubtitles(subs);

            // Setup video items
            const videoItem = {
                id: syn.video.filename,
                path: videoPath,
                name: syn.video.filename
            };
            setVideoItems([videoItem]);

            // Calculate video duration for split points
            const duration = await getVideoDuration(videoPath);
            setSplitPoints([duration]);

        } catch (err: any) {
            console.error("Parsing failed:", err);
            setParsingError(err.message || 'Failed to parse .syn file');
            setSynFilePath(null);
            setParsedSubtitles([]);
            setOriginalSynData(null);
            setVideoItems([]);
            setSplitPoints([]);
        } finally {
            setIsParsing(false);
        }
    };

    // Helper to get video duration
    const getVideoDuration = (path: string): Promise<number> => {
        return new Promise((resolve, reject) => {
            const video = document.createElement('video');
            video.preload = 'metadata';
            video.onloadedmetadata = () => {
                const duration = video.duration * 1000;
                resolve(duration);
            };
            video.onerror = () => reject("Failed to load video metadata");
            import('@tauri-apps/api/core').then(({ convertFileSrc }) => {
                video.src = convertFileSrc(path);
            });
        });
    };

    // Auto-save handler with 10-second debounce
    const handleUpdateSubtitles = (updated: SmiSubtitle[]) => {
        setParsedSubtitles(updated);

        // Set editing status
        setAutoSaveStatus('editing');

        // Clear existing timer
        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        // Set new timer for 10 seconds
        autoSaveTimerRef.current = setTimeout(() => {
            handleSave(updated, true); // true = auto-save mode
        }, 10000); // 10 seconds
    };

    // Cleanup timer on unmount
    useEffect(() => {
        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, []);

    const handleSave = async (subtitlesToSave?: SmiSubtitle[], isAutoSave = false) => {
        const subs = subtitlesToSave || parsedSubtitles;
        if (!synFilePath || !originalSynData || subs.length === 0) return;

        if (isAutoSave) {

            setAutoSaveStatus('saving');
        } else {

        }

        try {
            const synDir = await dirname(synFilePath);

            // Resolve paths
            let videoPath = originalSynData.video.path;
            let smiPath = originalSynData.subtitle?.path;

            if (!videoPath.includes(':') && !videoPath.startsWith('/')) {
                videoPath = await join(synDir, videoPath);
            }
            if (smiPath && !smiPath.includes(':') && !smiPath.startsWith('/')) {
                smiPath = await join(synDir, smiPath);
            }

            if (!smiPath) {
                throw new Error("SMI path not found in .syn metadata");
            }

            // First pass: Calculate page and line numbers
            let currentPage = 1;
            let currentLine = 0;
            let foundExplicitPageStart = false;

            // Prepare sentences with page/line numbers and proper end times
            const mappedSentences = subs.map((sub, i) => {
                let end = sub.end;
                if (!end) {
                    const nextSub = parsedSubtitles[i + 1];
                    end = nextSub ? nextSub.start : sub.start + 2000;
                }

                const text = sub.text || "";
                const trimmed = text.trim();

                // PAGE NUMBER DETECTION (matches logic in courtTranscriptParser)
                // Check for single isolated number which acts as page header
                const pageMatch = /^[\s\t]*(\d{1,4})[\s\t]*$/.exec(trimmed);
                if (pageMatch) {
                    const potentialPageNum = parseInt(pageMatch[1]);
                    // Accept as new page if it's 1, or sequential (approx next page)
                    if (potentialPageNum === 1 || (potentialPageNum >= currentPage && potentialPageNum < currentPage + 10)) {
                        currentPage = potentialPageNum;
                        currentLine = 0;
                        foundExplicitPageStart = true;
                    }
                }

                // Increment line number for every line (including headers, often headers are line 0 or 1, 
                // but standard DVT expects lines. We will assign line 0 for header or just increment)
                // Actually, for DVT, if it's a page header, DVT generator ignores it later.
                // But for SYN, we want valid metadata.
                
                // If this is NOT a page header, increment line count
                if (!pageMatch) {
                    currentLine++;
                    
                    // Fallback pagination if no headers seen for a long time (25 lines/page default)
                    if (!foundExplicitPageStart && currentLine > 25) {
                        currentPage++;
                        currentLine = 1;
                    }
                }

                return {
                    sentence: sub.text,
                    text: sub.text,
                    start: sub.start,
                    end: end,
                    confidence: sub.confidence || 1.0,
                    pageNumber: currentPage,
                    lineNumber: pageMatch ? 0 : currentLine // Use 0 for page headers
                };
            });

            // Generate & Write SMI
            const smiContent = generateSMI(mappedSentences);
            await writeTextFile(smiPath, smiContent);

            // Generate & Write DVT
            const videoName = originalSynData.video.filename;
            const rawName = videoName.replace(/\.[^/.]+$/, "").trim();

            const dvtContent = generateDVT({
                title: `Deposition - ${videoName}`,
                videoFilename: videoName,
                videoPath: originalSynData.video.path,
                duration: mappedSentences[mappedSentences.length - 1].end,
                createdDate: new Date().toISOString(),
                sentences: mappedSentences
            });
            const dvtPath = await join(synDir, `${rawName}.dvt`);
            await writeTextFile(dvtPath, dvtContent);

            // Update SYN file
            const synContent = generateSYN({
                videoFilename: videoName,
                videoPath: originalSynData.video.path,
                videoDuration: mappedSentences[mappedSentences.length - 1].end,
                subtitleFilename: originalSynData.subtitle?.filename || 'subtitles.smi',
                subtitlePath: originalSynData.subtitle?.path || 'media/subtitles.smi',
                transcriptFilename: originalSynData.transcript?.filename || 'transcript.txt',
                transcriptPath: originalSynData.transcript?.path || 'transcription/transcript.txt',
                startLine: originalSynData.transcript?.startLine || 0,
                sentences: mappedSentences
            });
            await writeTextFile(synFilePath, synContent);

            console.log("✓ Save successful!");

        } catch (err: any) {
            console.error("Save failed:", err);
            if (!isAutoSave) {
                console.error(`Failed to save package: ${err.message}`);
            }
        } finally {
            if (isAutoSave) {
                setAutoSaveStatus('saved');
                // Reset to idle after 3 seconds
                setTimeout(() => setAutoSaveStatus('idle'), 3000);
                console.log('✓ Auto-saved successfully');
                setAutoSaveStatus('idle'); // Just reset status?
            } else {
                // Was setIsSaving(false)
            }
        }
    };

    const handleReset = () => {
        setSynFilePath(null);
        setParsedSubtitles([]);
        setOriginalSynData(null);
        setSplitPoints([]);
        setVideoItems([]);
        setParsingError(null);
    };

    const showEditor = synFilePath && videoItems.length > 0 && parsedSubtitles.length > 0 && splitPoints.length > 0;

    return (
        <Box p={4} maxWidth={showEditor ? '100%' : 1100} mx="auto">
            {/* HEADER */}
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={4}
            >
                <Box display="flex" alignItems="center" gap={2}>
                    <IconButton onClick={onBack}>
                        <ArrowBackIcon />
                    </IconButton>
                    <Typography variant="h5" fontWeight={600}>
                        Import & Edit Project
                    </Typography>
                </Box>
                <Box display="flex" gap={2}>
                    <ThemeToggle />
                </Box>
            </Box>

            {/* MAIN CONTENT */}
            {!synFilePath ? (
                /* STEP 1: SELECT .SYN FILE */
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="50vh">
                    <Paper
                        elevation={3}
                        sx={{
                            p: 6,
                            textAlign: 'center',
                            maxWidth: 500,
                            border: '2px dashed',
                            borderColor: 'divider'
                        }}
                    >
                        <UploadFileIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />
                        <Typography variant="h6" gutterBottom fontWeight={600}>
                            Select .syn Project File
                        </Typography>
                        <Typography variant="body2" color="text.secondary" mb={3}>
                            Choose a .syn file to load the video and transcript with timestamps
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            onClick={handleSelectSynFile}
                            disabled={isParsing}
                        >
                            {isParsing ? 'Loading...' : 'Select .syn File'}
                        </Button>

                        {parsingError && (
                            <Alert severity="error" sx={{ mt: 3 }}>
                                {parsingError}
                            </Alert>
                        )}
                    </Paper>
                </Box>
            ) : (
                /* STEP 2: EDITOR VIEW */
                <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                        <Box display="flex" alignItems="center" gap={2}>
                            <Typography variant="h6" color="primary">
                                {videoItems[0]?.name}
                            </Typography>

                            {/* Google Docs-style Auto-save Indicator */}
                            {autoSaveStatus !== 'idle' && (
                                <Box 
                                    display="flex" 
                                    alignItems="center" 
                                    gap={0.5}
                                    sx={{ 
                                        color: autoSaveStatus === 'saved' ? 'success.main' : 'text.secondary',
                                        transition: 'color 0.3s ease'
                                    }}
                                >
                                    {autoSaveStatus === 'editing' && (
                                        <>
                                            <CloudDoneIcon sx={{ fontSize: 18, opacity: 0.7 }} />
                                            <Typography variant="caption" sx={{ opacity: 0.7 }}>
                                                Saving...
                                            </Typography>
                                        </>
                                    )}
                                    {autoSaveStatus === 'saving' && (
                                        <>
                                            <CircularProgress size={14} thickness={5} />
                                            <Typography variant="caption">
                                                Saving...
                                            </Typography>
                                        </>
                                    )}
                                    {autoSaveStatus === 'saved' && (
                                        <>
                                            <CheckCircleIcon sx={{ fontSize: 20, color: 'success.main' }} />
                                            <Typography variant="caption" fontWeight={600} color="success.main">
                                                Saved
                                            </Typography>
                                        </>
                                    )}
                                </Box>
                            )}
                        </Box>

                        <Button
                            variant="outlined"
                            color="inherit"
                            startIcon={<RestartAltIcon />}
                            onClick={handleReset}
                        >
                            Select Different File
                        </Button>
                    </Box>

                    {isParsing ? (
                        <Box display="flex" justifyContent="center" p={4}>
                            <CircularProgress />
                        </Box>
                    ) : showEditor ? (
                        <EditorView
                            videos={videoItems}
                            splitPoints={splitPoints}
                            subtitles={parsedSubtitles}
                            onUpdateSubtitles={handleUpdateSubtitles}
                        />
                    ) : (
                        <Alert severity="warning">
                            Unable to load editor. Please check the .syn file format.
                        </Alert>
                    )}
                </Box>
            )}
        </Box>
    );
}
