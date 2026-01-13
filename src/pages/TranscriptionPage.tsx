import { useState } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { useDropzone } from "react-dropzone";

import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";

import { useTranscriptionWorkflow } from "../hooks/useTranscriptionWorkflow";
import SyncedPlayer from "../components/sync/SyncedPlayer";

export default function TranscriptionPage() {
  const [step, setStep] = useState(0);

  const [videos, setVideos] = useState<File[]>([]);
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

  const { logs, transcriptResult, handleWorkflow, isProcessing } =
    useTranscriptionWorkflow();
  const [syncedLines, setSyncedLines] = useState<any[]>([]);

  // ---------------- VIDEO DROPZONE ----------------
  const videoDrop = useDropzone({
    accept: { "video/*": [] },
    multiple: true,
    onDrop: (acceptedFiles) => {
      setVideos((prev) => [...prev, ...acceptedFiles]);
    },
  });

  // ---------------- TRANSCRIPT DROPZONE ----------------
  const transcriptDrop = useDropzone({
    accept: { "text/*": [] },
    multiple: false,
    onDrop: async (acceptedFiles) => {
      const file = acceptedFiles[0];
      const text = await file.text();
      setTranscriptText(text);
    },
  });

  function buildTimedLines(assemblyResult: any, originalTranscript: string) {
    const words = assemblyResult?.words || [];
    const transcriptLines = originalTranscript
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);

    return transcriptLines.map((line, i) => ({
      text: line,
      start: words[i]?.start ?? i * 1000,
      end: words[i]?.end ?? i * 1000 + 800,
    }));
  }

  return (
    <Box p={4} maxWidth={1100} mx="auto">
      <Typography variant="h5" fontWeight={600} mb={3}>
        Sync App POC
      </Typography>

      <Stepper step={step} steps={["Upload", "Preview", "Sync", "Result"]} />

      {/* ---------------- STEP 1: UPLOAD ---------------- */}
      {step === 0 && (
        <>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            {/* VIDEOS */}
            <Card variant="outlined">
              <CardContent>
                <Typography fontWeight={600}>Videos</Typography>

                <Box
                  {...videoDrop.getRootProps()}
                  sx={{
                    border: "2px dashed #4caf50",
                    borderRadius: 2,
                    p: 4,
                    mt: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    background: videoDrop.isDragActive
                      ? "#f1f8e9"
                      : "transparent",
                  }}
                >
                  <input {...videoDrop.getInputProps()} />
                  <Typography>Drag & drop videos here</Typography>
                  <Typography variant="caption">or click to browse</Typography>
                </Box>

                {videos.length > 0 && (
                  <Box mt={2}>
                    {videos.map((file, i) => (
                      <Typography key={i} variant="body2">
                        {i + 1}. {file.name}
                      </Typography>
                    ))}
                  </Box>
                )}
              </CardContent>
            </Card>

            {/* TRANSCRIPT */}
            <Card variant="outlined">
              <CardContent>
                <Typography fontWeight={600}>Transcript</Typography>

                <Box
                  {...transcriptDrop.getRootProps()}
                  sx={{
                    border: "2px dashed #2196f3",
                    borderRadius: 2,
                    p: 4,
                    mt: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    background: transcriptDrop.isDragActive
                      ? "#e3f2fd"
                      : "transparent",
                  }}
                >
                  <input {...transcriptDrop.getInputProps()} />
                  <Typography>
                    {transcriptText
                      ? "Transcript uploaded"
                      : "Drag & drop transcript here"}
                  </Typography>
                  <Typography variant="caption">or click to browse</Typography>
                </Box>
              </CardContent>
            </Card>
          </Box>

          <Box mt={3}>
            <button
              disabled={!videos.length || !transcriptText}
              onClick={() => setStep(1)}
            >
              Next →
            </button>
          </Box>
        </>
      )}

      {/* ---------------- STEP 2: PREVIEW ---------------- */}
      {step === 1 && transcriptText && videos.length > 0 && (
        <>
          <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3} mt={3}>
            <VideoPreview videoPath={URL.createObjectURL(videos[0])} />
            <TranscriptPreview transcript={transcriptText} />
          </Box>

          <Box mt={3} display="flex" gap={2}>
            <button onClick={() => setStep(0)}>← Back</button>
            <button onClick={() => setStep(2)}>Next →</button>
          </Box>
        </>
      )}

      {/* STEP 3 — SYNC */}
      {step === 2 && (
        <Box mt={4}>
          <Typography mb={2}>
            This will extract audio, send to AssemblyAI, and sync transcript.
          </Typography>

          <button
            disabled={isProcessing}
            onClick={async () => {
              await handleWorkflow(videos[0]); // your existing pipeline
            }}
          >
            {isProcessing ? "Syncing..." : "Start Sync"}
          </button>

          {transcriptResult && (
            <Box mt={2}>
              <button
                onClick={() => {
                  const lines = buildTimedLines(
                    transcriptResult,
                    transcriptText!
                  );
                  setSyncedLines(lines);
                  setStep(3);
                }}
              >
                Continue →
              </button>
            </Box>
          )}
        </Box>
      )}

      {/* STEP 4 — RESULT */}
      {step === 3 && syncedLines.length > 0 && (
        <SyncedPlayer
          videoUrl={URL.createObjectURL(videos[0])}
          lines={syncedLines}
        />
      )}

      {/* ---------------- DEBUG UI (unchanged) ---------------- */}
      <Box mt={5}>
        <LogsPanel logs={logs} />
        <TranscriptViewer data={transcriptResult} />
      </Box>
    </Box>
  );
}
