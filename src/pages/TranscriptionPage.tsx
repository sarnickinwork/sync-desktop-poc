import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Button,
  Alert,
  AlertTitle,
  Card,
  CardContent,
  Chip,
  CircularProgress,
} from "@mui/material";
import { join } from "@tauri-apps/api/path";
import { writeTextFile, copyFile, readTextFile } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";

// Icons
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import WarningIcon from "@mui/icons-material/Warning";
import TimerIcon from "@mui/icons-material/Timer";
import SaveAltIcon from "@mui/icons-material/SaveAlt";

// Components
import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";
import TranscriptUploadCard from "../components/upload/TranscriptUploadCard";
import VideoUploadCard from "../components/upload/VideoUploadCard";
import SyncedPlayer from "../components/sync/SyncedPlayer";
import ThemeToggle from "../components/ThemeToggle";
import EditorView from "../components/import/EditorView";
import ResultsDisplay from "../components/ResultsDisplay";
import JobSummaryCard from "../components/JobSummaryCard";

import { useTranscriptionWorkflow } from "../hooks/useTranscriptionWorkflow";
import { SmiSubtitle } from "../utils/smiParsingUtils";
import { VideoItem } from "../utils/types";

type SyncedLine = {
  text: string;
  start: number;
  end: number;
};


// --- HELPER: Local Fallback Generator ---
const generateSamiContent = (lines: SmiSubtitle[], title: string) => {
  const bodyContent = lines
    .map((line) => {
      const startMs = Math.round(line.start);
      return `    <SYNC Start=${startMs}>\n      <P Class=ENCC>${line.text}</P>\n    </SYNC>`;
    })
    .join("\n");

  return `<SAMI>
<HEAD>
<TITLE>${title}</TITLE>
<STYLE TYPE="text/css">
</STYLE>
</HEAD>
<BODY>
${bodyContent}
</BODY>
</SAMI>`;
};

type Props = {
  onNavigateToImport?: () => void;
};

export default function TranscriptionPage({ onNavigateToImport }: Props) {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);
  const [transcriptFileName, setTranscriptFileName] = useState<string | null>(null);
  const [transcriptPath, setTranscriptPath] = useState<string | null>(null);
  const [resumeData, setResumeData] = useState<any>(null);

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [startLine, setStartLine] = useState<string>("");

  // --- SESSION RECOVERY ---
  useEffect(() => {
    const loadSession = async () => {
      const saved = localStorage.getItem("lastSession");
      if (saved) {
        try {
          const data = JSON.parse(saved);
          // Only offer resume if we have valid videos
          if (data.videos && data.videos.length > 0) {
            setResumeData(data);
          }
        } catch (e) {
          console.error("Failed to parse saved session", e);
        }
      }
    };
    loadSession();
  }, []);

  const saveSession = (vids: VideoItem[], tPath: string | null, sLine: string) => {
    localStorage.setItem("lastSession", JSON.stringify({
      videos: vids.map(v => ({ path: v.path, name: v.name })),
      transcriptPath: tPath,
      startLine: sLine,
      date: new Date().toISOString()
    }));
  };

  const {
    logs,
    isProcessing,
    error,
    transcriptResult,
    mappedResult,
    apiElapsedTime,
    projectFolderPath,
    handleWorkflow,
  } = useTranscriptionWorkflow();

  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [editedSubtitles, setEditedSubtitles] = useState<SmiSubtitle[]>([]);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [liveElapsedTime, setLiveElapsedTime] = useState<number>(0);

  // Initialize editedSubtitles from mappedResult
  useEffect(() => {
    if (mappedResult && mappedResult.length > 0) {
      setEditedSubtitles(
        mappedResult.map((r) => ({
          text: r.sentence,
          start: r.start,
          end: r.end,
          confidence: r.confidence,
        }))
      );
    }
  }, [mappedResult]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    if (isProcessing) {
      const startTime = Date.now();
      setLiveElapsedTime(0);
      intervalId = setInterval(() => {
        setLiveElapsedTime(Date.now() - startTime);
      }, 100);
    } else {
      setLiveElapsedTime(0);
      if (intervalId) clearInterval(intervalId);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [isProcessing]);

  // Auto-export when results are ready
  const [hasAutoExported, setHasAutoExported] = useState(false);

  useEffect(() => {
    if (step === 3 && !isProcessing && mappedResult && !hasAutoExported) {
      console.log("Auto-exporting results...");
      handleExportZip();
      setHasAutoExported(true);
    }
  }, [step, isProcessing, mappedResult, hasAutoExported]);

  function processAssemblyResult(apiResult: any) {
    if (!apiResult) return;

    let allWords: any[] = [];
    let currentOffset = 0;
    const splits: number[] = [];

    // Handle array vs single object
    const chunks = Array.isArray(apiResult) ? apiResult : [apiResult];

    chunks.forEach((chunk: any) => {
      if (!chunk.words) return;

      let lastWordEnd = 0;
      chunk.words.forEach((w: any) => {
        allWords.push({
          text: w.text,
          start: w.start + currentOffset,
          end: w.end + currentOffset,
          confidence: w.confidence
        });
        if (w.end > lastWordEnd) lastWordEnd = w.end;
      });

      currentOffset += lastWordEnd;
      splits.push(currentOffset);
    });

    setSplitPoints(splits);

    // Generate sentences from merged words
    const sentences: SyncedLine[] = [];
    let currentSentenceWords: string[] = [];
    let startTime: number | null = null;

    allWords.forEach((word: any) => {
      if (startTime === null) startTime = word.start;
      currentSentenceWords.push(word.text);
      if (/[.!?]$/.test(word.text)) {
        sentences.push({
          text: currentSentenceWords.join(" "),
          start: startTime!,
          end: word.end,
        });
        currentSentenceWords = [];
        startTime = null;
      }
    });

    if (currentSentenceWords.length > 0 && startTime !== null) {
      sentences.push({
        text: currentSentenceWords.join(" "),
        start: startTime,
        end: allWords[allWords.length - 1].end,
      });
    }

    setSyncedLines(sentences);
  }

  // --- RUST-BASED EXPORT ---
  const handleExportZip = async () => {
    // Prefer edited subtitles if available (from mappedResult flow)
    // otherwise fallback to syncedLines (simple assemblyAI result flow without mapping)
    const dataToExport =
      editedSubtitles.length > 0
        ? editedSubtitles
        : syncedLines.map(sl => ({
          text: sl.text,
          start: sl.start,
          end: sl.end,
          confidence: 1.0
        } as SmiSubtitle));

    if (videos.length === 0 || dataToExport.length === 0) {
      alert("No synced data available to export.");
      return;
    }

    if (!projectFolderPath) {
      alert("Project folder not found. Please run the workflow first.");
      return;
    }

    // Use first video for naming conventions
    const primaryVideo = videos[0];

    try {
      setIsExporting(true);

      // 1. Prepare Paths
      const rawProjectName = primaryVideo.name.replace(/\.[^/.]+$/, "").trim();
      const finalTranscriptFileName = transcriptFileName || "transcript.txt";

      // 2. Prepare Content

      // A. SAMI Content
      // Always regenerate to reflect edits
      const finalSamiContent = generateSamiContent(dataToExport, rawProjectName);

      // B. Transcript Content
      const finalTxtContent = transcriptText
        ? transcriptText
        : dataToExport.map((l) => l.text).join(" ");

      // C. DVT Content
      // Always regenerate if we have edited subtitles to ensure sync
      let finalDvtContent = null; // Reset to force regeneration based on latest edits

      // ... unless we want to use the hook's content safely? 
      // Actually, if user edited, hook's content is stale.
      // So let's just regenerate.

      if (!finalDvtContent) {
        const { generateDVT } = await import("../utils/dvtGenerationUtils");
        const sentencesForDVT = dataToExport.map((line) => ({
          sentence: line.text, // SmiSubtitle has 'text', Mapped has 'sentence'
          start: line.start,
          end: line.end || (line.start + 2000), // Safety for missing end
          confidence: line.confidence || 1.0,
        }));
        finalDvtContent = generateDVT({
          title: `Deposition - ${rawProjectName}`,
          videoFilename: primaryVideo.name,
          videoPath: `media/${primaryVideo.name}`,
          duration: dataToExport[dataToExport.length - 1]?.end || 0,
          createdDate: new Date().toISOString(),
          sentences: sentencesForDVT,
        });
      }

      // D. SYN Content
      let finalSynContent = null; // Force regeneration

      if (!finalSynContent) {
        const { generateSYN } = await import("../utils/synGenerationUtils");
        const sentencesForSYN = dataToExport.map((line) => ({
          sentence: line.text,
          start: line.start,
          end: line.end || (line.start + 2000),
          confidence: line.confidence || 1.0,
        }));
        finalSynContent = generateSYN({
          videoFilename: primaryVideo.name,
          videoPath: `media/${primaryVideo.name}`,
          videoDuration: dataToExport[dataToExport.length - 1]?.end || 0,
          subtitleFilename: `${rawProjectName}.smi`,
          subtitlePath: `media/${rawProjectName}.smi`,
          transcriptFilename: finalTranscriptFileName,
          transcriptPath: `transcription/${finalTranscriptFileName}`,
          startLine: parseInt(startLine) || 0,
          sentences: sentencesForSYN,
        });
      }

      // 3. Write files to project folder
      console.log("Exporting to project folder:", projectFolderPath);

      // Copy ALL video files to media folder
      for (const v of videos) {
        const vDest = await join(projectFolderPath, "media", v.name);
        await copyFile(v.path, vDest);
        console.log(`Video ${v.name} copied to:`, vDest);
      }

      // Write .smi file to media folder
      const smiPath = await join(projectFolderPath, "media", `${rawProjectName}.smi`);
      await writeTextFile(smiPath, finalSamiContent);
      console.log(".smi file written to:", smiPath);

      // Write transcript to transcription folder
      const transcriptPath = await join(projectFolderPath, "transcription", finalTranscriptFileName);
      await writeTextFile(transcriptPath, finalTxtContent);
      console.log("Transcript written to:", transcriptPath);

      // Write .dvt file to project root
      const dvtPath = await join(projectFolderPath, `${rawProjectName}.dvt`);
      await writeTextFile(dvtPath, finalDvtContent!);
      console.log(".dvt file written to:", dvtPath);

      // Update .syn file at project root
      const synPath = await join(projectFolderPath, `${rawProjectName}.syn`);
      await writeTextFile(synPath, finalSynContent!);
      console.log(".syn file updated at:", synPath);

      // Clear the session so it doesn't prompt to resume next time
      localStorage.removeItem("lastSession");
      setStep(5); // Navigate to Job Summary

      // Removed auto-navigation and alert as per request
      console.log(`Export Successful! Files saved to: ${projectFolderPath}`);
      // setStep(4); 
      // alert(`Export Successful!\nFiles saved to:\n${projectFolderPath}`);
    } catch (error: any) {
      console.error("Export Failed:", error);
      alert(`Export Failed: ${error}`);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Box p={4} maxWidth={1100} mx="auto">
      {/* HEADER */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight={600}>
          Sync App POC v2.0.0
        </Typography>
        <Box display="flex" gap={2}>
          {onNavigateToImport && (
            <Button
              variant="outlined"
              startIcon={<FolderOpenIcon />}
              onClick={onNavigateToImport}
            >
              Import Package
            </Button>
          )}
          <ThemeToggle />
        </Box>
      </Box>

      <Stepper step={step} steps={["Upload", "Preview", "Sync", "Result", "Edit", "Job Summary"]} />

      {/* STEP 0: UPLOAD */}
      {step === 0 && (
        <>
          {/* RESUME BANNER */}
          {resumeData && videos.length === 0 && (
            <Alert
              severity="info"
              sx={{ mb: 3 }}
              action={
                <Box display="flex" gap={1}>
                  <Button color="inherit" size="small" onClick={async () => {
                    // Restore Videos (all of them in order)
                    setVideos(resumeData.videos.map((v: any, idx: number) => ({
                      id: `${Date.now()}-${idx}`,
                      path: v.path,
                      name: v.name
                    })));

                    // Restore Transcript
                    if (resumeData.transcriptPath) {
                      try {
                        const text = await readTextFile(resumeData.transcriptPath);
                        setTranscriptText(text);
                        setTranscriptPath(resumeData.transcriptPath);
                        setTranscriptFileName(resumeData.transcriptPath.split(/[\\/]/).pop() || "transcript.txt");
                      } catch (e) {
                        console.error("Failed to load prev transcript", e);
                        alert("Could not load previous transcript file. You may need to select it again.");
                      }
                    }

                    // Restore StartLine
                    setStartLine(resumeData.startLine || "0");

                    // Clear resume data to hide banner
                    setResumeData(null);
                    // Auto-advance
                    setStep(1);
                  }}>
                    Resume Previous Session
                  </Button>
                  <Button
                    color="inherit"
                    size="small"
                    onClick={() => {
                      localStorage.removeItem("lastSession");
                      setResumeData(null);
                    }}
                  >
                    ✕
                  </Button>
                </Box>
              }
            >
              <AlertTitle>Resume Session?</AlertTitle>
              Continue with <strong>{resumeData.videos?.length || 0} video(s)</strong> {resumeData.transcriptPath ? " and transcript" : ""}?
            </Alert>
          )}

          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            {/* Draggable Video List */}
            <VideoUploadCard videos={videos} setVideos={setVideos} />

            <TranscriptUploadCard
              transcript={transcriptText}
              setTranscript={(file) => {
                // If file is null (removed), clear state
                if (!file) {
                  setTranscriptFileName(null);
                  setTranscriptPath(null);
                  setTranscriptText(null);
                  return;
                }

                // Handle Drag & Drop
                setTranscriptFileName(file.name);
                // Clear path since drag-drop file object path is unreliable/missing
                setTranscriptPath(null);
                file.text().then(setTranscriptText);
              }}
              onBrowse={async () => {
                const selected = await open({
                  multiple: false,
                  filters: [{ name: "Text", extensions: ["txt", "srt", "smi"] }]
                });

                if (!selected || Array.isArray(selected)) return;

                try {
                  const fileName = selected.split(/[\\/]/).pop() || "transcript.txt";
                  const text = await readTextFile(selected);

                  setTranscriptFileName(fileName);
                  setTranscriptPath(selected);
                  setTranscriptText(text);
                } catch (err) {
                  console.error("Failed to read transcript", err);
                  alert("Failed to read file");
                }
              }}
            />
          </Box>

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              disabled={videos.length === 0}
              onClick={() => {
                if (videos.length > 0) {
                  saveSession(videos, transcriptPath, startLine);
                }
                setStep(1);
              }}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Next Step
            </Button>
          </Box>
        </>
      )}

      {/* STEP 1: PREVIEW */}
      {step === 1 && videos.length > 0 && (
        <>
          <Box display="flex" gap={3} mt={3} height="70vh">
            {/* Video Preview - Fixed 350px width */}
            <Box flex="0 0 350px">
              <VideoPreview videos={videos} />
            </Box>

            {/* Transcript Preview - Scrollable, takes remaining width */}
            {transcriptText ? (
              <Box flex="1" display="flex" flexDirection="column" gap={2}>
                <TranscriptPreview
                  transcript={transcriptText}
                  onLineSelect={(lineNum) => {
                    setStartLine(lineNum.toString());
                  }}
                  selectedLine={startLine ? parseInt(startLine) : null}
                />

                {/* Show selected line indicator */}
                {startLine && (
                  <Box
                    p={2}
                    bgcolor={alpha(theme.palette.primary.main, 0.08)}
                    borderRadius={2}
                    border={1}
                    borderColor="primary.main"
                  >
                    <Typography variant="body2" color="primary.main" fontWeight={600}>
                      ✓ Selected Starting Line: {startLine}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Click a different line in the transcript preview to change
                    </Typography>
                  </Box>
                )}
              </Box>
            ) : (
              <Box
                flex="1"
                p={3}
                border="1px dashed"
                borderColor="divider"
                borderRadius={2}
                display="flex"
                alignItems="center"
                justifyContent="center"
              >
                <Typography color="text.secondary">
                  No manual transcript uploaded. One will be generated by AI.
                </Typography>
              </Box>
            )}
          </Box>

          <Box mt={4} display="flex" justifyContent="space-between">
            <Button
              variant="outlined"
              size="large"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(0)}
              color="inherit"
            >
              Back
            </Button>
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              onClick={() => {
                if (videos.length > 0) {
                  saveSession(videos, transcriptPath, startLine);
                }
                setStep(2);
              }}
              sx={{ px: 4 }}
            >
              Proceed to Sync
            </Button>
          </Box>
        </>
      )}

      {/* STEP 2: SYNC */}
      {step === 2 && videos.length > 0 && (
        <Box mt={3}>
          <Typography mb={3} color="text.secondary">
            Click below to extract audio locally and sync via backend.
          </Typography>
          <Box display="flex" gap={2}>
            <Button
              variant="outlined"
              size="large"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(1)}
              disabled={isProcessing}
            >
              Back
            </Button>
            <Button
              variant="contained"
              size="large"
              disabled={isProcessing}
              color={error ? "warning" : "primary"}
              onClick={() =>
                handleWorkflow(videos, transcriptText, parseInt(startLine) || 0)
              }
              startIcon={!isProcessing ? (error ? <RestartAltIcon /> : <PlayArrowIcon />) : null}
              sx={{ py: 1.5, px: 4, borderRadius: 2, fontSize: "1.1rem" }}
            >
              {isProcessing
                ? "Extracting & Uploading..."
                : error
                  ? "Retry Auto-Sync Workflow"
                  : "Start Auto-Sync Workflow"}
            </Button>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mt: 2, maxWidth: 600 }}>
              <AlertTitle>Workflow Failed</AlertTitle>
              {error}
            </Alert>
          )}

          {isProcessing && (
            <Box
              mt={4}
              p={4}
              bgcolor={alpha(theme.palette.info.main, 0.1)}
              borderRadius={3}
              border={2}
              borderColor="info.main"
              textAlign="center"
            >
              <Box
                display="flex"
                alignItems="center"
                justifyContent="center"
                gap={2}
                mb={2}
              >
                <TimerIcon
                  sx={{ fontSize: 48, color: theme.palette.info.main }}
                />
                <Typography variant="h4" fontWeight={700} color="info.main">
                  Processing...
                </Typography>
              </Box>
              <Typography
                variant="h2"
                fontWeight={800}
                sx={{ fontFamily: "monospace", color: theme.palette.info.main }}
              >
                {(liveElapsedTime / 1000).toFixed(2)}s
              </Typography>
            </Box>
          )}

          {transcriptResult && (
            <Box
              mt={4}
              p={3}
              bgcolor="background.paper"
              borderRadius={2}
              border={1}
              borderColor="divider"
            >
              <Box display="flex" alignItems="center" gap={2} mb={2}>
                <CheckCircleIcon color="success" fontSize="large" />
                <Typography variant="h6" color="success.main" fontWeight={600}>
                  Transcription Complete!
                </Typography>
              </Box>
              <Button
                variant="contained"
                color="success"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => {
                  processAssemblyResult(transcriptResult);
                  setStep(3);
                }}
              >
                View Synced Result
              </Button>
            </Box>
          )}
        </Box>
      )}

      {/* STEP 3: RESULT */}
      {step === 3 && videos.length > 0 && (
        <Box>
          <Box mb={3} display="flex" gap={2} flexWrap="wrap" justifyContent="space-between">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(2)}
            >
              Back
            </Button>

            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              color="inherit"
              onClick={() => {
                setStep(0);
                setVideos([]);
                setTranscriptText(null);
                setTranscriptFileName(null);
                setSyncedLines([]);
                setStartLine("");
              }}
            >
              Start New Project
            </Button>

            <Box display="flex" gap={2}>
              <Button
                variant="contained"
                color="primary"
                onClick={handleExportZip}
                disabled={isExporting}
                startIcon={
                  isExporting ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <SaveAltIcon />
                  )
                }
              >
                {isExporting ? "Zipping..." : "Export Zip"}
              </Button>

              <Button
                variant="contained"
                endIcon={<ArrowForwardIcon />}
                onClick={() => setStep(4)}
                sx={{ px: 4 }}
              >
                Proceed to Editor
              </Button>
            </Box>
          </Box>

          {mappedResult && mappedResult.length > 0 ? (
            <ResultsDisplay
              mappedResults={mappedResult}
              videos={videos}
              splitPoints={splitPoints}
              apiElapsedTime={apiElapsedTime}
            />
          ) : syncedLines.length > 0 ? (
            <Box>
              <Box mb={2}>
                <Typography variant="h6">Basic Synchronization</Typography>
                <Typography variant="body2" color="text.secondary">No advanced mapping available.</Typography>
              </Box>
              <SyncedPlayer
                videos={videos}
                splitPoints={splitPoints}
                lines={syncedLines}
              />
            </Box>
          ) : (
            <Box
              p={4}
              textAlign="center"
              border="1px dashed"
              borderColor="divider"
              borderRadius={2}
            >
              <Typography color="text.secondary">
                No results available.
              </Typography>
            </Box>
          )}
        </Box>
      )}

      {/* STEP 4: EDIT */}
      {step === 4 && videos.length > 0 && (
        <Box>
          <Box mb={3} display="flex" gap={2} flexWrap="wrap" justifyContent="space-between">
            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(3)}
            >
              Back to Results
            </Button>

            {/* EXPORT BUTTON */}
            <Button
              variant="contained"
              color="primary"
              onClick={() => setStep(5)}
              endIcon={<ArrowForwardIcon />}
            >
              Job Summary
            </Button>
          </Box>

          <EditorView
            videos={videos}
            splitPoints={splitPoints}
            subtitles={editedSubtitles.length > 0 ? editedSubtitles : (mappedResult ? mappedResult.map(r => ({ text: r.sentence, start: r.start, end: r.end, confidence: r.confidence })) : [])}
            onUpdateSubtitles={setEditedSubtitles}
            startLine={parseInt(startLine) || 0}
          />
        </Box>
      )}


      {/* STEP 5: JOB SUMMARY */}
      {step === 5 && mappedResult && mappedResult.length > 0 && (
        <Box>
          <Box mb={3} display="flex" gap={2} flexWrap="wrap">
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              color="inherit"
              onClick={() => {
                setStep(0);
                setVideos([]);
                setTranscriptText(null);
                setTranscriptFileName(null);
                setSyncedLines([]);
                setStartLine("");
              }}
            >
              Start New Project
            </Button>

            <Button
              variant="outlined"
              startIcon={<ArrowBackIcon />}
              onClick={() => setStep(4)}
            >
              Back to Editor
            </Button>
          </Box>

          <JobSummaryCard
            videoCount={videos.length}
            totalDuration={splitPoints[splitPoints.length - 1] / 1000 || 0}
            sentenceCount={mappedResult.length}
            avgConfidence={
              mappedResult.reduce((sum, r) => sum + (r.confidence || 0), 0) / mappedResult.length
            }
            processingTime={apiElapsedTime || 0}
            estimatedCost={(splitPoints[splitPoints.length - 1] / 1000 || 0) * 0.00025}
          />
        </Box>
      )}

      <Box mt={5}>
        {/* Hide logs and raw viewer during Preview step (step 1) to keep UI clean */}
        {step !== 1 && (
          <>
            <LogsPanel logs={logs} />
            <TranscriptViewer data={transcriptResult} />
          </>
        )}
      </Box>
    </Box>
  );
}