import { Box, Typography } from "@mui/material";

type Props = {
  transcript: string;
};

export default function TranscriptPreview({ transcript }: Props) {
  const lines = transcript.split("\n").filter(Boolean);

  return (
    <Box
      sx={{
        border: "1px solid #e0e0e0",
        borderRadius: 2,
        p: 2,
        height: 400,
        overflowY: "auto",
        background: "#fafafa",
      }}
    >
      <Typography fontWeight={600} mb={1}>
        Transcript
      </Typography>

      {lines.map((line, index) => (
        <Box key={index} display="flex" gap={2} mb={1} alignItems="flex-start">
          <Typography variant="caption" sx={{ minWidth: 30, color: "#888" }}>
            {index + 1}.
          </Typography>

          <Typography variant="body2">{line}</Typography>
        </Box>
      ))}
    </Box>
  );
}
