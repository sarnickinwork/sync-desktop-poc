import { useState, useEffect } from "react";
import {
  Box,
  Typography,
  useTheme,
  alpha,
  Button,
  TextField,
  CircularProgress,
} from "@mui/material";
import { join } from "@tauri-apps/api/path";
import { writeTextFile, copyFile } from "@tauri-apps/plugin-fs";

// Icons
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import TimerIcon from "@mui/icons-material/Timer";
import SaveAltIcon from "@mui/icons-material/SaveAlt";

// Components
import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";
import TranscriptUploadCard from "../components/upload/TranscriptUploadCard";
// import VideoUploadCard from "../components/upload/VideoUploadCard"; // Use updated one
import VideoUploadCard from "../components/upload/VideoUploadCard";
import SyncedPlayer from "../components/sync/SyncedPlayer";
import ThemeToggle from "../components/ThemeToggle";
import ResultsDisplay from "../components/ResultsDisplay";

import { useTranscriptionWorkflow } from "../hooks/useTranscriptionWorkflow";
import { downloadSMI, downloadDVT, downloadSYN } from "../utils";
import { VideoItem } from "../utils/types";

type SyncedLine = {
  text: string;
  start: number;
  end: number;
};

// --- HELPER: Local Fallback Generator ---
const generateSamiContent = (lines: SyncedLine[], title: string) => {
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

  // Export State
  const [isExporting, setIsExporting] = useState(false);
  const [startLine, setStartLine] = useState<string>("");

  const {
    logs,
    isProcessing,
    transcriptResult,
    mappedResult,
    smiContent, // <--- This contains the backend SAMI file
    dvtContent,
    synContent,
    apiElapsedTime,
    projectFolderPath,
    handleWorkflow,
  } = useTranscriptionWorkflow();

  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);
  const [splitPoints, setSplitPoints] = useState<number[]>([]);
  const [liveElapsedTime, setLiveElapsedTime] = useState<number>(0);

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
          end: word.end, // word.end already has offset
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
    const dataToExport: SyncedLine[] =
      mappedResult && mappedResult.length > 0
        ? (mappedResult as any[])
        : syncedLines;

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
      const finalSamiContent = smiContent
        ? smiContent
        : generateSamiContent(dataToExport, rawProjectName);

      // B. Transcript Content
      const finalTxtContent = transcriptText
        ? transcriptText
        : dataToExport.map((l) => l.text).join(" ");

      // C. DVT Content (already generated in hook if mapped, else generate here)
      let finalDvtContent = dvtContent;
      if (!finalDvtContent) {
        const { generateDVT } = await import("../utils/dvtGenerationUtils");
        const sentencesForDVT = dataToExport.map((line: any) => ({
          sentence: line.sentence || line.text,
          start: line.start,
          end: line.end,
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
      let finalSynContent = synContent;
      if (!finalSynContent) {
        const { generateSYN } = await import("../utils/synGenerationUtils");
        const sentencesForSYN = dataToExport.map((line: any) => ({
          sentence: line.sentence || line.text,
          start: line.start,
          end: line.end,
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

      // Copy ALL video files to media folder?
      // Yes, otherwise multi-video export is incomplete.
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

      alert(`Export Successful!\nFiles saved to:\n${projectFolderPath}`);
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
          Sync App POC v1.1 Multi-Video
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

      <Stepper step={step} steps={["Upload", "Preview", "Sync", "Result"]} />

      {/* STEP 0: UPLOAD */}
      {step === 0 && (
        <>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3} height={400}>
            {/* Draggable Video List */}
            <VideoUploadCard videos={videos} setVideos={setVideos} />

            <TranscriptUploadCard
              transcript={transcriptText}
              setTranscript={(file) => {
                if (!file) return;
                setTranscriptFileName(file.name);
                file.text().then(setTranscriptText);
              }}
            />
          </Box>

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              disabled={videos.length === 0}
              onClick={() => setStep(1)}
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
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            <VideoPreview videos={videos} />
            {transcriptText ? (
              <TranscriptPreview transcript={transcriptText} />
            ) : (
              <Box
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

          <Box mt={4} maxWidth={300}>
            <TextField
              label="Start Line Number"
              type="number"
              variant="outlined"
              size="small"
              value={startLine}
              onChange={(e) => setStartLine(e.target.value)}
              placeholder="0"
              helperText="Optional: Offset for transcription sync"
              fullWidth
            />
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
              onClick={() => setStep(2)}
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
          <Button
            variant="contained"
            size="large"
            disabled={isProcessing}
            onClick={() =>
              handleWorkflow(videos, transcriptText, parseInt(startLine) || 0)
            }
            startIcon={!isProcessing && <PlayArrowIcon />}
            sx={{ py: 1.5, px: 4, borderRadius: 2, fontSize: "1.1rem" }}
          >
            {isProcessing
              ? "Extracting & Uploading..."
              : "Start Auto-Sync Workflow"}
          </Button>

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

            {/* EXPORT BUTTON */}
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
              {isExporting ? "Zipping..." : "Export Project Zip"}
            </Button>
          </Box>

          {mappedResult && mappedResult.length > 0 ? (
            <ResultsDisplay
              mappedResults={mappedResult}
              videos={videos}
              splitPoints={splitPoints}
              smiContent={smiContent}
              dvtContent={dvtContent}
              synContent={synContent}
              apiElapsedTime={apiElapsedTime}
              onDownloadSMI={() => {
                if (smiContent) {
                  downloadSMI(smiContent, "synced_subtitle.smi");
                }
              }}
              onDownloadDVT={() => {
                if (dvtContent) {
                  const videoName =
                    videos[0]?.name.replace(/\.[^/.]+$/, "") || "deposition";
                  downloadDVT(dvtContent, `${videoName}.dvt`);
                }
              }}
              onDownloadSYN={() => {
                if (synContent) {
                  const videoName =
                    videos[0]?.name.replace(/\.[^/.]+$/, "") || "sync";
                  downloadSYN(synContent, `${videoName}.syn`);
                }
              }}
            />
          ) : syncedLines.length > 0 ? (
            <SyncedPlayer
              videos={videos}
              splitPoints={splitPoints}
              lines={syncedLines}
            />
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

      <Box mt={5}>
        <LogsPanel logs={logs} />
        <TranscriptViewer data={transcriptResult} />
      </Box>
    </Box>
  );
}
