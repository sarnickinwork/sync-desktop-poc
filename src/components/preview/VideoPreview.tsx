import { Box, Typography } from "@mui/material";

export default function VideoPreview({ videoPath }: { videoPath: string }) {
  return (
    <Box>
      <Typography fontWeight={600} mb={1}>
        Video Preview
      </Typography>

      <video
        src={videoPath}
        controls
        preload="metadata"
        style={{
          width: "100%",
          maxHeight: 400,
          borderRadius: 8,
          background: "#000",
        }}
      />

      {/* <video
        src="https://www.w3schools.com/html/mov_bbb.mp4"
        controls
        style={{ width: "100%" }}
      /> */}
    </Box>
  );
}
