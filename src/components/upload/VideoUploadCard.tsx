import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { DndContext, closestCenter } from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  arrayMove,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Card, CardContent, Typography, Box, Paper } from "@mui/material";

type VideoItem = {
  id: string;
  file: File;
};

type Props = {
  videos: VideoItem[];
  setVideos: React.Dispatch<React.SetStateAction<VideoItem[]>>;
};

export default function VideoUploadCard({ videos, setVideos }: Props) {
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const mapped = acceptedFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
    }));

    setVideos((prev) => [...prev, ...mapped]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "video/*": [] },
  });

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setVideos((items) => {
      const oldIndex = items.findIndex((i) => i.id === active.id);
      const newIndex = items.findIndex((i) => i.id === over.id);
      return arrayMove(items, oldIndex, newIndex);
    });
  };

  return (
    <Card variant="outlined">
      <CardContent>
        <Typography fontWeight={600}>Videos</Typography>

        <Box
          {...getRootProps()}
          sx={{
            border: "2px dashed #4caf50",
            borderRadius: 2,
            p: 3,
            mt: 2,
            textAlign: "center",
            cursor: "pointer",
            background: isDragActive ? "#f1f8e9" : "transparent",
          }}
        >
          <input {...getInputProps()} />
          <Typography>Drag & drop videos here</Typography>
          <Typography variant="caption">or click to browse</Typography>
        </Box>

        {/* Uploaded list */}
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={videos.map((v) => v.id)}
            strategy={verticalListSortingStrategy}
          >
            <Box mt={2} display="flex" flexDirection="column" gap={1}>
              {videos.map((v) => (
                <SortableItem key={v.id} id={v.id} name={v.file.name} />
              ))}
            </Box>
          </SortableContext>
        </DndContext>
      </CardContent>
    </Card>
  );
}

function SortableItem({ id, name }: { id: string; name: string }) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <Paper
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      sx={{
        p: 1.2,
        borderRadius: 2,
        cursor: "grab",
        background: "#fafafa",
      }}
    >
      {name}
    </Paper>
  );
}
