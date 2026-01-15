import { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { readFile, mkdir, exists, remove } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const API_URL = import.meta.env.VITE_API_URL;

export function useTranscriptionWorkflow() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<any>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  // Updated signature to accept text and line number
  const handleWorkflow = async (
    videoPath: string,
    manualTranscript: string | null,
    startLine: number = 0
  ) => {
    let audioPath = "";

    try {
      setIsProcessing(true);
      setLogs([]);
      setTranscriptResult(null);

      if (!API_URL) throw new Error("VITE_API_URL is missing in .env");

      // --- STEP 1: LOCAL AUDIO EXTRACTION (FFmpeg) ---
      log(`Processing local video: ${videoPath}`);

      const appData = await appDataDir();
      if (!(await exists(appData))) {
        await mkdir(appData);
      }

      // Define temp path for the audio
      audioPath = await join(appData, "temp_audio.mp3");

      log("Extracting audio with FFmpeg (Sidecar)...");
      const command = Command.sidecar("binaries/ffmpeg", [
        "-i",
        videoPath,
        "-vn", // No video
        "-acodec",
        "libmp3lame", // Encode to MP3
        "-y", // Overwrite if exists
        audioPath,
      ]);

      const output = await command.execute();

      if (output.code !== 0) {
        throw new Error(`FFmpeg failed: ${output.stderr}`);
      }
      log("Audio extracted successfully.");

      // --- STEP 2: READ FILES INTO MEMORY ---
      log("Reading extracted audio file...");
      const audioData = await readFile(audioPath);
      // Create a Blob/File from the raw bytes
      const audioBlob = new Blob([audioData], { type: "audio/mp3" });
      const audioFile = new File([audioBlob], "audio.mp3", {
        type: "audio/mp3",
      });

      // --- STEP 3: PREPARE FORM DATA FOR BACKEND ---
      const formData = new FormData();
      formData.append("AudioFiles", audioFile); // The small MP3 file
      formData.append("startLine", startLine.toString());

      if (manualTranscript) {
        const textBlob = new Blob([manualTranscript], { type: "text/plain" });
        const textFile = new File([textBlob], "transcript.txt", {
          type: "text/plain",
        });
        formData.append("transcript", textFile);
        log("Attached manual transcript file.");
      }

      // --- STEP 4: SEND TO BACKEND ---
      log(`Sending to backend (${API_URL}/finaltranscript)...`);

      const response = await fetch(`${API_URL}/finaltranscript`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }

      const json = await response.json();
      log("Backend processing complete!");
      setTranscriptResult(json);

      // --- STEP 5: CLEANUP ---
      log("Cleaning up temporary files...");
      await remove(audioPath);
      log("Cleanup successful.");
    } catch (err: any) {
      console.error(err);
      log(`Error: ${err.message || err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    logs,
    isProcessing,
    transcriptResult,
    handleWorkflow,
  };
}
