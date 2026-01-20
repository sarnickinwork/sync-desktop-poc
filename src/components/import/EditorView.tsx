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
  Chip,
  IconButton,
  Tooltip
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

import { SmiSubtitle } from "../../utils/smiParsingUtils";
import { formatMs } from "../../utils";
import { VideoItem } from "../../utils/types";
import SyncedPlayer, { SyncedPlayerRef } from "../sync/SyncedPlayer";

type Props = {
  videos: VideoItem[];
  splitPoints: number[];
  subtitles: SmiSubtitle[];
  onUpdateSubtitles?: (updated: SmiSubtitle[]) => void;
};

// --- 1. MEMOIZED ROW COMPONENT ---
const SubtitleRow = memo(
  ({
    sub,
    index,
    isActive,
    isSelected,
    isEdited,
    onRowClick,
  }: {
    sub: SmiSubtitle;
    index: number;
    isActive: boolean;
    isSelected: boolean;
    isEdited: boolean;
    onRowClick: (index: number) => void;
  }) => {
    const theme = useTheme();
    const rowRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
      // Improved scrolling logic: only scroll if far out of view? 
      // Or stick to center. Center is good for focus mode.
      if ((isActive || isSelected) && rowRef.current) {
        rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, [isActive, isSelected]);

    return (
      <TableRow
        ref={rowRef}
        selected={isSelected}
        onClick={() => onRowClick(index)} // Single click selects
        sx={{
          cursor: "pointer",
          // Hover effect
          "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.1) },
          // Selected State (Edit Focus)
          ...(isSelected && {
            bgcolor: alpha(theme.palette.primary.main, 0.15) + " !important",
            borderLeft: `4px solid ${theme.palette.primary.main}`,
          }),
          // Active Playing State (if not selected)
          ...(!isSelected && isActive && {
            bgcolor: alpha(theme.palette.action.selected, 0.08),
            borderLeft: `4px solid ${theme.palette.divider}`,
          }),
        }}
      >
        <TableCell padding="none" sx={{ width: 40, textAlign: 'center' }}>
          {isEdited && <EditIcon sx={{ fontSize: 14, color: 'warning.main' }} />}
          {sub.confidence === 100 && !isEdited && <CheckCircleIcon sx={{ fontSize: 14, color: 'success.main', opacity: 0.5 }} />}
        </TableCell>
        <TableCell sx={{ fontFamily: "monospace", width: 100, fontSize: '0.85rem', color: isEdited ? 'warning.main' : 'inherit' }}>
          {formatMs(sub.start)}
        </TableCell>
        <TableCell sx={{ fontSize: '0.95rem' }}>{sub.text}</TableCell>
      </TableRow>
    );
  },
  (prev, next) => {
    return (
      prev.isActive === next.isActive &&
      prev.isSelected === next.isSelected &&
      prev.sub === next.sub &&
      prev.index === next.index &&
      prev.isEdited === next.isEdited
    );
  }
);

// --- 2. MAIN COMPONENT ---
export default function EditorView({
  videos,
  splitPoints,
  subtitles,
  onUpdateSubtitles,
}: Props) {
  const theme = useTheme();
  const playerRef = useRef<SyncedPlayerRef>(null);

  // State
  const [activeIndex, setActiveIndex] = useState<number>(-1); // Index currently playing
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null); // Index selected for editing
  const [globalTime, setGlobalTime] = useState(0);
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());

  // Handling Stop-at-End logic
  // If we are "Focus Playing" a specific line, we check if globalTime > line.end
  const [focusPlayingIndex, setFocusPlayingIndex] = useState<number | null>(null);

  // --- TIME UPDATE HANDLER ---
  const handleTimeUpdate = useCallback((time: number) => {
    setGlobalTime(time);

    // Calculate active index solely for display (highlighting currently heard line)
    const newIndex = subtitles.findIndex((sub, idx) => {
      const nextSub = subtitles[idx + 1];
      return time >= sub.start && (!nextSub || time < nextSub.start);
    });
    setActiveIndex((prev) => (prev !== newIndex ? newIndex : prev));

    // FOCUS MODE LOGIC: Stop if we pass the next line's start
    if (focusPlayingIndex !== null) {
      const nextLineStart = subtitles[focusPlayingIndex + 1]?.start;
      // Logic: If there is a next line, stop at its start. 
      // If no next line, stop at current + 3s? Or just let it play.
      if (nextLineStart && time >= nextLineStart) {
        playerRef.current?.pause();
        setFocusPlayingIndex(null); // Reset focus play state
        // Optional: Seek exactly to the end boundary to be precise?
        // playerRef.current?.seek(nextLineStart);
      }
    }

  }, [subtitles, focusPlayingIndex]);

  // --- SHORTCUTS HANDLER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Must have a selection to edit
      if (selectedIndex === null || !onUpdateSubtitles) return;

      // ENTER: Sync Start Time
      if (e.code === "Enter") {
        e.preventDefault();

        const syncedTime = Math.round(globalTime); // Round to ms

        const updated = [...subtitles];
        updated[selectedIndex] = {
          ...updated[selectedIndex],
          start: syncedTime,
          confidence: 100 // Mark as confirmed
        };

        // Mark as edited
        const newEdited = new Set(editedIndices);
        newEdited.add(selectedIndex);
        setEditedIndices(newEdited);

        onUpdateSubtitles(updated);

        // Visual feedback?
      }

      // SPACE: Toggle Play/Pause for the selected segment
      if (e.code === "Space") {
        e.preventDefault();
        // If we are currently playing (focus or otherwise), pause.
        // But checking `focusPlayingIndex` is tricky because manual play might not set it.
        // Let's assume SPACE in Edit View ALWAYS acts on the selected line context.

        if (focusPlayingIndex !== null) {
          // We are in a focus play loop -> Pause
          playerRef.current?.pause();
          setFocusPlayingIndex(null);
        } else {
          // We are likely paused or manual playing.
          // If selection exists, SEEK to Start and PLAY with Focus.
          const start = subtitles[selectedIndex].start;
          // Seek and set focus.
          playerRef.current?.seek(start);
          setFocusPlayingIndex(selectedIndex);
        }
      }

      // ARROWS: Navigate
      if (e.code === "ArrowDown") {
        e.preventDefault();
        if (selectedIndex < subtitles.length - 1) {
          const newIdx = selectedIndex + 1;
          setSelectedIndex(newIdx);
          // Auto-seek to context
          playerRef.current?.seek(subtitles[newIdx].start);
          playerRef.current?.pause();
        }
      }

      if (e.code === "ArrowUp") {
        e.preventDefault();
        if (selectedIndex > 0) {
          const newIdx = selectedIndex - 1;
          setSelectedIndex(newIdx);
          playerRef.current?.seek(subtitles[newIdx].start);
          playerRef.current?.pause();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIndex, subtitles, onUpdateSubtitles, globalTime, editedIndices, focusPlayingIndex]);

  const handleRowClick = useCallback(
    (index: number) => {
      setSelectedIndex(index);
      // Auto-seek to line start and PAUSE (Waiting for user action)
      const start = subtitles[index].start;
      playerRef.current?.seek(start);
      playerRef.current?.pause();
    },
    [subtitles]
  );

  return (
    <Box
      display="grid"
      gridTemplateColumns="1fr 1fr"
      gap={3}
      height="75vh"
      mt={2}
    >
      {/* LEFT: Video Player */}
      <Paper
        elevation={3}
        sx={{
          p: 0,
          display: "flex",
          flexDirection: "column",
          bgcolor: "black",
          position: "relative",
          borderRadius: 2,
          overflow: 'hidden'
        }}
      >
        <Box sx={{ width: "100%", height: "100%", overflow: 'hidden' }}>
          <SyncedPlayer
            ref={playerRef}
            videos={videos}
            splitPoints={splitPoints}
            lines={[]}
            hideTranscript={true}
            onGlobalTimeUpdate={handleTimeUpdate}
          />
        </Box>

        {/* Overlay Info */}
        <Box
          position="absolute"
          bottom={20}
          left={0}
          right={0}
          display="flex"
          justifyContent="center"
          sx={{ pointerEvents: "none" }}
        >
          <Chip
            icon={selectedIndex !== null ? <EditIcon /> : undefined}
            label={
              selectedIndex !== null
                ? "EDIT MODE: Press SPACE to Review Line • ENTER to Set Start Time"
                : "Select a line to start editing"
            }
            color={selectedIndex !== null ? "primary" : "default"}
            sx={{
              bgcolor: "rgba(0,0,0,0.7)",
              color: "white",
              backdropFilter: "blur(4px)",
              fontWeight: 600,
              fontSize: '0.85rem',
              boxShadow: 3
            }}
          />
        </Box>
      </Paper>

      {/* RIGHT: Subtitle List */}
      <Paper
        variant="outlined"
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper'
        }}
      >
        <Box
          p={2}
          borderBottom={1}
          borderColor="divider"
          bgcolor={alpha(theme.palette.primary.main, 0.04)}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box>
            <Typography variant="subtitle1" fontWeight={700} color="text.primary">
              Transcript Editor
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {subtitles.length} segments • {editedIndices.size} edited
            </Typography>
          </Box>
          <Box>
            <Tooltip title="Edited lines are marked orange">
              <IconButton size="small" disabled>
                <EditIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        <TableContainer sx={{ flexGrow: 1, scrollBehavior: 'smooth' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 40, background: theme.palette.background.paper }}></TableCell>
                <TableCell style={{ width: 100, background: theme.palette.background.paper, fontWeight: 600 }}>Start</TableCell>
                <TableCell style={{ background: theme.palette.background.paper, fontWeight: 600 }}>Text</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {subtitles.map((sub, index) => (
                <SubtitleRow
                  key={index}
                  sub={sub}
                  index={index}
                  isActive={index === activeIndex} // Highlight what's playing
                  isSelected={index === selectedIndex} // Highlight what's selected for edit
                  isEdited={editedIndices.has(index)}
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
