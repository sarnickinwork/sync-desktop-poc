import { useState, useEffect } from 'react';
import { Box, Typography, Button, IconButton, Alert, Container, Tooltip, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import { join } from '@tauri-apps/api/path';

import PackageDropzone from '../components/import/PackageDropzone';
import MediaFilesList from '../components/import/MediaFilesList';
import EditorView from '../components/import/EditorView';
import { usePackageImport } from '../hooks/usePackageImport';
import ThemeToggle from '../components/ThemeToggle';
import { parseSMI, SmiSubtitle } from '../utils/smiParsingUtils';
import { parseSYN, SynData } from '../utils/synParsingUtils';
import { generateSMI, generateDVT, generateSYN } from '../utils';

type Props = {
    onBack: () => void;
};

export default function ImportEditPage({ onBack }: Props) {
    const {
        projectPath,
        mediaFiles,
        isLoading,
        error,
        importPackage,
        clearImport,
    } = usePackageImport();

    const [parsedSubtitles, setParsedSubtitles] = useState<SmiSubtitle[]>([]);
    const [originalSynData, setOriginalSynData] = useState<SynData | null>(null);
    const [isParsing, setIsParsing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [parsingError, setParsingError] = useState<string | null>(null);

    // Parse files when media files change
    useEffect(() => {
        const loadFiles = async () => {
            if (mediaFiles.length === 0) {
                setParsedSubtitles([]);
                return;
            }

            setIsParsing(true);
            setParsingError(null);

            try {
                // Priority 1: .syn file (Root of project or passing in mediaFiles if scanner found it)
                const synFile = mediaFiles.find(f => f.type === 'syn');
                if (synFile) {
                    const content = await readTextFile(synFile.path);
                    const syn = parseSYN(content);
                    setOriginalSynData(syn);

                    const subs: SmiSubtitle[] = syn.synchronization.sentences.map(s => ({
                        start: s.start,
                        end: s.end,
                        text: s.text,
                        confidence: s.confidence
                    }));
                    setParsedSubtitles(subs);
                    return;
                }

                // Priority 2: .smi file (Media folder)
                const smiFile = mediaFiles.find(f => f.type === 'smi');
                if (smiFile) {
                    const content = await readTextFile(smiFile.path);
                    const subs = parseSMI(content);
                    setParsedSubtitles(subs);
                    // Can't set originalSynData as we don't have it
                    return;
                }

                setParsedSubtitles([]);

            } catch (err: any) {
                console.error("Parsing failed:", err);
                setParsingError(err.message || 'Failed to parse project files');
            } finally {
                setIsParsing(false);
            }
        };

        loadFiles();
    }, [mediaFiles]);

    const handleSave = async () => {
        if (!projectPath || parsedSubtitles.length === 0) return;

        setIsSaving(true);
        try {
            const mp4File = mediaFiles.find(f => f.type === 'mp4');
            const smiFile = mediaFiles.find(f => f.type === 'smi');

            if (!mp4File || !smiFile) throw new Error("Missing video or subtitle file for export");

            // 1. Prepare Data
            // We need end times. If loading from SMI, end might be missing. 
            // We can infer end from next start, or default duration.
            const mappedSentences = parsedSubtitles.map((sub, i) => {
                let end = sub.end;
                if (!end) {
                    const nextSub = parsedSubtitles[i + 1];
                    if (nextSub) {
                        end = nextSub.start; // Seamless join
                    } else {
                        end = sub.start + 2000; // Default 2s for last line
                    }
                }
                return {
                    sentence: sub.text,
                    start: sub.start,
                    end: end,
                    confidence: sub.confidence || 1.0
                };
            });

            // 2. Generate & Write SMI (Overwrite existing)
            // We generate new SMI content regardless of original source being SMI or SYN
            // to ensure updates are reflected.
            const smiContent = generateSMI(mappedSentences);
            await writeTextFile(smiFile.path, smiContent);

            // 3. Generate & Write DVT (Overwrite/Create at root)
            const videoName = mp4File.name;
            const rawName = videoName.replace(/\.[^/.]+$/, "").trim();

            const dvtContent = generateDVT({
                title: `Deposition - ${videoName}`,
                videoFilename: videoName,
                videoPath: `media/${videoName}`,
                duration: mappedSentences[mappedSentences.length - 1].end,
                createdDate: new Date().toISOString(),
                sentences: mappedSentences
            });
            const dvtPath = await join(projectPath, `${rawName}.dvt`);
            await writeTextFile(dvtPath, dvtContent);

            // 4. Generate & Update SYN (Overwrite/Create at root)
            // Preserve original metadata if possible
            const synContent = generateSYN({
                videoFilename: videoName,
                videoPath: `media/${videoName}`,
                videoDuration: mappedSentences[mappedSentences.length - 1].end,
                subtitleFilename: smiFile.name,
                subtitlePath: `media/${smiFile.name}`,
                transcriptFilename: originalSynData?.transcript?.filename || 'transcript.txt',
                transcriptPath: originalSynData?.transcript?.path || 'transcription/transcript.txt',
                startLine: originalSynData?.transcript?.startLine || 0,
                sentences: mappedSentences
            });
            const synPath = await join(projectPath, `${rawName}.syn`);
            await writeTextFile(synPath, synContent);

            console.log("Save successful!");
            alert("Package updated successfully!");

        } catch (err: any) {
            console.error("Save failed:", err);
            alert(`Failed to save package: ${err.message}`);
        } finally {
            setIsSaving(false);
        }
    };

    const mp4File = mediaFiles.find(f => f.type === 'mp4');
  
    const showEditor = projectPath && mp4File && parsedSubtitles.length > 0;

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
                    {showEditor && (
                        <Button
                            variant="contained"
                            color="secondary"
                            startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveAltIcon />}
                            onClick={handleSave}
                            disabled={isSaving}
                        >
                            {isSaving ? "Saving..." : "Save Package"}
                        </Button>
                    )}
                    <ThemeToggle />
                </Box>
            </Box>

            {/* MAIN CONTENT */}
            <Container maxWidth={showEditor ? false : "md"} disableGutters>
                {!projectPath ? (
                    /* STEP 1: IMPORT */
                    <Box>
                        <PackageDropzone onImport={importPackage} isLoading={isLoading} />

                        {error && (
                            <Alert severity="error" sx={{ mt: 3 }}>
                                {error}
                            </Alert>
                        )}
                    </Box>
                ) : (
                    /* STEP 2: DISPLAY FILES OR EDITOR */
                    <Box>
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6" color="primary">
                                {showEditor ? `Editing: ${mp4File?.name}` : 'Package Loaded'}
                            </Typography>
                            <Tooltip title="Reset / Import Different Package">
                                <Button
                                    variant="outlined"
                                    color="inherit"
                                    startIcon={<RestartAltIcon />}
                                    onClick={() => {
                                        setParsedSubtitles([]);
                                        setOriginalSynData(null);
                                        clearImport();
                                    }}
                                >
                                    Reset
                                </Button>
                            </Tooltip>
                        </Box>

                        {/* Error handling for parsing */}
                        {parsingError && (
                            <Alert severity="warning" sx={{ mb: 2 }}>{parsingError}</Alert>
                        )}

                        {isParsing ? (
                            <Box display="flex" justifyContent="center" p={4}>
                                <CircularProgress />
                            </Box>
                        ) : showEditor ? (
                            /* EDITOR VIEW */
                            <EditorView
                                videoPath={mp4File!.path}
                                subtitles={parsedSubtitles}
                                onUpdateSubtitles={setParsedSubtitles}
                            />
                        ) : (
                            /* FILE LIST VIEW (Fallback) */
                            <>
                                <MediaFilesList mediaFiles={mediaFiles} projectPath={projectPath} />

                                {mediaFiles.length === 0 && (
                                    <Alert severity="warning" sx={{ mt: 3 }}>
                                        No supported media files (.mp4, .smi, .syn) found in the project.
                                    </Alert>
                                )}
                                {(!mp4File || parsedSubtitles.length === 0) && mediaFiles.length > 0 && (
                                    <Alert severity="info" sx={{ mt: 3 }}>
                                        To enable the editor, the package must contain a video (.mp4) and subtitle data (.smi or .syn).
                                    </Alert>
                                )}
                            </>
                        )}
                    </Box>
                )}
            </Container>
        </Box>
    );
}
