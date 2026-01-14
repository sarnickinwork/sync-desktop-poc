import { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { readFile, mkdir, exists, remove } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";

const API_KEY = import.meta.env.VITE_ASSEMBLY_AI;

export function useTranscriptionWorkflow() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<any>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  const uploadFile = async (filePath: string) => {
    log("Reading file into memory...");
    const fileData = await readFile(filePath);

    log("Uploading to AssemblyAI...");
    const response = await fetch("https://api.assemblyai.com/v2/upload", {
      method: "POST",
      headers: { authorization: API_KEY },
      body: fileData,
    });

    const json = await response.json();
    return json.upload_url;
  };

  const requestTranscription = async (audioUrl: string) => {
    log("Requesting transcription...");
    const response = await fetch("https://api.assemblyai.com/v2/transcript", {
      method: "POST",
      headers: {
        authorization: API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({ audio_url: audioUrl, speaker_labels: true }),
    });
    const json = await response.json();
    return json.id;
  };

  const waitForCompletion = async (id: string) => {
    log(`Polling job ${id}...`);
    while (true) {
      const response = await fetch(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        { headers: { authorization: API_KEY } }
      );
      const json = await response.json();

      if (json.status === "completed") return json;
      if (json.status === "error") throw new Error(json.error);

      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  // Uses path directly (safe for large files)
  const handleWorkflow = async (videoPath: string) => {
    let audioPath = "";

    try {
      setIsProcessing(true);
      setLogs([]);
      setTranscriptResult(null);

      log(`Using uploaded file: ${videoPath}`);

      const appData = await appDataDir();
      if (!(await exists(appData))) {
        log("Creating app data directory...");
        await mkdir(appData);
      }

      audioPath = await join(appData, "temp_audio.mp3");

      const command = Command.sidecar("binaries/ffmpeg", [
        "-i",
        videoPath,
        "-vn",
        "-acodec",
        "libmp3lame",
        "-y",
        audioPath,
      ]);

      log("Extracting audio with FFmpeg...");
      const output = await command.execute();

      if (output.code !== 0) {
        throw new Error(`FFmpeg failed: ${output.stderr}`);
      }

      log("Audio extracted successfully.");

      const uploadUrl = await uploadFile(audioPath);
      const transcriptId = await requestTranscription(uploadUrl);
      const result = await waitForCompletion(transcriptId);

      log("TRANSCRIPTION COMPLETE!");

      log("Cleaning up temporary audio file...");
      await remove(audioPath);
      log("Cleanup successful.");

      setTranscriptResult(result);
    } catch (err) {
      console.error(err);
      log(`Error: ${err}`);
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
