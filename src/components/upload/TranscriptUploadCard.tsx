import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  alpha,
} from "@mui/material";

type Props = {
  transcript: File | string | null;
  setTranscript: (f: File | null) => void;
  onBrowse?: () => void;
};

export default function TranscriptUploadCard({
  transcript,
  setTranscript,
  onBrowse,
}: Props) {
  const theme = useTheme();

  const onDrop = useCallback(
    (files: File[]) => {
      setTranscript(files[0]);
    },
    [setTranscript]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [] },
    multiple: false,
  });

  // Helper to determine if the "Blue" active state should be shown
  const isActive = isDragActive || transcript;

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography fontWeight={600}>Transcript</Typography>

        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            // Blue if dragging or file selected, otherwise gray
            borderColor: isActive ? "primary.main" : "text.secondary",
            borderRadius: 2,
            p: 3,
            mt: 2,
            textAlign: "center",
            cursor: "pointer",
            transition: "all 0.2s ease",
            // Blue tint background if active/selected
            bgcolor: isActive
              ? alpha(theme.palette.primary.main, 0.1)
              : "transparent",
          }}
          onClick={(e) => {
            if (onBrowse) {
              // Prevent Dropzone from opening its dialog if we have a custom browser
              e.stopPropagation();
              onBrowse();
            }
            // Otherwise, let Dropzone handle it (defaults to opening file dialog)
          }}
        >
          <input {...getInputProps()} />

          <Typography color="textPrimary">
            {transcript ? "Transcript uploaded" : "Drag & drop transcript here"}
          </Typography>

          <Typography variant="caption" color="textSecondary">
            {transcript
              ? typeof transcript === "string"
                ? "Manual Text"
                : transcript.name
              : "or click to browse"}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
