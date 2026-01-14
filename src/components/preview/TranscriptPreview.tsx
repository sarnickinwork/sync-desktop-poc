import { Box, Typography } from "@mui/material";

export default function TranscriptPreview({
  transcript,
}: {
  transcript: string;
}) {
  const lines = transcript.split("\n").filter(Boolean);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        p: 2,
        height: 400,
        overflowY: "auto",
        // Adapts to dark/light mode automatically
        bgcolor: "background.paper",
        color: "text.primary",
      }}
    >
      <Typography fontWeight={600} mb={1}>
        Transcript
      </Typography>

      {lines.map((line, i) => (
        <Box key={i} display="flex" gap={2} mb={1}>
          <Typography
            variant="caption"
            sx={{ minWidth: 30, color: "text.secondary" }}
          >
            {i + 1}.
          </Typography>
          <Typography variant="body2">{line}</Typography>
        </Box>
      ))}
    </Box>
  );
}
