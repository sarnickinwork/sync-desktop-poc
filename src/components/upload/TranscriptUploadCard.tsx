import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Card, CardContent, Typography, Box } from "@mui/material";

type Props = {
  transcript: File | null;
  setTranscript: (f: File | null) => void;
};

export default function TranscriptUploadCard({
  transcript,
  setTranscript,
}: Props) {
  const onDrop = useCallback((files: File[]) => {
    setTranscript(files[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "text/*": [] },
    multiple: false,
  });

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography fontWeight={600}>Transcript</Typography>

        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed #2196f3",
            borderRadius: 2,
            p: 3,
            mt: 2,
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? "#e3f2fd" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          <Typography>
            {transcript ? transcript.name : "Drag & drop transcript here"}
          </Typography>
          <Typography variant="caption">or click to browse</Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
