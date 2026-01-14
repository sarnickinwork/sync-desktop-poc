import { Card, CardContent, Typography, Box } from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";

type VideoItem = {
  path: string;
  name: string;
};

type Props = {
  video: VideoItem | null;
  setVideo: (v: VideoItem | null) => void;
};

export default function VideoUploadCard({ video, setVideo }: Props) {
  const pickVideo = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Video", extensions: ["mp4", "mkv", "avi", "mov"] }],
    });

    if (!selected || Array.isArray(selected)) return;

    setVideo({
      path: selected,
      name: selected.split("\\").pop() || selected,
    });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography fontWeight={600}>Video</Typography>

        <Box
          onClick={pickVideo}
          sx={{
            border: "2px dashed #4caf50",
            borderRadius: 2,
            p: 3,
            mt: 2,
            textAlign: "center",
            cursor: "pointer",
            background: video ? "#f1f8e9" : "transparent",
          }}
        >
          <Typography>
            {video ? "Video selected" : "Click to select video"}
          </Typography>
          <Typography variant="caption">
            {video ? video.name : "Supports MP4, MKV, AVI, MOV"}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}
