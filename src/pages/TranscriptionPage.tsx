import { useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Typography,
  useTheme,
  alpha,
} from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

// Components
import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";
import TranscriptUploadCard from "../components/upload/TranscriptUploadCard";
import SyncedPlayer from "../components/sync/SyncedPlayer";
import ThemeToggle from "../components/ThemeToggle"; // <--- NEW IMPORT

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
  const theme = useTheme(); // <--- Hook to access theme colors
  const [step, setStep] = useState(0);
  const [video, setVideo] = useState<VideoItem | null>(null);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

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
          Sync App POC v1.0.2
        </Typography>
        <ThemeToggle />
      </Box>

      <Stepper step={step} steps={["Upload", "Preview", "Sync", "Result"]} />

      {/* STEP 1: UPLOAD */}
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
                    // Use theme color for border
                    borderColor: video ? "success.main" : "text.secondary",
                    borderRadius: 2,
                    p: 3,
                    mt: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    // Dynamic background using alpha helper for dark mode support
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

          <Box mt={3}>
            <button
              disabled={!video}
              onClick={() => setStep(1)}
              style={{
                padding: "10px 20px",
                cursor: video ? "pointer" : "not-allowed",
                backgroundColor: video
                  ? theme.palette.primary.main
                  : theme.palette.action.disabledBackground,
                color: video ? "#fff" : theme.palette.text.disabled,
                border: "none",
                borderRadius: "4px",
              }}
            >
              Next →
            </button>
          </Box>
        </>
      )}

      {/* STEP 2: PREVIEW */}
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
              >
                <Typography color="text.secondary">
                  No manual transcript uploaded. One will be generated by AI.
                </Typography>
              </Box>
            )}
          </Box>

          <Box mt={3} display="flex" gap={2}>
            <button
              onClick={() => setStep(0)}
              style={{ padding: "8px 16px", cursor: "pointer" }}
            >
              ← Back
            </button>
            <button
              onClick={() => setStep(2)}
              style={{ padding: "8px 16px", cursor: "pointer" }}
            >
              Next →
            </button>
          </Box>
        </>
      )}

      {/* STEP 3: SYNC */}
      {step === 2 && video && (
        <Box mt={3}>
          <Typography mb={2}>
            Click below to extract audio, upload to AssemblyAI, and get
            timestamped sentences.
          </Typography>

          <button
            disabled={isProcessing}
            onClick={() => handleWorkflow(video.path)}
            style={{
              padding: "10px 20px",
              backgroundColor: isProcessing
                ? theme.palette.action.disabled
                : theme.palette.primary.main,
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: isProcessing ? "wait" : "pointer",
            }}
          >
            {isProcessing
              ? "Processing (FFmpeg + API)..."
              : "Start Auto-Sync Workflow"}
          </button>

          {transcriptResult && (
            <Box mt={2}>
              <Typography color="success.main" fontWeight={600} mb={1}>
                Success! Transcription received.
              </Typography>
              <button
                onClick={() => {
                  const lines = generateSentencesFromAssembly(transcriptResult);
                  setSyncedLines(lines);
                  setStep(3);
                }}
                style={{ padding: "10px 20px", cursor: "pointer" }}
              >
                View Synced Result →
              </button>
            </Box>
          )}
        </Box>
      )}

      {/* STEP 4: RESULT */}
      {step === 3 && video && syncedLines.length > 0 && (
        <Box>
          <Box mb={2}>
            <button
              onClick={() => {
                setStep(0);
                setVideo(null);
                setTranscriptText(null);
                setSyncedLines([]);
              }}
              style={{ padding: "8px 16px", cursor: "pointer" }}
            >
              ← Start Over
            </button>
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
