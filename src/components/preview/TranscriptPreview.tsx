import { Box, Typography, useTheme, alpha } from "@mui/material";
import { useState, useMemo, useRef, useEffect } from "react";
import { parseCourtTranscript, getTranscriptSummary } from "../../utils/courtTranscriptParser";

interface TranscriptPreviewProps {
  transcript: string;
  onLineSelect?: (lineNumber: number) => void;
  selectedLine?: number | null;
}

export default function TranscriptPreview({
  transcript,
  onLineSelect,
  selectedLine
}: TranscriptPreviewProps) {
  const theme = useTheme();
  
  // Infinite Scroll State - Start with more lines to fill viewport
  const [displayedCount, setDisplayedCount] = useState(200);
  const observerTarget = useRef<HTMLDivElement>(null);

  // Parse the transcript (Memoized)
  const annotatedLines = useMemo(() => {
    return parseCourtTranscript(transcript);
  }, [transcript]);

  const summary = useMemo(() => {
    return getTranscriptSummary(annotatedLines);
  }, [annotatedLines]);

  // Infinite Scroll Observer
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
           setDisplayedCount((prev) => Math.min(prev + 100, annotatedLines.length));
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => observer.disconnect();
  }, [annotatedLines.length]);

  const handleLineClick = (absoluteLineNumber: number) => {
    if (onLineSelect) {
      onLineSelect(absoluteLineNumber);
    }
  };

  const visibleLines = annotatedLines.slice(0, displayedCount);

  return (
    <Box
      sx={{
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
        height: "100%",
        overflowY: "auto",
        bgcolor: theme.palette.mode === 'dark' ? '#1e1e1e' : '#fafafa',
        color: theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
        fontFamily: 'Consolas, "Courier New", monospace'
      }}
    >
      <Box 
        sx={{ 
          p: 1.5, 
          borderBottom: 1, 
          borderColor: "divider",
          position: "sticky",
          top: 0,
          bgcolor: theme.palette.mode === 'dark' ? '#252526' : '#ffffff',
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="subtitle2" fontWeight={600}>
          Transcript Preview (Original View)
        </Typography>
        <Typography variant="caption" color="text.secondary">
          {annotatedLines.length > 0 
            ? `${summary.totalLines} syncable lines identified`
            : "No lines"
          }
        </Typography>
      </Box>

      <Box sx={{ flexGrow: 1, p: 2, pb: 10 }}>
        {visibleLines.map((lineCtx, index) => {
          const metadata = lineCtx.metadata;
          const isSelectable = !!metadata;
          const isSelected = metadata && selectedLine === metadata.absoluteLineNumber;

          return (
            <Box
              key={index}
              onClick={() => isSelectable && handleLineClick(metadata!.absoluteLineNumber)}
              sx={{
                display: 'flex',
                bgcolor: isSelected ? alpha(theme.palette.primary.main, 0.3) : 'transparent',
                cursor: isSelectable ? 'pointer' : 'default',
                '&:hover': isSelectable ? {
                  bgcolor: isSelected 
                    ? alpha(theme.palette.primary.main, 0.3) 
                    : alpha(theme.palette.action.hover, 0.1)
                } : {},
                lineHeight: 1.5,
                minHeight: '1.5em'
              }}
            >
              <Typography 
                component="pre" 
                sx={{ 
                  m: 0, 
                  fontFamily: 'inherit', 
                  fontSize: '14px',
                  whiteSpace: 'pre-wrap',
                  width: '100%',
                  color: 'inherit'
                }}
              >
                {lineCtx.originalText || " "}
              </Typography>
            </Box>
          );
        })}
        
        {/* Scroll Target */}
        {displayedCount < annotatedLines.length && (
           <Box ref={observerTarget} py={2} textAlign="center">
             <Typography variant="caption" color="text.secondary">Loading more...</Typography>
           </Box>
        )}
      </Box>
    </Box>
  );
}
