import { useState } from "react";
import { Box, Card, CardContent, Typography } from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import { convertFileSrc } from "@tauri-apps/api/core";

import Stepper from "../components/Stepper";
import LogsPanel from "../components/LogsPanel";
import TranscriptViewer from "../components/TranscriptViewer";
import VideoPreview from "../components/preview/VideoPreview";
import TranscriptPreview from "../components/preview/TranscriptPreview";
import TranscriptUploadCard from "../components/upload/TranscriptUploadCard";
import SyncedPlayer from "../components/sync/SyncedPlayer";

import { useTranscriptionWorkflow } from "../hooks/useTranscriptionWorkflow";

type VideoItem = {
  path: string;
  name: string;
};

// Interface for the new sentence structure
type SyncedLine = {
  text: string;
  start: number; // in milliseconds
  end: number; // in milliseconds
};

export default function TranscriptionPage() {
  const [step, setStep] = useState(0);

  const [video, setVideo] = useState<VideoItem | null>(null);
  // We keep this for the "Preview" step, but the final result will use AssemblyAI data
  const [transcriptText, setTranscriptText] = useState<string | null>(null);

  const { logs, isProcessing, transcriptResult, handleWorkflow } =
    useTranscriptionWorkflow();

  const [syncedLines, setSyncedLines] = useState<SyncedLine[]>([]);

  /**
   * PARSER: Converts AssemblyAI 'words' array into full sentences with timestamps.
   * Logic: Accumulate words until a punctuation mark (. ? !) is found.
   */
  function generateSentencesFromAssembly(apiResult: any): SyncedLine[] {
    if (!apiResult?.words) return [];

    const sentences: SyncedLine[] = [];
    let currentSentenceWords: string[] = [];
    let startTime: number | null = null;

    apiResult.words.forEach((word: any) => {
      // 1. Mark start time of the new sentence
      if (startTime === null) {
        startTime = word.start;
      }

      // 2. Add word to current buffer
      currentSentenceWords.push(word.text);

      // 3. Check if this word ends a sentence (simple punctuation check)
      // You can expand this regex if needed (e.g. for quotes)
      const isEndOfSentence = /[.!?]$/.test(word.text);

      if (isEndOfSentence) {
        sentences.push({
          text: currentSentenceWords.join(" "),
          start: startTime!,
          end: word.end, // The end of the last word is the end of the sentence
        });

        // Reset for next sentence
        currentSentenceWords = [];
        startTime = null;
      }
    });

    // Handle any remaining words (if the transcript doesn't end with punctuation)
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
      <Typography variant="h5" fontWeight={600} mb={3}>
        Sync App POC UI Updated
      </Typography>

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
                    border: "2px dashed #4caf50",
                    borderRadius: 2,
                    p: 3,
                    mt: 2,
                    textAlign: "center",
                    cursor: "pointer",
                    background: video ? "#f1f8e9" : "transparent",
                  }}
                >
                  <Typography>
                    {video ? "Video selected" : "Click to select video"}
                  </Typography>
                  <Typography variant="caption">
                    {video ? video.name : "Supports MP4, MKV, AVI, MOV"}
                  </Typography>
                </Box>
              </CardContent>
            </Card>

            {/* Transcript Upload (Optional now, but kept for UI consistency) */}
            <TranscriptUploadCard
              transcript={transcriptText}
              setTranscript={(file) => {
                if (!file) return;
                file.text().then(setTranscriptText);
              }}
            />
          </Box>

          <Box mt={3}>
            {/* Note: I removed the strict check for transcriptText since we generate it now */}
            <button
              disabled={!video}
              onClick={() => setStep(1)}
              style={{
                padding: "10px 20px",
                cursor: video ? "pointer" : "not-allowed",
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

            {/* Only show this if they actually uploaded a file, otherwise show a placeholder */}
            {transcriptText ? (
              <TranscriptPreview transcript={transcriptText} />
            ) : (
              <Box p={3} border="1px dashed #ccc" borderRadius={2}>
                <Typography color="text.secondary">
                  No manual transcript uploaded. One will be generated by AI.
                </Typography>
              </Box>
            )}
          </Box>

          <Box mt={3} display="flex" gap={2}>
            <button onClick={() => setStep(0)}>← Back</button>
            <button onClick={() => setStep(2)}>Next →</button>
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
              backgroundColor: isProcessing ? "#ccc" : "#1976d2",
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
                  // HERE IS THE CHANGE: Use the new parser function
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
            >
              ← Start Over
            </button>
          </Box>

          {/* SyncedPlayer expects lines in { text, start, end } format.
            AssemblyAI returns timestamps in milliseconds.
            SyncedPlayer handles the ms -> s conversion internally in its onClick.
          */}
          <SyncedPlayer
            videoUrl={convertFileSrc(video.path)}
            lines={syncedLines}
          />
        </Box>
      )}

      <Box mt={5}>
        <LogsPanel logs={logs} />
        {/* Useful for debugging the raw JSON from AssemblyAI */}
        <TranscriptViewer data={transcriptResult} />
      </Box>
    </Box>
  );
}
