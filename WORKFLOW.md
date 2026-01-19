# Transcript Processing Workflow

## Overview
This application provides a complete workflow for synchronizing video transcripts with timestamps using AI transcription (AssemblyAI) and optional manual transcript text mapping.

## Workflow Steps

### 1. Upload (Step 0)
- **Video Upload**: Select a video file (MP4, MKV, AVI, MOV)
- **Transcript Upload** (Optional): Upload a manual transcript text file
  - The text file should have numbered lines (e.g., "1 First sentence here")
  - You can specify a starting line number for processing

### 2. Preview & Configuration (Step 1)
- Preview the selected video
- Preview the uploaded transcript (if provided)
- Set the **Start Line Number** to specify where to begin reading from the transcript file
- This is useful if your transcript has headers or metadata you want to skip

### 3. Sync Processing (Step 2)
The workflow performs the following operations:

#### A. Local Audio Extraction
- Uses FFmpeg (sidecar) to extract audio from the video
- Converts to MP3 format for efficient processing
- Stores temporarily in the app data directory

#### B. Backend API Call
- **Timer Starts**: When the API request begins
- Sends the extracted audio and optional transcript to the backend
- Backend processes through AssemblyAI for transcription
- **Timer Stops**: When the response is received (success or error)
- API elapsed time is logged and displayed in results

#### C. Response Processing
- Backend returns AssemblyAI transcription data (single or multiple chunks)
- Frontend merges multiple transcription chunks if needed

#### D. Text Mapping (if manual transcript provided)
1. **Extract Human Transcript**: Reads from the specified line number, sanitizes the text
   - Removes line numbers
   - Removes speaker labels (e.g., "SPEAKER:")
   - Removes Q/A prefixes
2. **DTW Alignment**: Maps human transcript words to AI transcript timestamps using Dynamic Time Warping
3. **Confidence Scoring**: Calculates mapping confidence for each sentence
4. **SMI Generation**: Creates SAMI subtitle content (stored in state, not auto-downloaded)

### 4. Results (Step 3)

#### With Manual Transcript:
Shows **ResultsDisplay** component with:
- **Summary Card**:
  - Total sentences mapped
  - Average confidence percentage
  - Confidence breakdown (High/Medium/Low)
  - **API Response Time** (Timer display)
  - Download SMI button
  
- **Results Table**:
  - Sentence number
  - Original transcript text
  - Start timestamp (MM:SS.mmm)
  - End timestamp (MM:SS.mmm)
  - Confidence score with color coding:
    - Green: High (≥80%)
    - Orange: Medium (60-79%)
    - Red: Low (<60%)

#### Without Manual Transcript (AI-only):
Shows **SyncedPlayer** component with:
- Video player with synchronized AI-generated captions
- Basic sentence segmentation from AI transcription

## Key Features

### Timer Implementation
- Tracks API request/response time
- Starts when fetch begins
- Stops on success or error
- Displayed in results as "API Response: X.XXs"
- Provides performance metrics for the transcription process

### Text Sanitization
The system automatically cleans transcript text by removing:
- Line numbers (e.g., "1 ", "23 ")
- Speaker labels (e.g., "JOHN DOE: ")
- Question/Answer prefixes (e.g., "Q. ", "A. ")
- Leading/trailing whitespace

### DTW Alignment
Dynamic Time Warping algorithm:
- Fuzzy matches words between human and AI transcripts
- Handles minor spelling differences
- Interpolates timestamps for unmatched words
- Provides confidence scores for mapping quality

### SMI (SAMI) Subtitle Format
- Industry-standard subtitle format
- Compatible with most video players
- Includes styling (font, color, positioning)
- Downloadable after processing completes

## File Structure

```
src/
├── components/
│   ├── ResultsDisplay.tsx          # Results table and download UI
│   ├── TranscriptViewer.tsx        # JSON viewer for raw data
│   └── ...
├── hooks/
│   └── useTranscriptionWorkflow.ts # Main workflow orchestration + timer
├── pages/
│   └── TranscriptionPage.tsx       # Main UI with stepper
└── utils/
    ├── transcriptMergeUtils.ts     # Merge multiple transcripts
    ├── textProcessingUtils.ts      # Sanitization, extraction
    ├── textMappingUtils.ts         # DTW mapping orchestration
    ├── dtwAlignmentUtils.ts        # DTW algorithm implementation
    ├── smiGenerationUtils.ts       # SMI format generation
    ├── timeUtils.ts                # Time formatting utilities
    └── types.ts                    # TypeScript interfaces
```

## Development Notes

### Timer Implementation Details
1. **State Variables**:
   - `apiStartTime`: Stores `Date.now()` when API call begins
   - `apiElapsedTime`: Stores calculated duration in milliseconds

2. **Timer Flow**:
   ```typescript
   // Reset on workflow start
   setApiStartTime(null);
   setApiElapsedTime(null);
   
   // Start before API call
   const startTime = Date.now();
   setApiStartTime(startTime);
   
   // Stop on success
   const elapsedTime = Date.now() - startTime;
   setApiElapsedTime(elapsedTime);
   
   // Stop on error (in catch block)
   if (apiStartTime) {
     const elapsedTime = Date.now() - apiStartTime;
     setApiElapsedTime(elapsedTime);
   }
   ```

3. **Display Format**: Milliseconds converted to seconds with 2 decimal places

### Environment Variables
```env
VITE_API_URL=http://localhost:5000
```

### Backend Requirements
The backend should expose:
- **POST** `/finaltranscript`
  - Accepts: `FormData` with `AudioFiles[]` and optional `transcript` text file
  - Returns: AssemblyAI response (single object or array)
  - Response includes: `words` array with `text`, `start`, `end`, `confidence`

## Future Enhancements
- Real-time progress updates during transcription
- Support for multiple languages
- Batch processing of multiple videos
- Export to additional subtitle formats (SRT, VTT)
- Live preview of subtitle overlay during mapping
