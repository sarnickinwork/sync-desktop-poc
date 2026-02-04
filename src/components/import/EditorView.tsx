import { useState, useRef, useEffect, memo, useCallback } from "react";
import {
  Box,
  Paper,
  Typography,
  useTheme,
  Chip,
  Switch,
  FormControlLabel,
  ToggleButtonGroup,
  ToggleButton,
  CircularProgress,
  alpha
} from "@mui/material";
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

/**
 * Format milliseconds to human-readable time (MM:SS.mmm)
 */
function formatTime(ms: number): string {
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const milliseconds = Math.floor(ms % 1000);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(milliseconds).padStart(3, "0")}`;
}

// --- MEMOIZED ROW COMPONENT (matching ResultsDisplay pattern) ---
const SubtitleLine = memo(
  ({
    sub,
    index,
    isActive,
    isSelected,
    isEdited,
    onLineClick,
    onLineDoubleClick,
    editMode,
    startLine,
  }: {
    sub: SmiSubtitle;
    index: number;
    isActive: boolean;
    isSelected: boolean;
    isEdited: boolean;
    onLineClick: (index: number) => void;
    onLineDoubleClick: (index: number) => void;
    editMode: boolean;
    startLine: number;
  }) => {
    const theme = useTheme();
    const lineRef = useRef<HTMLDivElement>(null);

    // Determine if line has a valid timestamp (matching ResultsDisplay pattern)
    // 1. Must not be a page number header
    const isPageNumLine = /^\d+$/.test((sub.text || "").trim());
    // 2. Must not be an empty line
    const isEmptyLine = !(sub.text || "").trim();
    // 3. Must be at or after the selected start line (1-based index vs 0-based prop)
    // If startLine is provided (e.g. 50), then index 0..48 (lines 1..49) should be ignored.
    // startLine is 1-based line number. current line number is index + 1.
    const isBeforeStart = startLine ? (index + 1) < startLine : false;

    const hasTimestamp = sub.start > 0 && !isPageNumLine && !isEmptyLine && !isBeforeStart;

    // Calculate confidence indicator color (matching ResultsDisplay pattern)
    let indicatorColor = theme.palette.success.main;
    if (hasTimestamp) {
      if ((sub.confidence || 0) < 50) {
        indicatorColor = theme.palette.error.main;
      } else if ((sub.confidence || 0) < 80) {
        indicatorColor = theme.palette.warning.main;
      }
    } else {
      indicatorColor = 'transparent';
    }

    useEffect(() => {
      if (lineRef.current) {
        if (editMode && isSelected) {
          lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        } else if (!editMode && isActive) {
          lineRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }
    }, [isActive, isSelected, editMode]);

    return (
      <Box
        ref={lineRef}
        data-subtitle-index={index}
        onClick={() => onLineClick(index)}
        onDoubleClick={() => onLineDoubleClick(index)}
        sx={{
          display: 'flex',
          position: 'relative',
          bgcolor: isSelected && editMode
            ? alpha(theme.palette.warning.main, 0.2)
            : isActive && !editMode
              ? alpha(theme.palette.primary.main, 0.2)
              : 'transparent',
          cursor: 'pointer',
          transition: 'background-color 0.15s ease, filter 0.15s ease',
          '&:hover': {
            filter: 'brightness(0.95)'
          },
          lineHeight: 1.6,
          minHeight: '1.6em',
          borderRadius: '2px',
          my: '2px',
          pl: 12, // Room for Timestamp (80px) + spacing
          ...(isSelected && editMode && {
            borderLeft: `4px solid ${theme.palette.warning.main}`
          })
        }}
      >
        {/* Confidence Indicator Bar (Left edge) - only if hasTimestamp */}
        {hasTimestamp && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: '3px',
              bgcolor: indicatorColor,
              opacity: 0.6,
              borderTopLeftRadius: '2px',
              borderBottomLeftRadius: '2px',
              transition: 'opacity 0.15s ease'
            }}
          />
        )}

        {/* Timestamp (moved to left) */}
        <Typography
          component="span"
          sx={{
            position: 'absolute',
            left: 8,
            top: 0,
            width: 80,
            color: 'primary.main',
            fontSize: '0.75rem',
            opacity: hasTimestamp ? 0.8 : 0,
            userSelect: 'none',
            textAlign: 'left',
            pl: 0.5,
            fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
          }}
        >
          {hasTimestamp ? formatTime(sub.start) : ""}
        </Typography>

        {/* Original line text */}
        <Typography
          component="pre"
          sx={{
            m: 0,
            fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
            fontSize: '0.9rem',
            whiteSpace: 'pre-wrap',
            width: 'auto',
            minWidth: '100%',
            color: 'inherit',
            pr: 8,
            pl: 1
          }}
        >
          {isEdited && <EditIcon sx={{ fontSize: 12, color: 'warning.main', mr: 1, verticalAlign: 'middle' }} />}
          {sub.text || " "}
        </Typography>

        {/* Confidence Badge (Right) */}
        {(sub.confidence || 0) > 0 && hasTimestamp && (
          <Typography
            component="span"
            sx={{
              position: 'absolute',
              right: 8,
              top: 0,
              color: indicatorColor,
              fontSize: '0.7rem',
              fontWeight: 600,
              opacity: 0.7,
              userSelect: 'none'
            }}
          >
            {(sub.confidence || 0).toFixed(0)}%
          </Typography>
        )}
      </Box>
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
      prev.startLine === next.startLine // Add startLine to comparison
    );
  }
);

// --- MAIN COMPONENT ---
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
  const [editMode, setEditMode] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<'all' | 'high' | 'medium' | 'low' | 'edited'>('all');
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [globalTime, setGlobalTime] = useState(0);
  const [editedIndices, setEditedIndices] = useState<Set<number>>(new Set());


  // Infinite Scroll State
  const [displayedCount, setDisplayedCount] = useState(200);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Helper function to check if a line is empty (creates visual gaps)
  const isEmptyLine = (sub: SmiSubtitle) => {
    const trimmedText = (sub.text || "").trim();
    return trimmedText === "";
  };

  // Filter out empty lines for cleaner display and editing
  const nonEmptySubtitles = subtitles.map((sub, idx) => ({ sub, originalIndex: idx }))
    .filter(({ sub }) => !isEmptyLine(sub));

  // Filter subtitles by confidence (applied to non-empty subtitles)
  const filteredSubtitles = nonEmptySubtitles.filter(({ sub, originalIndex: idx }) => {


    if (confidenceFilter === 'all') return true;
    if (confidenceFilter === 'edited') return editedIndices.has(idx);
    if (confidenceFilter === 'high') return (sub.confidence || 0) >= 85;
    if (confidenceFilter === 'medium') return (sub.confidence || 0) >= 70 && (sub.confidence || 0) < 85;
    if (confidenceFilter === 'low') return (sub.confidence || 0) < 70;
    return true;
  });

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setDisplayedCount((prev) => Math.min(prev + 100, filteredSubtitles.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [filteredSubtitles.length, displayedCount]);



  const visibleSubtitles = filteredSubtitles.slice(0, displayedCount);

  // --- TIME UPDATE HANDLER ---
  const handleTimeUpdate = useCallback((time: number) => {
    setGlobalTime(time);

    const newIndex = subtitles.findIndex((sub, idx) => {
      const nextSub = subtitles[idx + 1];
      return time >= sub.start && (!nextSub || time < nextSub.start);
    });
    setActiveIndex((prev) => (prev !== newIndex ? newIndex : prev));
  }, [subtitles]);

  // --- DOUBLE-CLICK HANDLER: Navigate video to timestamp and PAUSE ---
  const handleLineDoubleClick = useCallback(
    (index: number) => {
      const start = subtitles[index].start;
      playerRef.current?.seek(start);
      playerRef.current?.pause();
    },
    [subtitles]
  );

  // --- SINGLE-CLICK HANDLER: Select line for editing ---
  const handleLineClick = useCallback(
    (index: number) => {
      if (editMode) {
        setSelectedIndex(index);
      }
    },
    [editMode]
  );

  // --- SPACEBAR HANDLER: Record timestamp and auto-advance ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!editMode || selectedIndex === null || !onUpdateSubtitles) return;

      if (e.code === "Space") {
        console.log('🔵 SPACEBAR pressed - Edit mode active, selectedIndex:', selectedIndex);

        e.preventDefault();
        e.stopPropagation();

        // Record timestamp with 3-digit millisecond precision
        const syncedTime = Math.round(globalTime);
        console.log('⏱️  Recording timestamp:', syncedTime, 'ms');

        // Update subtitle
        const updated = [...subtitles];
        updated[selectedIndex] = {
          ...updated[selectedIndex],
          start: syncedTime,
          confidence: 100 // Set confidence to 100%
        };

        // Mark as edited
        const newEdited = new Set(editedIndices);
        newEdited.add(selectedIndex);
        setEditedIndices(newEdited);

        console.log('💾 Calling onUpdateSubtitles...');
        // Update subtitles (will trigger auto-save)
        onUpdateSubtitles(updated);

        // Auto-advance to next NON-EMPTY line (skip gaps)
        let nextIndex = selectedIndex + 1;
        while (nextIndex < subtitles.length && isEmptyLine(subtitles[nextIndex])) {
          console.log(`⏩ Skipping empty gap at index ${nextIndex}`);
          nextIndex++;
        }
        
        if (nextIndex < subtitles.length) {
          setSelectedIndex(nextIndex);
          console.log('➡️  Auto-advanced to line:', nextIndex);
        }

        console.log(`✓ Line ${selectedIndex} → ${syncedTime}ms (confidence: 100%)`);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [editMode, selectedIndex, subtitles, onUpdateSubtitles, globalTime, editedIndices]);

  // Calculate summary statistics
  const avgConfidence = subtitles.length > 0
    ? subtitles.reduce((sum, r) => sum + (r.confidence || 0), 0) / subtitles.length
    : 0;

  // Aesthetics matching ResultsDisplay
  const isDark = theme.palette.mode === 'dark';
  const listBgColor = isDark ? alpha(theme.palette.background.paper, 0.6) : '#fafafa';
  const headerColor = isDark ? theme.palette.background.paper : '#ffffff';
  const borderColor = theme.palette.divider;

  return (
    <Box display="grid" gridTemplateColumns="350px 1fr" gap={2} height="75vh" mt={2}>
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
          <Box position="absolute" top={12} right={12} sx={{ pointerEvents: "none" }}>
            <Chip
              variant="outlined"
              label="SPACE to timestamp"
              color="primary"
              size="small"
              sx={{ bgcolor: "rgba(0,0,0,0.75)", color: "white" }}
            />
          </Box>
        )}


      </Paper>

      {/* RIGHT: Transcript List (EXACTLY like ResultsDisplay) */}
      <Box
        sx={{
          height: "100%",
          minHeight: "300px",
          border: 1,
          borderColor: borderColor,
          borderRadius: 2,
          overflow: "hidden",
          bgcolor: listBgColor,
          backdropFilter: isDark ? "blur(10px)" : "none",
          color: theme.palette.text.primary,
          display: "flex",
          flexDirection: "column",
          fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace',
          boxShadow: theme.shadows[1],
          transition: "all 0.3s ease",
          // Custom Scrollbar
          '&::-webkit-scrollbar': {
            width: '6px',
            backgroundColor: 'transparent',
          },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: isDark ? alpha(theme.palette.common.white, 0.2) : alpha(theme.palette.common.black, 0.2),
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: isDark ? alpha(theme.palette.common.white, 0.3) : alpha(theme.palette.common.black, 0.3),
            },
          },
          '&::-webkit-scrollbar-track': {
            backgroundColor: 'transparent',
          },
        }}
        >

        {/* Header - Matching ResultsDisplay */}
        <Box
          sx={{
            px: 2,
            py: 1.5,
            borderBottom: 1,
            borderColor: borderColor,
            bgcolor: headerColor,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
          }}
        >
          <Box display="flex" alignItems="center" gap={2}>
            {/* Edit Mode Indicator Dot */}
            <Box
              sx={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                bgcolor: editMode ? 'error.main' : 'grey.400',
                animation: editMode ? 'pulse 2s ease-in-out infinite' : 'none',
                '@keyframes pulse': {
                  '0%, 100%': {
                    opacity: 1,
                  },
                  '50%': {
                    opacity: 0.3,
                  },
                },
              }}
            />

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
            {/* <Typography variant="caption" color="text.secondary">
              {filteredSubtitles.length} lines
            </Typography> */}
          </Box>

          <Box display="flex" gap={2} alignItems="center">
            <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
              {subtitles.length > 0
                ? `${subtitles.length} lines • Avg: ${avgConfidence.toFixed(0)}%`
                : "No lines"
              }
            </Typography>
          </Box>
        </Box>

        {/* Toolbar with Filters */}
        <Box
          p={1}
          borderBottom={1}
          borderColor="divider"
          bgcolor={alpha(theme.palette.primary.main, 0.04)}
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
        >
          <Box display="flex" alignItems="center" gap={1}>
            <Typography variant="caption" mr={1}>Filter:</Typography>
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
          </Box>
        </Box>

        {/* Content area - Matching ResultsDisplay */}
        <Box
          data-transcript-container
          sx={{
            flexGrow: 1,
            p: 2,
            pb: 10,
            overflowY: "auto",
            overflowX: "hidden"
          }}
        >
          {visibleSubtitles.map(({ sub, originalIndex }) => {
            return (
              <SubtitleLine
                key={originalIndex}
                sub={sub}
                index={originalIndex}
                isActive={originalIndex === activeIndex}
                isSelected={originalIndex === selectedIndex}
                isEdited={editedIndices.has(originalIndex)}
                onLineClick={handleLineClick}
                onLineDoubleClick={handleLineDoubleClick}
                editMode={editMode}
                startLine={startLine}
              />
            );
          })}

          {/* Scroll Target */}
          {displayedCount < filteredSubtitles.length && (
            <Box ref={observerTarget} py={3} textAlign="center" sx={{ opacity: 0.5 }}>
              <CircularProgress size={20} thickness={4} />
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}
