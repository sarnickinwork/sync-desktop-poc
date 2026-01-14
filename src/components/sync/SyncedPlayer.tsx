import { useEffect, useRef, useState } from "react";
import { Box, Typography } from "@mui/material";

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
          key={videoUrl} // 👈 IMPORTANT
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
          border: "1px solid #ddd",
          borderRadius: 2,
          p: 2,
          height: 450,
          overflowY: "auto",
          background: "#fafafa",
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
                background: active ? "#e3f2fd" : "transparent",
                "&:hover": { background: "#f0f0f0" },
              }}
            >
              <Typography variant="caption" color="text.secondary">
                {(line.start / 1000).toFixed(1)}s
              </Typography>
              <Typography>{line.text}</Typography>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
