import { useState, useRef, useEffect, memo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
  Switch,
  FormControlLabel,
  Chip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import { convertFileSrc } from "@tauri-apps/api/core";
import CircleIcon from "@mui/icons-material/Circle";
import { SmiSubtitle } from "../../utils/smiParsingUtils";
import { formatMs } from "../../utils";

type Props = {
  videoPath: string;
  subtitles: SmiSubtitle[];
  onUpdateSubtitles?: (updated: SmiSubtitle[]) => void;
};

// --- 1. MEMOIZED ROW COMPONENT (Optimized for Performance) ---
const SubtitleRow = memo(
  ({
    sub,
    index,
    isActive,
    isSelected,
    onRowClick,
  }: {
    sub: SmiSubtitle;
    index: number;
    isActive: boolean;
    isSelected: boolean;
    onRowClick: (index: number, start: number) => void;
  }) => {
    const theme = useTheme();
    const rowRef = useRef<HTMLTableRowElement>(null);

    // Auto-scroll to active/selected line
    useEffect(() => {
      if ((isActive || isSelected) && rowRef.current) {
        rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, [isActive, isSelected]);

    const getConfidenceColor = (conf?: number) => {
      // High confidence (80-100) = Green
      if (conf !== undefined && conf >= 80) return "success.main";
      // Medium confidence (50-79) = Orange
      if (conf !== undefined && conf >= 50) return "warning.main";
      // Low/Undefined = Red
      return "error.main";
    };

    const formatConfidence = (conf?: number) => {
      if (typeof conf === "undefined") return "0%";
      return `${Math.round(conf)}%`;
    };

    return (
      <TableRow
        ref={rowRef}
        selected={isSelected || isActive}
        onClick={() => onRowClick(index, sub.start)}
        sx={{
          cursor: "pointer",
          transition: "background-color 0.1s",
          ...(isSelected && {
            bgcolor: alpha(theme.palette.error.main, 0.15) + " !important",
            borderLeft: `4px solid ${theme.palette.error.main}`,
          }),
          ...(isActive &&
            !isSelected && {
              bgcolor: alpha(theme.palette.primary.main, 0.1) + " !important",
              borderLeft: `4px solid ${theme.palette.primary.main}`,
            }),
        }}
      >
        <TableCell>
          <Box display="flex" alignItems="center" gap={0.5}>
            <CircleIcon
              sx={{ fontSize: 10, color: getConfidenceColor(sub.confidence) }}
            />
            <Typography
              variant="caption"
              sx={{ fontFamily: "monospace", fontSize: "0.75rem" }}
            >
              {formatConfidence(sub.confidence)}
            </Typography>
          </Box>
        </TableCell>
        <TableCell sx={{ fontFamily: "monospace" }}>
          {formatMs(sub.start)}
        </TableCell>
        <TableCell>{sub.text}</TableCell>
      </TableRow>
    );
  },
  (prev, next) => {
    return (
      prev.isActive === next.isActive &&
      prev.isSelected === next.isSelected &&
      prev.sub === next.sub &&
      prev.index === next.index
    );
  },
);

// --- 2. MAIN COMPONENT ---
export default function EditorView({
  videoPath,
  subtitles,
  onUpdateSubtitles,
}: Props) {
  const videoSrc = convertFileSrc(videoPath);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Only track the active index (integer) to prevent lag
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isEditMode, setIsEditMode] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  // --- OPTIMIZED SYNC LOOP ---
  useEffect(() => {
    let animationFrameId: number;

    const checkTime = () => {
      if (videoRef.current && !videoRef.current.paused) {
        const timeMs = videoRef.current.currentTime * 1000;

        // Efficiently find active line
        const newIndex = subtitles.findIndex((sub, idx) => {
          const nextSub = subtitles[idx + 1];
          return timeMs >= sub.start && (!nextSub || timeMs < nextSub.start);
        });

        setActiveIndex((prev) => (prev !== newIndex ? newIndex : prev));
      }
      animationFrameId = requestAnimationFrame(checkTime);
    };

    animationFrameId = requestAnimationFrame(checkTime);
    return () => cancelAnimationFrame(animationFrameId);
  }, [subtitles]);

  // --- SPACEBAR SYNC HANDLER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditMode || selectedIndex === null || !onUpdateSubtitles) return;

      if (e.code === "Space") {
        e.preventDefault();

        if (!videoRef.current) return;

        // 1. Capture the exact video time
        const syncedTime = videoRef.current.currentTime * 1000;

        // 2. Update the subtitle
        const updated = [...subtitles];
        updated[selectedIndex] = {
          ...updated[selectedIndex],
          start: syncedTime,
          // 3. Set High Confidence (100) specifically because we just synced it to this time
          confidence: 100,
        };

        onUpdateSubtitles(updated);

        // 4. Auto-advance to next line for speed
        if (selectedIndex < subtitles.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isEditMode, selectedIndex, subtitles, onUpdateSubtitles]);

  const handleRowClick = useCallback(
    (index: number, start: number) => {
      if (isEditMode) {
        setSelectedIndex(index);
      } else {
        // View Mode: Click to Seek
        if (videoRef.current) {
          videoRef.current.currentTime = start / 1000;
          videoRef.current.play();
          setActiveIndex(index);
        }
      }
    },
    [isEditMode],
  );

  return (
    <Box
      display="grid"
      gridTemplateColumns="1fr 1fr"
      gap={3}
      height="70vh"
      mt={2}
    >
      {/* LEFT: Video Player */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          display: "flex",
          flexDirection: "column",
          bgcolor: "black",
          position: "relative",
        }}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          controlsList="nodownload"
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        <Box position="absolute" top={16} left={16} zIndex={10}>
          <Chip
            label={isEditMode ? "EDIT MODE" : "VIEW MODE"}
            color={isEditMode ? "error" : "default"}
            size="small"
            sx={{ fontWeight: "bold" }}
          />
        </Box>

        {isEditMode && (
          <Box
            position="absolute"
            bottom={16}
            left={0}
            right={0}
            display="flex"
            justifyContent="center"
          >
            <Chip
              label="Press SPACE to Sync Time & Set Confidence"
              size="small"
              sx={{ bgcolor: "rgba(0,0,0,0.6)", color: "white" }}
            />
          </Box>
        )}
      </Paper>

      {/* RIGHT: Subtitle List */}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          p={2}
          borderBottom={1}
          borderColor="divider"
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Typography variant="h6">Subtitle Editor</Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitles.length} lines •{" "}
              {isEditMode
                ? "Spacebar syncs time to video"
                : "Click row to seek"}
            </Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={isEditMode}
                onChange={(e) => {
                  setIsEditMode(e.target.checked);
                  if (e.target.checked && activeIndex !== -1) {
                    setSelectedIndex(activeIndex);
                  } else {
                    setSelectedIndex(null);
                  }
                }}
              />
            }
            label="Edit Mode"
          />
        </Box>

        <TableContainer sx={{ flexGrow: 1 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 80 }}>Conf</TableCell>
                <TableCell style={{ width: 100 }}>Start</TableCell>
                <TableCell>Text</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subtitles.map((sub, index) => (
                <SubtitleRow
                  key={index}
                  sub={sub}
                  index={index}
                  isActive={!isEditMode && index === activeIndex}
                  isSelected={isEditMode && selectedIndex === index}
                  onRowClick={handleRowClick}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
