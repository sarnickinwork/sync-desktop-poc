import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Card,
  CardContent,
  Typography,
  Box,
  useTheme,
  alpha,
  Button,
  Chip
} from "@mui/material";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import DescriptionIcon from '@mui/icons-material/Description';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';

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
    accept: {
      "text/plain": [".txt"],
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
      "application/rtf": [".rtf"]
    },
    multiple: false,
  });

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setTranscript(null);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: transcript ? 2 : 0,
        borderColor: transcript ? 'primary.main' : 'divider'
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography fontWeight={700} variant="h6" color="primary">Transcript File</Typography>
            <Typography variant="caption" color="text.secondary">
              Upload the corresponding key text file.
            </Typography>
          </Box>
        </Box>

        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed",
            borderColor: isDragActive ? "primary.main" : (transcript ? "success.main" : "primary.main"),
            borderRadius: 3,
            p: 4,
            mt: 2,
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: "pointer",
            background: isDragActive
              ? alpha(theme.palette.primary.main, 0.1)
              : (transcript
                ? alpha(theme.palette.success.main, 0.04)
                : "linear-gradient(180deg, rgba(25, 118, 210, 0.04) 0%, rgba(25, 118, 210, 0.01) 100%)"),
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              background: transcript ? alpha(theme.palette.success.main, 0.08) : "rgba(25, 118, 210, 0.08)",
              transform: "translateY(-2px)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
            }
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

          {transcript ? (
            <>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '50%',
                  bgcolor: 'success.light',
                  color: 'white',
                  mb: 2,
                  display: 'flex',
                  boxShadow: 2
                }}
              >
                <DescriptionIcon sx={{ fontSize: 32 }} />
              </Box>

              <Typography variant="h6" color="text.primary" fontWeight={600} gutterBottom align="center">
                {typeof transcript === 'string' ? "Manual Text" : transcript.name}
              </Typography>

              <Chip
                icon={<CheckCircleIcon />}
                label="Ready for Sync"
                color="success"
                variant="outlined"
                size="small"
                sx={{ mb: 2, bgcolor: 'background.paper' }}
              />

              <Button
                variant="outlined"
                color="error"
                size="small"
                startIcon={<DeleteOutlineIcon />}
                onClick={handleDelete}
                sx={{ mt: 1, bgcolor: 'background.paper', '&:hover': { bgcolor: '#ffebee' } }}
              >
                Remove File
              </Button>
            </>
          ) : (
            <>
              <Box
                sx={{
                  p: 2,
                  borderRadius: '50%',
                  bgcolor: isDragActive ? 'primary.main' : 'primary.light',
                  color: 'white',
                  mb: 2,
                  display: 'flex'
                }}
              >
                <CloudUploadIcon sx={{ fontSize: 32 }} />
              </Box>
              <Typography variant="h6" color={isDragActive ? "primary" : "text.primary"} fontWeight={600} gutterBottom>
                {isDragActive ? "Drop file here" : "Upload Transcript"}
              </Typography>
              <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 250 }}>
                Drag & drop or click to browse. Supports .txt, .docx, .rtf
              </Typography>
            </>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}
