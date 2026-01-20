import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from "react";
import { Box, Typography, useTheme, alpha } from "@mui/material";
import { convertFileSrc } from "@tauri-apps/api/core";
import { VideoItem } from "../../utils/types";

type Line = {
  text: string;
  start: number;
  end: number;
};

type Props = {
  videos: VideoItem[];
  splitPoints: number[]; // Global time (ms) where each video ends
  lines: Line[];
  hideTranscript?: boolean;
  onGlobalTimeUpdate?: (time: number) => void;
  seekToTime?: number | null; // Keep for backward compat or declarative seek
};

export type SyncedPlayerRef = {
  pause: () => void;
  play: () => void;
  seek: (time: number) => void;
};

const SyncedPlayer = forwardRef<SyncedPlayerRef, Props>(({ videos, splitPoints, lines, hideTranscript, onGlobalTimeUpdate, seekToTime }, ref) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [globalTime, setGlobalTime] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);

  const theme = useTheme();

  useImperativeHandle(ref, () => ({
    pause: () => {
      setIsPlaying(false);
      videoRef.current?.pause();
    },
    play: () => {
      setIsPlaying(true);
      videoRef.current?.play();
    },
    seek: (time: number) => {
      handleLineClick(time);
    }
  }));

  // Handle external seek prop
  useEffect(() => {
    if (seekToTime !== null && seekToTime !== undefined) {
      handleLineClick(seekToTime);
    }
  }, [seekToTime]);

  // Determine current video based on global time
  useEffect(() => {
    const index = splitPoints.findIndex(point => globalTime < point);
    const targetIndex = index === -1 ? splitPoints.length - 1 : index;

    if (targetIndex !== currentVideoIndex) {
      setCurrentVideoIndex(targetIndex);
    }
  }, [globalTime, splitPoints]);

  const currentVideo = videos[currentVideoIndex];
  // Start time of current video in global timeline
  const currentVideoStartOffset = currentVideoIndex === 0 ? 0 : splitPoints[currentVideoIndex - 1];

  // Sync video element to global time
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const localTime = (globalTime - currentVideoStartOffset) / 1000;

    // Only seek if significantly diff (to allow normal playback)
    // Relaxed threshold to 0.5s to prevent micro-stuttering during regular playback
    if (Math.abs(video.currentTime - localTime) > 0.5) {
      video.currentTime = localTime;
    }

    // Ensure play state matches
    if (isPlaying && video.paused) {
      video.play().catch(() => { });
    } else if (!isPlaying && !video.paused) {
      video.pause();
    }

  }, [currentVideoIndex, isPlaying]);

  // Handle video time updates
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const localTimeMs = video.currentTime * 1000;
    const newGlobal = currentVideoStartOffset + localTimeMs;
    setGlobalTime(newGlobal);
    if (onGlobalTimeUpdate) onGlobalTimeUpdate(newGlobal);

    // Check if we reached end of this video
    if (currentVideoIndex < videos.length - 1 && newGlobal >= splitPoints[currentVideoIndex]) {
      // Move to next video
      setCurrentVideoIndex(prev => prev + 1);
      // setGlobalTime is already updated, which triggers video switch effect
    }
  };

  const handleLineClick = (start: number) => {
    setGlobalTime(start);
    if (onGlobalTimeUpdate) onGlobalTimeUpdate(start);
    setIsPlaying(true);

    const index = splitPoints.findIndex(point => start < point);
    const targetIndex = index === -1 ? splitPoints.length - 1 : index;

    // Calculate local time
    const offset = targetIndex === 0 ? 0 : splitPoints[targetIndex - 1];
    const localTime = (start - offset) / 1000;

    setCurrentVideoIndex(targetIndex);

    // Force update immediately for responsiveness
    setTimeout(() => {
      if (videoRef.current) {
        // Force set time
        videoRef.current.currentTime = localTime;
        videoRef.current.play().catch(() => { });
      }
    }, 50);
  };

  return (
    <Box display="grid" gridTemplateColumns={hideTranscript ? "1fr" : "1fr 1fr"} gap={3} sx={{ height: '100%' }}>
      {/* VIDEO */}
      <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {!hideTranscript && (
          <>
            <Typography fontWeight={600}>
              Video ({currentVideoIndex + 1}/{videos.length})
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap display="block" mb={1}>
              {currentVideo?.name}
            </Typography>
          </>
        )}

        {currentVideo && (
          <Box sx={{ flex: 1, bgcolor: 'black', borderRadius: 2, overflow: 'hidden', position: 'relative' }}>
            <video
              key={currentVideo.id} // Re-mount on video change
              ref={videoRef}
              src={convertFileSrc(currentVideo.path)}
              controls
              preload="auto"
              style={{ width: "100%", height: "100%", objectFit: "contain" }}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setIsPlaying(true)}
              onPause={() => setIsPlaying(false)}
              onEnded={() => {
                if (currentVideoIndex < videos.length - 1) {
                  setCurrentVideoIndex(prev => prev + 1);
                  setGlobalTime(splitPoints[currentVideoIndex]); // Start of next
                } else {
                  setIsPlaying(false);
                }
              }}
            />
          </Box>
        )}
      </Box>

      {/* TRANSCRIPT */}
      {!hideTranscript && (
        <Box
          sx={{
            border: 1,
            borderColor: "divider",
            borderRadius: 2,
            p: 2,
            height: 450,
            overflowY: "auto",
            bgcolor: "background.paper",
          }}
        >
          <Typography fontWeight={600} mb={1}>
            Synced Transcript
          </Typography>

          {lines.map((line, i) => {
            const active = globalTime >= line.start && globalTime <= line.end;

            return (
              <Box
                key={i}
                onClick={() => handleLineClick(line.start)}
                sx={{
                  p: 1,
                  borderRadius: 1,
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  bgcolor: active
                    ? alpha(theme.palette.primary.main, 0.2)
                    : "transparent",
                  "&:hover": {
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
      )}
    </Box>
  );
});

export default SyncedPlayer;
