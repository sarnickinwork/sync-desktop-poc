import { Card, CardContent, Typography, Box, Button } from "@mui/material";
import { open } from "@tauri-apps/plugin-dialog";
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import AddIcon from '@mui/icons-material/Add';
import { VideoItem } from "../../utils/types";
import SortableVideoList from "./SortableVideoList";

type Props = {
  videos: VideoItem[];
  setVideos: (v: VideoItem[]) => void;
};

export default function VideoUploadCard({ videos, setVideos }: Props) {
  const pickVideo = async () => {
    const selected = await open({
      multiple: true,
      filters: [{ name: "Video", extensions: ["mp4", "mkv", "avi", "mov"] }],
    });

    if (!selected) return;

    const paths = Array.isArray(selected) ? selected : [selected];

    const newVideos: VideoItem[] = paths.map(path => ({
      id: crypto.randomUUID(), // specific to dnd-kit
      path: path,
      name: path.split("\\").pop() || path.split("/").pop() || path,
    }));

    setVideos([...videos, ...newVideos]);
  };

  const handleReorder = (newVideos: VideoItem[]) => {
    setVideos(newVideos);
  };

  const handleRemove = (id: string) => {
    setVideos(videos.filter(v => v.id !== id));
  };

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: videos.length > 0 ? 2 : 0,
        borderColor: videos.length > 0 ? 'primary.main' : 'divider'
      }}
    >
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Box>
            <Typography fontWeight={700} variant="h6" color="primary">Video Sequence</Typography>
            <Typography variant="caption" color="text.secondary">
              Drag items to match the order in the transcript.
            </Typography>
          </Box>
          {videos.length > 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={pickVideo}
              size="small"
              sx={{ textTransform: 'none', borderRadius: 2 }}
            >
              Add More
            </Button>
          )}
        </Box>

        {videos.length === 0 ? (
          <Box
            onClick={pickVideo}
            sx={{
              border: "2px dashed",
              borderColor: "primary.main",
              borderRadius: 3,
              p: 4,
              mt: 2,
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: "pointer",
              background: "linear-gradient(180deg, rgba(25, 118, 210, 0.04) 0%, rgba(25, 118, 210, 0.01) 100%)",
              transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              '&:hover': {
                background: "rgba(25, 118, 210, 0.08)",
                transform: "translateY(-2px)",
                boxShadow: "0 4px 12px rgba(0,0,0,0.05)"
              }
            }}
          >
            <Box
              sx={{
                p: 2,
                borderRadius: '50%',
                bgcolor: 'primary.light',
                color: 'white',
                mb: 2,
                display: 'flex'
              }}
            >
              <CloudUploadIcon sx={{ fontSize: 32 }} />
            </Box>
            <Typography variant="h6" color="text.primary" fontWeight={600} gutterBottom>
              Upload Videos
            </Typography>
            <Typography variant="body2" color="text.secondary" align="center" sx={{ maxWidth: 250 }}>
              Select one or multiple video files (MP4, MKV, AVI, MOV) for this session.
            </Typography>
          </Box>
        ) : (
          <Box flex={1} overflow="auto" mt={2} sx={{
            p: 1,
            bgcolor: 'background.default',
            borderRadius: 2,
            border: '1px solid',
            borderColor: 'divider'
          }}>
            <SortableVideoList
              items={videos}
              onReorder={handleReorder}
              onRemove={handleRemove}
            />
          </Box>
        )}
      </CardContent>
    </Card>
  );
}
