import { Box, Typography } from "@mui/material";

type Props = {
  videoPath: string;
};

export default function VideoPreview({ videoPath }: Props) {
  return (
    <Box>
      <Typography fontWeight={600} mb={1}>
        Video
      </Typography>

      <Box
        sx={{
          border: "1px solid #e0e0e0",
          borderRadius: 2,
          overflow: "hidden",
          background: "#000",
        }}
      >
        <video
          src={`file://${videoPath}`}
          controls
          style={{ width: "100%", maxHeight: 400 }}
        />
      </Box>
    </Box>
  );
}
