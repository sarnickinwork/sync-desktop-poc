import { useState } from "react";
import { Command } from "@tauri-apps/plugin-shell";
import { readFile, readTextFile, mkdir, exists, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { appDataDir, join, downloadDir } from "@tauri-apps/api/path";
import { SimpleTranscriptDto, WordDTO, MappedSentenceResult, mergeTranscripts, extractHumanTranscriptFromContent, performTextMapping, generateSYN, parseSYN, SYNMetadata } from "../utils";
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
        await mkdir(projectFolder);
        log(`Created project folder: ${projectFolder}`);
      } else {
        log(`Project folder exists: ${projectFolder}`);
      }
      setProjectFolderPath(projectFolder);

      // Initialize .syn file path
      const synPath = await join(projectFolder, `${projectDisplayName}.syn`);

      // Initialize state for resumability
      let existingSynData: any = null;

      // Check for existing .syn file to RESUME
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

      // Create subfolders
      const mediaFolder = await join(projectFolder, "media");
      const transcriptionFolder = await join(projectFolder, "transcription");
      if (!(await exists(mediaFolder))) {
        await mkdir(mediaFolder);
      }
      if (!(await exists(transcriptionFolder))) {
        await mkdir(transcriptionFolder);
      }

      // Create initial .syn file if it doesn't exist
      if (!existingSynData) {
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
        await writeTextFile(synPath, initialSyn);
        log("Initial .syn file created (resume checkpoint)");
      }

      // --- STEP 1 & 2: PROCESS TRANSCRIPT (Resume or Generate) ---
      let mergedTranscript: SimpleTranscriptDto;

      // Check if we already have the raw transcript in .syn
      if (existingSynData && existingSynData.rawResponse &&
        existingSynData.rawResponse.words &&
        existingSynData.rawResponse.words.length > 0) {
        log("RESUMING: Found cached AI transcript in .syn file.");
        log("Skipping audio extraction and API call.");
        mergedTranscript = existingSynData.rawResponse as SimpleTranscriptDto;
        setTranscriptResult(mergedTranscript);
        log(`Loaded ${mergedTranscript.words.length} words from cache.`);
      } else {
        // --- PERFORM AUDIO EXTRACTION AND API CALL ---
        log(`Processing ${videos.length} video(s)...`);

        const appData = await appDataDir();
        if (!(await exists(appData))) {
          await mkdir(appData);
        }

        const audioFilesForUpload: File[] = [];

        // Extract audio from all videos
        for (let i = 0; i < videos.length; i++) {
          const video = videos[i];
          log(`Processing video ${i + 1}/${videos.length}: ${video.name}`);

          const audioPath = await join(appData, `temp_audio_${i}.mp3`);
          log(`Extracting audio from ${video.name}...`);

          const command = Command.sidecar("binaries/ffmpeg", [
            "-i", video.path,
            "-vn",
            "-acodec", "libmp3lame",
            "-y",
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

          // Remove temp file
          await remove(audioPath);
        }

        // Prepare FormData
        const formData = new FormData();
        audioFilesForUpload.forEach(file => {
          formData.append("AudioFiles", file);
        });
        formData.append("startLine", startLine.toString());

        if (manualTranscript) {
          const textBlob = new Blob([manualTranscript], { type: "text/plain" });
          const textFile = new File([textBlob], "transcript.txt", { type: "text/plain" });
          formData.append("transcript", textFile);
          log("Attached manual transcript file.");
        }

        // Send to Backend
        log(`Sending ${audioFilesForUpload.length} audio file(s) to backend...`);
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

        // Merge transcripts
        let transcriptsArray: SimpleTranscriptDto[];
        if (Array.isArray(json)) {
          transcriptsArray = json.map((item: any) => convertToSimpleTranscriptDto(item));
        } else {
          transcriptsArray = [convertToSimpleTranscriptDto(json)];
        }

        mergedTranscript = mergeTranscripts(transcriptsArray);
        log(`Merged transcript has ${mergedTranscript.words.length} words.`);

        // Save checkpoint
        log("Saving API response to .syn file (Checkpoint)...");
        const checkpointMetadata: SYNMetadata = {
          videoFilename: firstVideo.name,
          videoPath: `media/${firstVideo.name}`,
          videoDuration: 0,
          subtitleFilename: `${projectDisplayName}.smi`,
          subtitlePath: `media/${projectDisplayName}.smi`,
          transcriptFilename: manualTranscript ? "transcript.txt" : "generated_transcript.txt",
          transcriptPath: `transcription/${manualTranscript ? "transcript.txt" : "generated_transcript.txt"}`,
          startLine,
          sentences: [],
          rawTranscript: mergedTranscript,
          apiElapsedTime: elapsedTime,
          processingState: {
            isApiComplete: true,
            isSanitizationComplete: false,
            isMappingComplete: false
          }
        };
        const synContentCheckpoint = generateSYN(checkpointMetadata);
        await writeTextFile(synPath, synContentCheckpoint);
        log("Checkpoint saved: RAW TRANSCRIPT.");
      }

      // --- STEP 3: TEXT MAPPING (if manual transcript provided) ---
      if (manualTranscript) {
        log(`Extracting human transcript from line ${startLine}...`);
        let sanitizedHumanText = "";

        // Check if we already have sanitized text
        if (existingSynData && existingSynData.sanitizedTranscript && existingSynData.transcript?.startLine === startLine) {
          log("RESUMING: Found sanitized text in .syn file.");
          sanitizedHumanText = existingSynData.sanitizedTranscript;
        } else {
          sanitizedHumanText = extractHumanTranscriptFromContent(manualTranscript, startLine);

          // Save sanitization checkpoint
          log("Saving sanitized text to .syn file (Checkpoint)...");
          const checkpointMetadata: SYNMetadata = {
            videoFilename: firstVideo.name,
            videoPath: `media/${firstVideo.name}`,
            videoDuration: 0,
            subtitleFilename: `${projectDisplayName}.smi`,
            subtitlePath: `media/${projectDisplayName}.smi`,
            transcriptFilename: "transcript.txt",
            transcriptPath: `transcription/transcript.txt`,
            startLine,
            sentences: [],
            rawTranscript: mergedTranscript,
            apiElapsedTime: apiElapsedTime || (existingSynData?.apiElapsedTime || 0),
            sanitizedTranscript: sanitizedHumanText,
            processingState: {
              isApiComplete: true,
              isSanitizationComplete: true,
              isMappingComplete: false
            }
          };
          const synContentCheckpoint = generateSYN(checkpointMetadata);
          await writeTextFile(synPath, synContentCheckpoint);
          log("Checkpoint saved: SANITIZED TEXT.");
        }

        log(`Extracted ${sanitizedHumanText.split(' ').length} words from human transcript.`);

        // Check if text mapping is already complete
        let mappingResult: any;

        if (existingSynData && existingSynData.processingState?.isMappingComplete &&
          existingSynData.synchronization?.sentences &&
          existingSynData.synchronization.sentences.length > 0) {
          log("RESUMING: Found completed text mapping in .syn file.");
          log("Skipping DTW text mapping...");

          // Use cached mapping result
          mappingResult = {
            totalSentences: existingSynData.synchronization.sentences.length,
            sentences: existingSynData.synchronization.sentences.map((s: any) => ({
              sentence: s.text,
              start: s.start,
              end: s.end,
              confidence: s.confidence
            }))
          };
          setMappedResult(mappingResult.sentences);
        } else {
          // Perform text mapping`
          await new Promise(resolve => setTimeout(resolve, 100));

          // SIMULATED CRASH FOR TESTING - Remove this line after testing
          // throw new Error("SIMULATED CRASH: App died before text mapping!");

          log("Performing DTW text mapping...");
          mappingResult = performTextMapping(sanitizedHumanText, mergedTranscript);
          log(`Text mapping complete! ${mappingResult.totalSentences} sentences mapped.`);
          setMappedResult(mappingResult.sentences);
        }

        // Generate output files
        log("Generating SMI subtitle content...");
        const { generateSMI } = await import('../utils/smiGenerationUtils');
        const smi = generateSMI(mappingResult.sentences);
        setSmiContent(smi);
        log("SMI content generated successfully!");

        log("Generating DVT (DepoView) file...");
        const { generateDVT } = await import('../utils/dvtGenerationUtils');
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

        log("Generating SYN (proprietary) file...");
        const finalMetadata: SYNMetadata = {
          videoFilename: firstVideo.name,
          videoPath: `media/${firstVideo.name}`,
          videoDuration: mappingResult.sentences[mappingResult.sentences.length - 1]?.end || 0,
          subtitleFilename: `${projectDisplayName}.smi`,
          subtitlePath: `media/${projectDisplayName}.smi`,
          transcriptFilename: "transcript.txt",
          transcriptPath: `transcription/transcript.txt`,
          startLine,
          sentences: mappingResult.sentences,
          rawTranscript: mergedTranscript,
          sanitizedTranscript: sanitizedHumanText,
          apiElapsedTime: apiElapsedTime || (existingSynData?.apiElapsedTime || 0),
          processingState: {
            isApiComplete: true,
            isSanitizationComplete: true,
            isMappingComplete: true
          }
        };
        const syn = generateSYN(finalMetadata);
        setSynContent(syn);
        await writeTextFile(synPath, syn);
        log("Updated .syn file in project folder with complete data");
        log("SYN content generated successfully!");
      } else {
        log("No manual transcript provided. Skipping text mapping.");
        setMappedResult(null);
      }

      log("Workflow complete!");

    } catch (err: any) {
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