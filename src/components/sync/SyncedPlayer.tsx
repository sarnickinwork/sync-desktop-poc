import { useEffect, useRef, useState } from "react";
import { Box, Typography, useTheme, alpha } from "@mui/material";

type Line = {
  text: string;
  start: number;
  end: number;
};

type Props = {
  videoUrl: string;
  lines: Line[];
};

export default function SyncedPlayer({ videoUrl, lines }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const theme = useTheme();

  // 🔥 Fix for Tauri/WebView media not initializing
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    video.load();

    const tryPlay = async () => {
      try {
        await video.play();
        video.pause();
      } catch {}
    };

    tryPlay();
  }, [videoUrl]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const update = () => setCurrentTime(video.currentTime * 1000);
    video.addEventListener("timeupdate", update);
    return () => video.removeEventListener("timeupdate", update);
  }, []);

  return (
    <Box display="grid" gridTemplateColumns="1fr 1fr" gap={3}>
      {/* VIDEO */}
      <Box>
        <Typography fontWeight={600}>Video</Typography>
        <video
          key={videoUrl}
          ref={videoRef}
          src={videoUrl}
          controls
          preload="auto"
          style={{ width: "100%", borderRadius: 8, background: "#000" }}
        />
      </Box>

      {/* TRANSCRIPT */}
      <Box
        sx={{
          border: 1,
          borderColor: "divider",
          borderRadius: 2,
          p: 2,
          height: 450,
          overflowY: "auto",
          bgcolor: "background.paper", // Adapts to theme
        }}
      >
        <Typography fontWeight={600} mb={1}>
          Synced Transcript
        </Typography>

        {lines.map((line, i) => {
          const active = currentTime >= line.start && currentTime <= line.end;

          return (
            <Box
              key={i}
              onClick={() => {
                if (videoRef.current) {
                  videoRef.current.currentTime = line.start / 1000;
                }
              }}
              sx={{
                p: 1,
                borderRadius: 1,
                cursor: "pointer",
                transition: "background-color 0.2s",
                // Active state: Blue tint in light, darker blue in dark mode
                // Inactive state: Transparent
                bgcolor: active
                  ? alpha(theme.palette.primary.main, 0.2)
                  : "transparent",
                "&:hover": {
                  // Hover state: Light gray in light, dark gray in dark mode
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.3)
                    : theme.palette.action.hover,
                },
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {(line.start / 1000).toFixed(1)}s
              </Typography>
              <Typography color="text.primary">{line.text}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
