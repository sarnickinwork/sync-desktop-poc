import { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { readFile, mkdir, exists, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join, downloadDir } from "@tauri-apps/api/path";

import {
  SimpleTranscriptDto,
  WordDTO,
  MappedSentenceResult,
  mergeTranscripts,
  extractHumanTranscriptFromContent,
  performTextMapping,
} from "../utils";

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
  const [transcriptResult, setTranscriptResult] = useState<any>(null);
  const [mappedResult, setMappedResult] = useState<MappedSentenceResult[] | null>(null);
  const [smiContent, setSmiContent] = useState<string | null>(null);
  const [dvtContent, setDvtContent] = useState<string | null>(null);
  const [synContent, setSynContent] = useState<string | null>(null);
  const [apiStartTime, setApiStartTime] = useState<number | null>(null);
  const [apiElapsedTime, setApiElapsedTime] = useState<number | null>(null);
  const [projectFolderPath, setProjectFolderPath] = useState<string | null>(null);

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
      const videoFileName = videoPath.split("\\").pop() || videoPath.split("/").pop() || "project";
      const projectName = videoFileName.replace(/\.[^/.]+$/, "").trim();
      
      // Create project folder in Downloads
      const downloadsPath = await downloadDir();
      const projectFolder = await join(downloadsPath, projectName);
      
      // Create main project folder
      if (!(await exists(projectFolder))) {
        await mkdir(projectFolder);
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
      const initialSynPath = await join(projectFolder, `${projectName}.syn`);
      const { generateSYN } = await import('../utils/synGenerationUtils');
      const initialSyn = generateSYN({
        videoFilename: videoFileName,
        videoPath: `media/${videoFileName}`,
        videoDuration: 0, // Will be updated later
        subtitleFilename: `${projectName}.smi`,
        subtitlePath: `media/${projectName}.smi`,
        transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
        transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
        startLine,
        sentences: [] // Will be populated after processing
      });
      
      await writeTextFile(initialSynPath, initialSyn);
      log("Initial .syn file created (resume checkpoint)");

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

      // Start timer
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

      // Stop timer
      const elapsedTime = Date.now() - startTime;
      setApiElapsedTime(elapsedTime);
      log(`Backend processing complete! (${(elapsedTime / 1000).toFixed(2)}s)`);
      setTranscriptResult(json);

      // --- STEP 5: POST-PROCESSING ---
      log("Starting post-processing...");

      // Convert response(s) to SimpleTranscriptDto format
      // Handle both single response and array of responses
      let transcriptsArray: SimpleTranscriptDto[];

      if (Array.isArray(json)) {
        log(`Received ${json.length} transcript chunks. Merging...`);
        transcriptsArray = json.map((item: any) => convertToSimpleTranscriptDto(item));
      } else {
        log("Received single transcript response.");
        transcriptsArray = [convertToSimpleTranscriptDto(json)];
      }

      // Merge all transcripts into one
      const mergedTranscript = mergeTranscripts(transcriptsArray);
      log(`Merged transcript has ${mergedTranscript.words.length} words.`);

      // --- STEP 6: TEXT MAPPING (if manual transcript provided) ---
      if (manualTranscript) {
        log(`Extracting human transcript from line ${startLine}...`);

        // Sanitize and extract from the given line number
        const sanitizedHumanText = extractHumanTranscriptFromContent(
          manualTranscript,
          startLine
        );

        log(`Extracted ${sanitizedHumanText.split(' ').length} words from human transcript.`);

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

        // Generate DVT file
        log("Generating DVT (DepoView) file...");
        const { generateDVT } = await import('../utils/dvtGenerationUtils');
        const videoFilename = videoPath.split('\\').pop() || 'video.mp4';
        const dvt = generateDVT({
          title: `Deposition - ${videoFilename}`,
          videoFilename,
          videoPath: `media/${videoFilename}`,
          duration: mappingResult.sentences[mappingResult.sentences.length - 1]?.end || 0,
          createdDate: new Date().toISOString(),
          sentences: mappingResult.sentences
        });
        setDvtContent(dvt);
        log("DVT content generated successfully!");

        // Generate SYN file
        log("Generating SYN (proprietary) file...");
        const { generateSYN } = await import('../utils/synGenerationUtils');
        const syn = generateSYN({
          videoFilename,
          videoPath: `media/${videoFilename}`,
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
          const synPath = await join(projectFolder, `${projectName}.syn`);
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
      log("Cleaning up temporary files...");
      await remove(audioPath);
      log("Cleanup successful. Workflow complete!");
    } catch (err: any) {
      // Stop timer on error as well
      if (apiStartTime) {
        const elapsedTime = Date.now() - apiStartTime;
        setApiElapsedTime(elapsedTime);
      }
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
    mappedResult,
    smiContent,
    dvtContent,
    synContent,
    apiElapsedTime,
    projectFolderPath,
    handleWorkflow,
  };
}

