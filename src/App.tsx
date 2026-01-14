import { useState, useEffect } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile, mkdir, exists, remove } from "@tauri-apps/plugin-fs";
import { appDataDir, join } from "@tauri-apps/api/path";
// NEW IMPORTS FOR UPDATER
import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

// Ensure you have a .env file in your root with VITE_ASSEMBLY_AI=your_key
const API_KEY = import.meta.env.VITE_ASSEMBLY_AI;

/**
 * Custom Hook: useAppUpdater
 * Handles checking for updates on mount and managing the update flow.
 */
function useAppUpdater() {
  useEffect(() => {
    const checkForUpdates = async () => {
      try {
        const update = await check();
        if (update) {
          console.log(`Found update: ${update.version}`);
          const yes = await window.confirm(
            `Update to ${update.version} is available!\n\nRelease notes: ${update.body}\n\nInstall now?`
          );
          
          if (yes) {
            await update.downloadAndInstall();
            // Restart the app after install
            await relaunch();
          }
        } else {
            console.log("No updates found.");
        }
      } catch (error) {
        console.error("Error checking for updates:", error);
      }
    };

    checkForUpdates();
  }, []);
}

function App() {
  // 1. Initialize the Updater Hook
  useAppUpdater();

  // 2. Existing State & Logic
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcriptResult, setTranscriptResult] = useState<any>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  // Helper: Upload file to AssemblyAI
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

  // Helper: Request Transcription
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

  // Helper: Poll for completion
  const waitForCompletion = async (id: string) => {
    log(`Polling job ${id}...`);
    while (true) {
      const response = await fetch(
        `https://api.assemblyai.com/v2/transcript/${id}`,
        {
          headers: { authorization: API_KEY },
        }
      );
      const json = await response.json();

      if (json.status === "completed") {
        return json;
      } else if (json.status === "error") {
        throw new Error(json.error);
      }

      await new Promise((r) => setTimeout(r, 2000));
    }
  };

  const handleWorkflow = async () => {
    let audioPath = ""; // Keep track of path for cleanup
    
    try {
      setIsProcessing(true);
      setLogs([]);
      setTranscriptResult(null);

      // 1. Select Video
      const selected = await open({
        multiple: false,
        filters: [{ name: "Video", extensions: ["mp4", "mkv", "avi"] }],
      });
      if (!selected) return;

      const videoPath = selected as string;
      log(`Selected: ${videoPath}`);

      // 2. Prepare Paths & Create Directory
      const appData = await appDataDir();
      
      const dirExists = await exists(appData);
      if (!dirExists) {
        log("Creating app data directory...");
        await mkdir(appData);
      }

      audioPath = await join(appData, "temp_audio.mp3");

      // 3. Extract Audio (FFmpeg)
      // Ensure 'src-tauri/capabilities/default.json' has "sidecar": true
      const command = Command.sidecar("binaries/ffmpeg", [
        "-i", videoPath,
        "-vn",
        "-acodec", "libmp3lame",
        "-y",
        audioPath,
      ]);

      log("Extracting audio with FFmpeg...");
      const output = await command.execute();

      if (output.code !== 0) {
        throw new Error(`FFmpeg failed: ${output.stderr}`);
      }
      log("Audio extracted successfully.");

      // 4. Upload & Transcribe
      const uploadUrl = await uploadFile(audioPath);
      const transcriptId = await requestTranscription(uploadUrl);
      const result = await waitForCompletion(transcriptId);

      log("TRANSCRIPTION COMPLETE!");

      // 5. Cleanup: Delete the temp audio file
      log("Cleaning up temporary audio file...");
      await remove(audioPath);
      log("Cleanup successful.");

      // 6. Display Result
      setTranscriptResult(result);

    } catch (err) {
      console.error(err);
      log(`Error: ${err}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      style={{
        padding: "40px",
        fontFamily: "sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
      }}
    >
      {/* Update Title to check visually if update applied */}
      <h1>Sync App POC v0.1.1 hello</h1>

      <button
        onClick={handleWorkflow}
        disabled={isProcessing}
        style={{
          padding: "12px 24px",
          fontSize: "16px",
          cursor: "pointer",
          marginBottom: "20px",
        }}
      >
        {isProcessing ? "Processing..." : "Select Video & Transcribe"}
      </button>

      {/* Logs Section */}
      <div
        style={{
          background: "#f4f4f4",
          padding: "15px",
          borderRadius: "8px",
          height: "150px",
          overflowY: "auto",
          border: "1px solid #ddd",
        }}
      >
        <strong>Logs:</strong>
        {logs.map((l, i) => (
          <div key={i} style={{ fontSize: "12px", marginTop: "4px" }}>
            {l}
          </div>
        ))}
      </div>

      {/* JSON Display Section */}
      {transcriptResult && (
        <div style={{ marginTop: "30px" }}>
          <h3>Transcription Result (JSON):</h3>
          <div
            style={{
              background: "#1e1e1e",
              color: "#a6e22e",
              padding: "20px",
              borderRadius: "8px",
              overflowX: "auto",
              maxHeight: "500px",
              overflowY: "auto",
            }}
          >
            <pre>{JSON.stringify(transcriptResult, null, 2)}</pre>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;