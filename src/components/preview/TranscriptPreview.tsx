import { Box, Typography, useTheme, alpha, CircularProgress } from "@mui/material";
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
  
  // Determine colors based on theme mode for better aesthetics
  const isDark = theme.palette.mode === 'dark';
  const bgColor = isDark ? alpha(theme.palette.background.paper, 0.6) : '#fafafa';
  const headerColor = isDark ? theme.palette.background.paper : '#ffffff';
  const borderColor = theme.palette.divider;

  return (
    <Box
      sx={{
        border: 1,
        borderColor: borderColor,
        borderRadius: 2,
        height: "100%",
        overflowY: "auto",
        bgcolor: bgColor,
        backdropFilter: isDark ? "blur(10px)" : "none", // Subtle glass effect in dark mode
        color: theme.palette.text.primary,
        display: "flex",
        flexDirection: "column",
        fontFamily: '"JetBrains Mono", Consolas, "Courier New", monospace', // Better font stack
        boxShadow: theme.shadows[1]
      }}
    >
      <Box 
        sx={{ 
          px: 2,
          py: 1.5,
          borderBottom: 1, 
          borderColor: borderColor,
          position: "sticky",
          top: 0,
          bgcolor: headerColor,
          zIndex: 2,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          boxShadow: isDark ? '0 4px 6px -1px rgba(0, 0, 0, 0.1)' : 'none'
        }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ letterSpacing: '0.5px' }}>
          Transcript Preview
        </Typography>
        <Typography variant="caption" sx={{ opacity: 0.7, fontWeight: 500 }}>
          {annotatedLines.length > 0 
            ? `${summary.totalLines} lines • Original Format`
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
                position: 'relative',
                bgcolor: isSelected 
                  ? alpha(theme.palette.primary.main, isDark ? 0.2 : 0.1) 
                  : 'transparent',
                cursor: isSelectable ? 'pointer' : 'default',
                transition: 'background-color 0.15s ease',
                '&:hover': isSelectable ? {
                  bgcolor: isSelected 
                    ? alpha(theme.palette.primary.main, isDark ? 0.25 : 0.15) 
                    : alpha(theme.palette.text.primary, 0.05)
                } : {},
                lineHeight: 1.6, // Increased line height for readability
                minHeight: '1.6em',
                borderRadius: '2px', // Slight rounding
                my: '4px' // Tiny gap between lines
              }}
            >
               {/* Selection Indicator Bar */}
              {isSelected && (
                <Box 
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: '3px',
                    bgcolor: 'primary.main',
                    borderTopLeftRadius: '2px',
                    borderBottomLeftRadius: '2px'
                  }}
                />
              )}
              
              <Typography 
                component="pre" 
                sx={{ 
                  m: 0, 
                  fontFamily: 'inherit', 
                  fontSize: '0.9rem', // Slightly larger text
                  whiteSpace: 'pre-wrap',
                  width: '100%',
                  color: isSelected ? 'primary.main' : 'inherit',
                  pl: isSelected ? 1 : 0, // Indent slightly when selected
                  transition: 'padding 0.15s ease'
                }}
              >
                {lineCtx.originalText || " "}
              </Typography>
            </Box>
          );
        })}
        
        {/* Scroll Target */}
        {displayedCount < annotatedLines.length && (
           <Box ref={observerTarget} py={3} textAlign="center" sx={{ opacity: 0.5 }}>
             <CircularProgress size={20} thickness={4} />
           </Box>
        )}
      </Box>
    </Box>
  );
}
