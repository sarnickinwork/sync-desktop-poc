import { useState, useRef, useEffect } from "react";
import { Box, Typography, List, ListItem, ListItemText, ListItemButton, Paper } from "@mui/material";
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import { VideoItem } from "../../utils/types";
import { convertFileSrc } from "@tauri-apps/api/core";

export default function VideoPreview({ videos }: { videos: VideoItem[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  const currentVideo = videos[currentIndex];

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.load();
    }
  }, [currentIndex, videos]);

  const handleEnded = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  return (
    <Box>
      <Typography fontWeight={600} mb={1}>
        Video Preview ({currentIndex + 1} / {videos.length})
      </Typography>

      <Box sx={{ bgcolor: 'black', borderRadius: 2, overflow: 'hidden', mb: 2 }}>
        {currentVideo ? (
          <video
            ref={videoRef}
            src={convertFileSrc(currentVideo.path)}
            controls
            autoPlay={currentIndex > 0} // Auto-play subsequent videos
            onEnded={handleEnded}
            style={{
              width: "100%",
              maxHeight: 400,
              display: 'block'
            }}
          />
        ) : (
          <Box height={300} display="flex" alignItems="center" justifyContent="center">
            <Typography color="white">No video selected</Typography>
          </Box>
        )}
      </Box>

      <Paper variant="outlined" sx={{ maxHeight: 200, overflow: 'auto' }}>
        <List dense disablePadding>
          {videos.map((video, index) => (
            <ListItem key={video.id} disablePadding>
              <ListItemButton
                selected={index === currentIndex}
                onClick={() => setCurrentIndex(index)}
              >
                <PlayCircleOutlineIcon sx={{ mr: 2, fontSize: 20, color: index === currentIndex ? 'primary.main' : 'text.disabled' }} />
                <ListItemText
                  primary={video.name}
                  secondary={index === currentIndex ? "Playing..." : `${index + 1}. In Sequence`}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Paper>
    </Box>
  );
}
