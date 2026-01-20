import { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { readFile, readTextFile, mkdir, exists, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join, downloadDir } from "@tauri-apps/api/path";

import {
  SimpleTranscriptDto,
  WordDTO,
  MappedSentenceResult,
  mergeTranscripts,
  extractHumanTranscriptFromContent,
  performTextMapping,
  generateSYN,
  parseSYN,
  SYNMetadata
} from "../utils";
import { VideoItem } from "../utils/types";

const API_URL = import.meta.env.VITE_API_URL;

/**
 * Convert raw AssemblyAI response to SimpleTranscriptDto format
 */
function convertToSimpleTranscriptDto(rawResponse: any): SimpleTranscriptDto {
  const words: WordDTO[] = (rawResponse.words || []).map((w: any) => ({
    text: w.text,
    start: w.start,
    end: w.end,
    confidence: w.confidence || 0,
  }));

  return {
    fullText: rawResponse.text || "",
    sentences: [], // We don't need sentences for merging, words are sufficient
    words,
  };
}

export function useTranscriptionWorkflow() {
  const [logs, setLogs] = useState<string[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcriptResult, setTranscriptResult] = useState<any>(null);
  const [mappedResult, setMappedResult] = useState<MappedSentenceResult[] | null>(null);
  const [smiContent, setSmiContent] = useState<string | null>(null);
  const [dvtContent, setDvtContent] = useState<string | null>(null);
  const [synContent, setSynContent] = useState<string | null>(null);
  const [apiStartTime, setApiStartTime] = useState<number | null>(null);
  const [apiElapsedTime, setApiElapsedTime] = useState<number | null>(null);
  const [projectFolderPath, setProjectFolderPath] = useState<string | null>(null);

  const log = (msg: string) => setLogs((prev) => [...prev, msg]);

  // Updated signature to accept VideoItem[] (multiple videos)
  const handleWorkflow = async (
    videos: VideoItem[],
    manualTranscript: string | null,
    startLine: number = 0
  ) => {
    if (videos.length === 0) {
      log("No videos provided.");
      return;
    }

    // Use first video for naming/project creation
    const firstVideo = videos[0];

    try {
      setIsProcessing(true);
      setError(null);
      setLogs([]);
      setTranscriptResult(null);
      setMappedResult(null);
      setSmiContent(null);
      setDvtContent(null);
      setSynContent(null);
      setApiStartTime(null);
      setApiElapsedTime(null);
      setProjectFolderPath(null);

      if (!API_URL) throw new Error("VITE_API_URL is missing in .env");

      // --- STEP 0: CREATE PROJECT FOLDER STRUCTURE ---
      log("Creating project folder structure...");

      // Extract project name from video path
      const projectDisplayName = firstVideo.name.replace(/\.[^/.]+$/, "").trim();

      // Create project folder in Downloads
      const downloadsPath = await downloadDir();
      const projectFolder = await join(downloadsPath, projectDisplayName);

      // Create main project folder
      if (!(await exists(projectFolder))) {
      const videoFileName = videoPath.split("\\").pop() || videoPath.split("/").pop() || "project";
      const projectName = videoFileName.replace(/\.[^/.]+$/, "").trim();

      // Create project folder in Downloads
      const downloadsPath = await downloadDir();
      const projectFolder = await join(downloadsPath, projectName);

      // Check if project folder already exists
      let existingSynData: any = null;
      if (await exists(projectFolder)) {
        log(`Project folder exists: ${projectFolder}`);
        setProjectFolderPath(projectFolder);

        // Check for existing .syn file
        const synPath = await join(projectFolder, `${projectName}.syn`);
        if (await exists(synPath)) {
          log("Found existing .syn file. Attempting to resume...");
          try {
            const synContentRaw = await readTextFile(synPath);
            existingSynData = parseSYN(synContentRaw);
            log("Successfully parsed existing .syn file.");
          } catch (e) {
            log(`Warning: Failed to parse existing .syn file: ${e}`);
          }
        }
      } else {
        // Create project folder
        await mkdir(projectFolder);
        setProjectFolderPath(projectFolder);
        log(`Project folder created: ${projectFolder}`);
      }

      // Create subfolders
      const mediaFolder = await join(projectFolder, "media");
      const transcriptionFolder = await join(projectFolder, "transcription");

      if (!(await exists(mediaFolder))) {
        await mkdir(mediaFolder);
      }
      if (!(await exists(transcriptionFolder))) {
        await mkdir(transcriptionFolder);
      }

      // Store project folder path
      setProjectFolderPath(projectFolder);
      log(`Project folder created: ${projectFolder}`);

      // Create initial .syn file (resume checkpoint)
      const initialSynPath = await join(projectFolder, `${projectDisplayName}.syn`);
      const { generateSYN } = await import('../utils/synGenerationUtils');
      const initialSyn = generateSYN({
        videoFilename: firstVideo.name,
        videoPath: `media/${firstVideo.name}`,
        videoDuration: 0, // Will be updated later
        subtitleFilename: `${projectDisplayName}.smi`,
        subtitlePath: `media/${projectDisplayName}.smi`,
        transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
        transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
        startLine,
        sentences: [] // Will be populated after processing
      });

      await writeTextFile(initialSynPath, initialSyn);
      log("Initial .syn file created (resume checkpoint)");

      // --- STEP 1: LOCAL AUDIO EXTRACTION (FFmpeg) FOR ALL VIDEOS ---
      const appData = await appDataDir();
      if (!(await exists(appData))) {
        await mkdir(appData);
      }

      const audioFilesForUpload: File[] = [];

      for (let i = 0; i < videos.length; i++) {
        const video = videos[i];
        log(`Processing video ${i + 1}/${videos.length}: ${video.name}`);

        // Define temp path for the audio
        const audioPath = await join(appData, `temp_audio_${i}.mp3`);

        log(`Extracting audio from ${video.name}...`);
        const command = Command.sidecar("binaries/ffmpeg", [
          "-i",
          video.path,
          "-vn", // No video
          "-acodec",
          "libmp3lame", // Encode to MP3
          "-y", // Overwrite if exists
          audioPath,
        ]);

        const output = await command.execute();

        if (output.code !== 0) {
          throw new Error(`FFmpeg failed for ${video.name}: ${output.stderr}`);
        }
        log(`Audio extracted for ${video.name}.`);

        // Read into memory
        const audioData = await readFile(audioPath);
        const audioBlob = new Blob([audioData], { type: "audio/mp3" });
        const audioFile = new File([audioBlob], `audio_${i}.mp3`, { type: "audio/mp3" });
        audioFilesForUpload.push(audioFile);

        // Remove temp file from disk as we have it in memory
        await remove(audioPath);
      }

      // --- STEP 3: PREPARE FORM DATA FOR BACKEND ---
      const formData = new FormData();
      // Append all audio files. Backend must assume the order in FormData is the playback order.
      audioFilesForUpload.forEach(file => {
        formData.append("AudioFiles", file);
      });
      formData.append("startLine", startLine.toString());
      // Create subfolders if they don't exist
      const mediaFolder = await join(projectFolder, "media");
      const transcriptionFolder = await join(projectFolder, "transcription");

      if (!(await exists(mediaFolder))) await mkdir(mediaFolder);
      if (!(await exists(transcriptionFolder))) await mkdir(transcriptionFolder);

      // Initialize or load .syn file
      const synPath = await join(projectFolder, `${projectName}.syn`);
      let currentSynData = existingSynData;

      if (!currentSynData) {
        // Create initial .syn file
        // generateSYN is already imported from ../utils
        const initialSyn = generateSYN({
          videoFilename: videoFileName,
          videoPath: `media/${videoFileName}`,
          videoDuration: 0,
          subtitleFilename: `${projectName}.smi`,
          subtitlePath: `media/${projectName}.smi`,
          transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
          transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
          startLine,
          sentences: []
        });

        await writeTextFile(synPath, initialSyn);
        log("Initial .syn file created (resume checkpoint)");
      } else {
        // Check for API timer resume
        if (currentSynData.stats?.apiElapsedTime) {
          setApiElapsedTime(currentSynData.stats.apiElapsedTime);
        }
      }

      // --- STEP 1 & 2: AUDIO EXTRACTION & API CALL (Or Resume) ---
      let mergedTranscript: SimpleTranscriptDto;

      // Check if we already have the raw transcript in .syn
      if (currentSynData && currentSynData.rawResponse) {
        log("RESUMING: Found cached AI transcript in .syn file.");
        log("Skipping audio extraction and API call.");

        // Reconstruct the SimpleTranscriptDto from the partial data
        // We cast it because we know the structure matches what we saved
        mergedTranscript = currentSynData.rawResponse as SimpleTranscriptDto;

        setTranscriptResult(mergedTranscript); // Update UI state
      } else {
        // --- PERFORM NORMAL API WORKFLOW ---

        // Local Audio Extraction
        log(`Processing local video: ${videoPath}`);

      // --- STEP 4: SEND TO BACKEND ---
      log(`Sending ${audioFilesForUpload.length} audio files to backend...`);
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

        // Read extracted audio file
        log("Reading extracted audio file...");
        const audioData = await readFile(audioPath);
        const audioBlob = new Blob([audioData], { type: "audio/mp3" });
        const audioFile = new File([audioBlob], "audio.mp3", {
          type: "audio/mp3",
        });

        // Prepare FormData
        const formData = new FormData();
        formData.append("AudioFiles", audioFile);
        formData.append("startLine", startLine.toString());

        if (manualTranscript) {
          const textBlob = new Blob([manualTranscript], { type: "text/plain" });
          const textFile = new File([textBlob], "transcript.txt", {
            type: "text/plain",
          });
          formData.append("transcript", textFile);
          log("Attached manual transcript file.");
        }

        // Send to Backend
        log(`Sending to backend (${API_URL}/finaltranscript)...`);
        const startTime = Date.now();
        setApiStartTime(startTime);

        const response = await fetch(`${API_URL}/finaltranscript`, {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Server error (${response.status}): ${errorText}`);
        }

        const json = await response.json();

        const elapsedTime = Date.now() - startTime;
        setApiElapsedTime(elapsedTime);
        log(`Backend processing complete! (${(elapsedTime / 1000).toFixed(2)}s)`);
        setTranscriptResult(json);

        // Post-processing: Merge chunks if needed
        let transcriptsArray: SimpleTranscriptDto[];
        if (Array.isArray(json)) {
          transcriptsArray = json.map((item: any) => convertToSimpleTranscriptDto(item));
        } else {
          transcriptsArray = [convertToSimpleTranscriptDto(json)];
        }
        mergedTranscript = mergeTranscripts(transcriptsArray);
        log(`Merged transcript has ${mergedTranscript.words.length} words.`);

        // --- SAVE CHECKPOINT: RAW TRANSCRIPT ---
        log("Saving API response to .syn file (Checkpoint)...");

        // Construct updated metadata
        const checkpointMetadata: SYNMetadata = {
          videoFilename: videoFileName,
          videoPath: `media/${videoFileName}`,
          videoDuration: 0,
          subtitleFilename: `${projectName}.smi`,
          subtitlePath: `media/${projectName}.smi`,
          transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
          transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
          startLine,
          sentences: [], // Not mapped yet
          // New Fields
          rawTranscript: mergedTranscript,
          apiElapsedTime: elapsedTime,
          processingState: {
            isApiComplete: true,
            isSanitizationComplete: false,
            isMappingComplete: false
          }
        };

        const synContent = generateSYN(checkpointMetadata);
        await writeTextFile(synPath, synContent);
        log("Checkpoint saved: RAW TRANSCRIPT.");

        // Cleanup audio file immediately since we have the data
        await remove(audioPath);
        audioPath = ""; // Prevent cleanup from trying to delete it again
      }

      // --- STEP 6: TEXT MAPPING (if manual transcript provided) ---
      if (manualTranscript) {
        log(`Extracting human transcript from line ${startLine}...`);

        let sanitizedHumanText = "";

        // Check if we already have sanitized text in .syn
        if (currentSynData && currentSynData.transcript?.sanitizedText && currentSynData.transcript.startLine === startLine) {
          log("RESUMING: Found sanitized text in .syn file.");
          sanitizedHumanText = currentSynData.transcript.sanitizedText;
        } else {
          // Sanitize and extract from the given line number
          sanitizedHumanText = extractHumanTranscriptFromContent(
            manualTranscript,
            startLine
          );

          // --- SAVE CHECKPOINT: SANITIZED TEXT ---
          log("Saving sanitized text to .syn file (Checkpoint)...");
          const checkpointMetadata: SYNMetadata = {
            videoFilename: videoFileName,
            videoPath: `media/${videoFileName}`,
            videoDuration: 0,
            subtitleFilename: `${projectName}.smi`,
            subtitlePath: `media/${projectName}.smi`,
            transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
            transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
            startLine,
            sentences: [], // Not mapped yet
            // Preserve previous fields
            rawTranscript: mergedTranscript,
            apiElapsedTime: apiElapsedTime || (currentSynData?.stats?.apiElapsedTime || 0),
            // New field
            sanitizedTranscript: sanitizedHumanText,
            processingState: {
              isApiComplete: true,
              isSanitizationComplete: true,
              isMappingComplete: false
            }
          };

          const synContent = generateSYN(checkpointMetadata);
          await writeTextFile(synPath, synContent);
          log("Checkpoint saved: SANITIZED TEXT.");
          // throw new Error("SIMULATED CRASH: App died after Sanitization!"); // FOR TESTING
        }

        log(`Extracted ${sanitizedHumanText.split(' ').length} words from human transcript.`);

        // Give UI a moment to update/render before heavy blocking calc
        await new Promise(resolve => setTimeout(resolve, 100));

        // Perform DTW text mapping
        log("Performing DTW text mapping...");
        const mappingResult = performTextMapping(sanitizedHumanText, mergedTranscript);

        log(`Text mapping complete! ${mappingResult.totalSentences} sentences mapped.`);
        setMappedResult(mappingResult.sentences);

        // --- STEP 7: GENERATE SMI, DVT, and SYN (Store in state, don't auto-download) ---
        log("Generating SMI subtitle content...");
        const { generateSMI } = await import('../utils/smiGenerationUtils');
        const smi = generateSMI(mappingResult.sentences);
        setSmiContent(smi);
        log("SMI content generated successfully!");

        // Generate DVT (DepoView) file
        log("Generating DVT (DepoView) file...");
        const { generateDVT } = await import('../utils/dvtGenerationUtils');

        // Use first video for metadata reference
        const dvt = generateDVT({
          title: `Deposition - ${projectDisplayName}`,
          videoFilename: firstVideo.name,
          videoPath: `media/${firstVideo.name}`,
          duration: mappingResult.sentences[mappingResult.sentences.length - 1]?.end || 0,
          createdDate: new Date().toISOString(),
          sentences: mappingResult.sentences
        });
        setDvtContent(dvt);
        log("DVT content generated successfully!");

        // Generate SYN file
        log("Generating SYN (proprietary) file...");
        // generateSYN is imported from utils
        const syn = generateSYN({
          videoFilename: firstVideo.name,
          videoPath: `media/${firstVideo.name}`,
          videoDuration: mappingResult.sentences[mappingResult.sentences.length - 1]?.end || 0,
          subtitleFilename: 'subtitle.smi',
          subtitlePath: 'media/subtitle.smi',
          transcriptFilename: 'transcript.txt',
          transcriptPath: 'transcript/transcript.txt',
          startLine,
          sentences: mappingResult.sentences
        });
        setSynContent(syn);
        log("SYN content generated successfully!");

        // Update .syn file in project folder with complete data
        if (projectFolder) {
          const synPath = await join(projectFolder, `${projectDisplayName}.syn`);
        // Update .syn file in project folder with complete data
        // Update .syn file in project folder with complete data
        if (projectFolder) {
          const finalMetadata: SYNMetadata = {
            videoFilename: videoFileName,
            videoPath: `media/${videoFileName}`,
            videoDuration: mappingResult.sentences[mappingResult.sentences.length - 1]?.end || 0,
            subtitleFilename: `${projectName}.smi`,
            subtitlePath: `media/${projectName}.smi`,
            transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
            transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
            startLine,
            sentences: mappingResult.sentences,
            // Keep our resumable fields
            rawTranscript: mergedTranscript,
            sanitizedTranscript: sanitizedHumanText,
            apiElapsedTime: apiElapsedTime || (currentSynData?.stats?.apiElapsedTime || 0),
            processingState: {
              isApiComplete: true,
              isSanitizationComplete: true,
              isMappingComplete: true
            }
          };

          const syn = generateSYN(finalMetadata);
          setSynContent(syn); // Update state

          // const synPath = await join(projectFolder, `${projectName}.syn`); // Already defined above
          await writeTextFile(synPath, syn);
          log("Updated .syn file in project folder with complete data");
        }
      } else {
        log("No manual transcript provided. Skipping text mapping.");
        // If no manual transcript, just use the AI sentences directly
        // Convert merged words to basic sentences for display
        setMappedResult(null);
      }

      // --- STEP 8: CLEANUP ---
      log("Workflow complete!");
      log("Cleaning up temporary files...");
      if (audioPath && await exists(audioPath)) {
        await remove(audioPath);
      }
      log("Cleanup successful. Workflow complete!");
    } catch (err: any) {
      // Stop timer on error as well
      if (apiStartTime) {
        const elapsedTime = Date.now() - apiStartTime;
        setApiElapsedTime(elapsedTime);
      }
      console.error(err);
      const errorMsg = err.message || JSON.stringify(err);
      setError(errorMsg);
      log(`Error: ${errorMsg}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return {
    logs,
    isProcessing,
    error,
    transcriptResult,
    mappedResult,
    smiContent,
    dvtContent,
    synContent,
    apiElapsedTime,
    projectFolderPath,
    handleWorkflow,
  };
}
