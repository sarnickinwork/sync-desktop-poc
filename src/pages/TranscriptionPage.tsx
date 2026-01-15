import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  alpha,
  Button,
  TextField, // <--- Ensure this is imported
} from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

// Icons
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// Components
import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";
import TranscriptUploadCard from "../components/upload/TranscriptUploadCard";
import SyncedPlayer from "../components/sync/SyncedPlayer";
import ThemeToggle from "../components/ThemeToggle";

import { useTranscriptionWorkflow } from "../hooks/useTranscriptionWorkflow";

type VideoItem = {
  path: string;
  name: string;
};

type SyncedLine = {
  text: string;
  start: number;
  end: number;
};

export default function TranscriptionPage() {
  const theme = useTheme();
  const [step, setStep] = useState(0);
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

  // State for the line number input
  const [startLine, setStartLine] = useState(0);

  const { logs, isProcessing, transcriptResult, handleWorkflow } =
    useTranscriptionWorkflow();

  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);

  function generateSentencesFromAssembly(apiResult: any): SyncedLine[] {
    if (!apiResult?.words) return [];

    const sentences: SyncedLine[] = [];
    let currentSentenceWords: string[] = [];
    let startTime: number | null = null;

    apiResult.words.forEach((word: any) => {
      if (startTime === null) startTime = word.start;
      currentSentenceWords.push(word.text);

      const isEndOfSentence = /[.!?]$/.test(word.text);

      if (isEndOfSentence) {
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
        end: apiResult.words[apiResult.words.length - 1].end,
      });
    }

    return sentences;
  }

  return (
    <Box p={4} maxWidth={1100} mx="auto">
      {/* HEADER: Title + Toggle */}
      <Box
        display="flex"
        justifyContent="space-between"
        alignItems="center"
        mb={3}
      >
        <Typography variant="h5" fontWeight={600}>
          Sync App POC
        </Typography>
        <ThemeToggle />
      </Box>

      <Stepper step={step} steps={["Upload", "Preview", "Sync", "Result"]} />

      {/* STEP 0: UPLOAD */}
      {step === 0 && (
        <>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            {/* Video Upload */}
            <Card variant="outlined">
              <CardContent>
                <Typography fontWeight={600}>Video</Typography>

                <Box
                  onClick={async () => {
                    const selected = await open({
                      multiple: false,
                      filters: [
                        {
                          name: "Video",
                          extensions: ["mp4", "mkv", "avi", "mov"],
                        },
                      ],
                    });
                    if (!selected || Array.isArray(selected)) return;
                    setVideo({
                      path: selected,
                      name: selected.split("\\").pop() || selected,
                    });
                  }}
                  sx={{
                    border: "2px dashed",
                    borderColor: video ? "success.main" : "text.secondary",
                    borderRadius: 2,
                    p: 3,
                    mt: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    bgcolor: video
                      ? alpha(theme.palette.success.main, 0.1)
                      : "transparent",
                    transition: "all 0.2s",
                  }}
                >
                  <Typography color="textPrimary">
                    {video ? "Video selected" : "Click to select video"}
                  </Typography>
                  <Typography variant="caption" color="textSecondary">
                    {video ? video.name : "Supports MP4, MKV, AVI, MOV"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Transcript Upload */}
            <TranscriptUploadCard
              transcript={transcriptText}
              setTranscript={(file) => {
                if (!file) return;
                file.text().then(setTranscriptText);
              }}
            />
          </Box>

          <Box mt={4} display="flex" justifyContent="flex-end">
            <Button
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              disabled={!video}
              onClick={() => setStep(1)}
              sx={{ px: 4, py: 1.5, borderRadius: 2 }}
            >
              Next Step
            </Button>
          </Box>
        </>
      )}

      {/* STEP 1: PREVIEW & CONFIGURATION */}
      {step === 1 && video && (
        <>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            <VideoPreview videoPath={convertFileSrc(video.path)} />

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

          {/* --- NEW LOCATION FOR INPUT FIELD --- */}
          <Box mt={4} maxWidth={300}>
            <TextField
              label="Start Line Number"
              type="number"
              variant="outlined"
              size="small"
              value={startLine}
              onChange={(e) => setStartLine(Number(e.target.value))}
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
      {step === 2 && video && (
        <Box mt={3}>
          <Typography mb={3} color="text.secondary">
            Click below to extract audio locally and sync via backend.
          </Typography>

          <Button
            variant="contained"
            size="large"
            disabled={isProcessing}
            // Passing the startLine gathered in Step 1
            onClick={() =>
              handleWorkflow(video.path, transcriptText, startLine)
            }
            startIcon={!isProcessing && <PlayArrowIcon />}
            sx={{
              py: 1.5,
              px: 4,
              borderRadius: 2,
              fontSize: "1.1rem",
            }}
          >
            {isProcessing
              ? "Extracting & Uploading..."
              : "Start Auto-Sync Workflow"}
          </Button>

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
                  const lines = generateSentencesFromAssembly(transcriptResult);
                  setSyncedLines(lines);
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
      {step === 3 && video && syncedLines.length > 0 && (
        <Box>
          <Box mb={3}>
            <Button
              variant="outlined"
              startIcon={<RestartAltIcon />}
              color="inherit"
              onClick={() => {
                setStep(0);
                setVideo(null);
                setTranscriptText(null);
                setSyncedLines([]);
                setStartLine(0); // Reset start line
              }}
            >
              Start New Project
            </Button>
          </Box>

          <SyncedPlayer
            videoUrl={convertFileSrc(video.path)}
            lines={syncedLines}
          />
        </Box>
      )}

      <Box mt={5}>
        <LogsPanel logs={logs} />
        <TranscriptViewer data={transcriptResult} />
      </Box>
    </Box>
  );
}
