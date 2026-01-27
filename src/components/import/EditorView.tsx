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
  Switch,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import EditIcon from "@mui/icons-material/Edit";

import { SmiSubtitle } from "../../utils/smiParsingUtils";
import { VideoItem } from "../../utils/types";
import SyncedPlayer, { SyncedPlayerRef } from "../sync/SyncedPlayer";

type Props = {
  videos: VideoItem[];
  splitPoints: number[];
  subtitles: SmiSubtitle[];
  onUpdateSubtitles?: (updated: SmiSubtitle[]) => void;
  startLine?: number;
};

// --- HELPER: HH:MM:SS.mmm ---
const formatTimestampFull = (ms: number) => {
  const date = new Date(ms);
  const h = date.getUTCHours().toString().padStart(2, '0');
  const m = date.getUTCMinutes().toString().padStart(2, '0');
  const s = date.getUTCSeconds().toString().padStart(2, '0');
  const mmm = date.getUTCMilliseconds().toString().padStart(3, '0');
  return `${h}:${m}:${s}.${mmm}`;
};

// --- 1. MEMOIZED ROW COMPONENT ---
const SubtitleRow = memo(
  ({
    sub,
    index,
    displayIndex,
    isActive,
    isSelected,
    isEdited,
    onRowClick,
    editMode,
  }: {
    sub: SmiSubtitle;
    index: number;
    displayIndex: number;
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
          rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (!editMode && isActive) {
          rowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, [isActive, isSelected, editMode]);

    return (
      <TableRow
        ref={rowRef}
        selected={isSelected && editMode}
        onClick={() => onRowClick(index)}
        sx={{
          cursor: "pointer",
          height: 24, // Compact rows like the image
          "&:hover": { bgcolor: alpha(theme.palette.action.hover, 0.1) },
          // Active Playing State (highlight blue like current selection in OS)
          ...(isActive && !editMode && {
            bgcolor: alpha(theme.palette.primary.main, 0.2) + " !important",
          }),
          // Selected Edit State
          ...(isSelected && editMode && {
            bgcolor: alpha(theme.palette.warning.main, 0.2) + " !important",
            borderLeft: `4px solid ${theme.palette.warning.main}`
          })
        }}
      >
        {/* Timestamp */}
        <TableCell
          sx={{
            fontFamily: "monospace",
            width: 140,
            fontSize: '0.85rem',
            userSelect: 'none',
            borderRight: `1px solid ${theme.palette.divider}`,
            py: 0.5,
            color: isEdited ? 'warning.main' : 'text.secondary'
          }}
        >
          {formatTimestampFull(sub.start)}
        </TableCell>

        {/* Line Number */}
        <TableCell
          sx={{
            width: 60,
            textAlign: 'right',
            fontFamily: "monospace",
            color: 'text.secondary',
            borderRight: `1px solid ${theme.palette.divider}`,
            userSelect: 'none',
            py: 0.5,
            px: 1
          }}
        >
          {displayIndex}
        </TableCell>

        {/* Text Content */}
        <TableCell
          sx={{
            fontSize: '0.95rem',
            fontFamily: 'monospace', // Monospace to align Q/A
            whiteSpace: 'pre-wrap', // Preserve alignment/indentation
            py: 0.5,
            color: (sub.confidence || 0) < 80 ? 'warning.main' : 'inherit'
          }}
        >
          {isEdited && <EditIcon sx={{ fontSize: 12, color: 'warning.main', mr: 1, verticalAlign: 'middle' }} />}
          {sub.text}
        </TableCell>
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
      prev.editMode === next.editMode &&
      prev.displayIndex === next.displayIndex
    );
  }
);

// --- 2. MAIN COMPONENT ---
export default function EditorView({
  videos,
  splitPoints,
  subtitles,
  onUpdateSubtitles,
  startLine = 0
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

  // --- TIME UPDATE HANDLER ---
  const handleTimeUpdate = useCallback((time: number) => {
    setGlobalTime(time);

    // Calculate active index solely for display (highlighting currently heard line)
    const newIndex = subtitles.findIndex((sub, idx) => {
      const nextSub = subtitles[idx + 1];
      return time >= sub.start && (!nextSub || time < nextSub.start);
    });
    setActiveIndex((prev) => (prev !== newIndex ? newIndex : prev));
  }, [subtitles]);

  // --- SHORTCUTS HANDLER ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only "Space" allowed for setting timestamp in Edit Mode
      // Arrows removed per user request ("not any keys" for video control)
      if (!editMode || selectedIndex === null || !onUpdateSubtitles) return;

      if (e.code === "Space") {
        e.preventDefault();
        const syncedTime = Math.round(globalTime);
        const updated = [...subtitles];
        updated[selectedIndex] = {
          ...updated[selectedIndex],
          start: syncedTime,
          confidence: 100
        };
        const newEdited = new Set(editedIndices);
        newEdited.add(selectedIndex);
        setEditedIndices(newEdited);
        onUpdateSubtitles(updated);

        // Pause just in case, though we aren't playing much
        playerRef.current?.pause();
        console.log(`✓ Line updated to ${syncedTime}ms`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedIndex, subtitles, onUpdateSubtitles, globalTime, editedIndices]);

  const handleRowClick = useCallback(
    (index: number) => {
      if (editMode) {
        setSelectedIndex(index);
        const start = subtitles[index].start;
        playerRef.current?.seek(start);
        playerRef.current?.pause();
      } else {
        // View Mode: Just Seek. DO NOT AUTO PLAY ("user will play pause")
        const start = subtitles[index].start;
        playerRef.current?.seek(start);
        playerRef.current?.pause();
      }
    },
    [subtitles, editMode]
  );

  return (
    <Box
      display="grid"
      gridTemplateColumns="350px 1fr" // Fixed width video, expanded transcript
      gap={2}
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
        {editMode && selectedIndex !== null && (
          <Box
            position="absolute"
            top={12}
            right={12}
            sx={{ pointerEvents: "none" }}
          >
            <Chip
              icon={<EditIcon />}
              label="SPACE to timestamp"
              color="primary"
              size="small"
              sx={{ bgcolor: "rgba(0,0,0,0.75)", color: "white" }}
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
        {/* Toolbar */}
        <Box
          p={1}
          borderBottom={1}
          borderColor="divider"
          bgcolor={alpha(theme.palette.primary.main, 0.04)}
          display="flex"
          justifyContent="space-between"
          alignItems="center"
        >
          <Box display="flex" alignItems="center" gap={2}>
            {/* View/Edit Toggle */}
            <FormControlLabel
              control={
                <Switch
                  checked={editMode}
                  onChange={(e) => {
                    setEditMode(e.target.checked);
                    if (!e.target.checked) setSelectedIndex(null);
                  }}
                  color="primary"
                  size="small"
                />
              }
              label={<Typography variant="caption" fontWeight={600}>{editMode ? "EDITING" : "VIEWING"}</Typography>}
            />
            <Typography variant="caption" color="text.secondary">
              {filteredSubtitles.length} lines
            </Typography>
          </Box>

          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" mr={1}>Filter:</Typography>
            {/* Confidence Filter */}
            <ToggleButtonGroup
              value={confidenceFilter}
              exclusive
              onChange={(_e, newFilter) => {
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
                  {editMode ? <EditIcon fontSize="small" /> : <Typography variant="caption" fontWeight={600}>VIEW</Typography>}
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
              {filteredSubtitles.map((sub, _index) => {
                // Get original index from the full subtitles array
                const originalIndex = subtitles.indexOf(sub);
                const displayLine = startLine + originalIndex + 1;
                return (
                  <SubtitleRow
                    key={originalIndex}
                    sub={sub}
                    index={originalIndex}
                    displayIndex={displayLine}
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
