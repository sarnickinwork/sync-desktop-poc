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
  Tooltip,
  Switch,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import VisibilityIcon from "@mui/icons-material/Visibility";

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
    editMode,
  }: {
    sub: SmiSubtitle;
    index: number;
    isActive: boolean;
    isSelected: boolean;
    isEdited: boolean;
    onRowClick: (index: number) => void;
    editMode: boolean;
  }) => {
    const theme = useTheme();
    const rowRef = useRef<HTMLTableRowElement>(null);

    useEffect(() => {
      // Edit Mode: Only scroll to selected line (for editing focus)
      // View Mode: Scroll to active line (following playback)
      if (rowRef.current) {
        if (editMode && isSelected) {
          // In edit mode, scroll only when line is selected
          rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (!editMode && isActive) {
          // In view mode, scroll follows the playing line
          rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, [isActive, isSelected, editMode]);

    return (
      <TableRow
        ref={rowRef}
        selected={isSelected && editMode}
        onClick={() => onRowClick(index)} // Clickable in both modes
        sx={{
          cursor: "pointer", // Always show pointer cursor
          // Hover effect
          "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.1) },
          // Selected State (Edit Focus)
          ...(isSelected && editMode && {
            bgcolor: alpha(theme.palette.primary.main, 0.15) + " !important",
            borderLeft: `4px solid ${theme.palette.primary.main}`,
          }),
          // Active Playing State (if not selected or not in edit mode)
          ...((!isSelected || !editMode) && isActive && {
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
        <TableCell sx={{ width: 80, textAlign: 'center' }}>
          {sub.confidence !== undefined && (
            <Chip
              label={`${Math.round(sub.confidence)}%`}
              size="small"
              sx={{
                bgcolor:
                  sub.confidence >= 85 ? 'success.main' :
                    sub.confidence >= 70 ? 'warning.main' :
                      'error.main',
                color: 'white',
                fontWeight: 600,
                fontSize: '0.75rem',
                height: 20,
                minWidth: 50
              }}
            />
          )}
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
      prev.isEdited === next.isEdited &&
      prev.editMode === next.editMode
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
  const [editMode, setEditMode] = useState(false); // View/Edit mode toggle
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'edited'>('all'); // Confidence filter
  const [activeIndex, setActiveIndex] = useState<number>(-1); // Index currently playing
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null); // Index selected for editing
  const [globalTime, setGlobalTime] = useState(0);
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());

  // Filter subtitles by confidence
  const filteredSubtitles = subtitles.filter((sub, idx) => {
    if (confidenceFilter === 'all') return true;
    if (confidenceFilter === 'edited') return editedIndices.has(idx);
    if (confidenceFilter === 'high') return (sub.confidence || 0) >= 85;
    if (confidenceFilter === 'medium') return (sub.confidence || 0) >= 70 && (sub.confidence || 0) < 85;
    if (confidenceFilter === 'low') return (sub.confidence || 0) < 70;
    return true;
  });

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
      // Must be in edit mode and have a selection to edit
      if (!editMode || selectedIndex === null || !onUpdateSubtitles) return;

      // SPACE: Record current timestamp to selected line
      if (e.code === "Space") {
        e.preventDefault();

        const syncedTime = Math.round(globalTime); // Round to ms

        const updated = [...subtitles];
        updated[selectedIndex] = {
          ...updated[selectedIndex],
          start: syncedTime,
          confidence: 100 // Mark as manually confirmed
        };

        // Mark as edited
        const newEdited = new Set(editedIndices);
        newEdited.add(selectedIndex);
        setEditedIndices(newEdited);

        onUpdateSubtitles(updated);

        // Pause the video after recording timestamp
        playerRef.current?.pause();

        // Visual feedback
        console.log(`✓ Line ${selectedIndex + 1} timestamp updated to ${syncedTime}ms`);
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
  }, [editMode, selectedIndex, subtitles, onUpdateSubtitles, globalTime, editedIndices, focusPlayingIndex]);

  const handleRowClick = useCallback(
    (index: number) => {
      if (editMode) {
        // Edit Mode: Select line for editing, pause at start
        setSelectedIndex(index);
        const start = subtitles[index].start;
        playerRef.current?.seek(start);
        playerRef.current?.pause();
      } else {
        // View Mode: Navigate to that timestamp and play
        const start = subtitles[index].start;
        playerRef.current?.seek(start);
        // Auto-play in view mode for easy navigation
      }
    },
    [subtitles, editMode]
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

        {/* Overlay Info - Moved to top-right */}
        {editMode && selectedIndex !== null && (
          <Box
            position="absolute"
            top={12}
            right={12}
            sx={{ pointerEvents: "none" }}
          >
            <Chip
              icon={<EditIcon />}
              label="Press SPACE to set timestamp"
              color="primary"
              size="small"
              sx={{
                bgcolor: "rgba(0,0,0,0.75)",
                color: "white",
                backdropFilter: "blur(6px)",
                fontWeight: 600,
                fontSize: '0.75rem',
                boxShadow: 2,
                px: 0.5
              }}
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
              {filteredSubtitles.length} of {subtitles.length} segments • {editedIndices.size} edited
            </Typography>
          </Box>
          <Box display="flex" alignItems="center" gap={2}>
            {/* Confidence Filter */}
            <ToggleButtonGroup
              value={confidenceFilter}
              exclusive
              onChange={(e, newFilter) => {
                if (newFilter !== null) {
                  setConfidenceFilter(newFilter);
                }
              }}
              size="small"
            >
              <ToggleButton value="all" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem' }}>
                All
              </ToggleButton>
              <ToggleButton value="edited" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', color: 'warning.main' }}>
                Edited
              </ToggleButton>
              <ToggleButton value="high" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', color: 'success.main' }}>
                High
              </ToggleButton>
              <ToggleButton value="medium" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', color: 'warning.main' }}>
                Medium
              </ToggleButton>
              <ToggleButton value="low" sx={{ px: 1.5, py: 0.5, fontSize: '0.75rem', color: 'error.main' }}>
                Low
              </ToggleButton>
            </ToggleButtonGroup>

            {/* View/Edit Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={editMode}
                  onChange={(e) => {
                    setEditMode(e.target.checked);
                    if (!e.target.checked) {
                      setSelectedIndex(null);
                    }
                  }}
                  color="primary"
                />
              }
              label={
                <Box display="flex" alignItems="center" gap={1}>
                  {editMode ? <EditIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                  <Typography variant="caption" fontWeight={600}>
                    {editMode ? "Edit" : "View"}
                  </Typography>
                </Box>
              }
            />
          </Box>
        </Box>

        <TableContainer sx={{ flexGrow: 1, scrollBehavior: 'smooth' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell style={{ width: 40, background: theme.palette.background.paper }}></TableCell>
                <TableCell style={{ width: 100, background: theme.palette.background.paper, fontWeight: 600 }}>Start</TableCell>
                <TableCell style={{ width: 80, background: theme.palette.background.paper, fontWeight: 600, textAlign: 'center' }}>Confidence</TableCell>
                <TableCell style={{ background: theme.palette.background.paper, fontWeight: 600 }}>Text</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredSubtitles.map((sub, index) => {
                // Get original index from the full subtitles array
                const originalIndex = subtitles.indexOf(sub);
                return (
                  <SubtitleRow
                    key={originalIndex}
                    sub={sub}
                    index={originalIndex}
                    isActive={originalIndex === activeIndex} // Highlight what's playing
                    isSelected={originalIndex === selectedIndex} // Highlight what's selected for edit
                    isEdited={editedIndices.has(originalIndex)}
                    onRowClick={handleRowClick}
                    editMode={editMode}
                  />
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}
