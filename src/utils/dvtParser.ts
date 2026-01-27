/**
 * Parse a DVT file and extract page/line number information
 * Returns a map of text -> {pageNo, lineNo} for lookup
 */
export interface DVTLineInfo {
  pageNo: number;
  lineNo: number;
  text: string;
  startTime?: number;
  endTime?: number;
}

export function parseDVT(dvtContent: string): Map<string, DVTLineInfo> {
  const lineMap = new Map<string, DVTLineInfo>();
  
  try {
    // Parse XML
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(dvtContent, "text/xml");
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector("parsererror");
    if (parserError) {
      console.error("DVT parsing error:", parserError.textContent);
      return lineMap;
    }
    
    // Get all Line elements
    const lines = xmlDoc.querySelectorAll("Line");
    
    lines.forEach((line) => {
      const pageNoEl = line.querySelector("PageNo");
      const lineNoEl = line.querySelector("LineNo");
      const textEl = line.querySelector("Text");
      const startTimeEl = line.querySelector("StartTime");
      const endTimeEl = line.querySelector("EndTime");
      
      if (pageNoEl && lineNoEl && textEl) {
        const pageNo = parseInt(pageNoEl.textContent || "0");
        const lineNo = parseInt(lineNoEl.textContent || "0");
        const text = textEl.textContent || "";
        
        // Skip empty lines
        if (text.trim().length === 0) {
          return;
        }
        
        // Normalize text for matching (remove extra spaces, convert \xa0 to space)
        const normalizedText = text
          .replace(/\xa0/g, " ")  // Replace non-breaking spaces
          .replace(/\s+/g, " ")    // Normalize multiple spaces
          .trim();
        
        const lineInfo: DVTLineInfo = {
          pageNo,
          lineNo,
          text: normalizedText
        };
        
        // Add timestamps if available
        if (startTimeEl) {
          lineInfo.startTime = parseFloat(startTimeEl.textContent || "0") * 1000; // Convert to ms
        }
        if (endTimeEl) {
          lineInfo.endTime = parseFloat(endTimeEl.textContent || "0") * 1000; // Convert to ms
        }
        
        // Store in map using normalized text as key
        lineMap.set(normalizedText, lineInfo);
      }
    });
    
    console.log(`Parsed ${lineMap.size} lines from DVT file`);
  } catch (error) {
    console.error("Error parsing DVT:", error);
  }
  
  return lineMap;
}

/**
 * Parse a SYN file and extract page/line number information
 * Returns a map of text -> {pageNo, lineNo} for lookup
 */
export function parseSYNForLineInfo(synContent: string): Map<string, DVTLineInfo> {
  const lineMap = new Map<string, DVTLineInfo>();
  
  try {
    const synData = JSON.parse(synContent);
    
    // Check if we have synchronization sentences with page/line info
    if (synData.synchronization && synData.synchronization.sentences) {
      synData.synchronization.sentences.forEach((sentence: any) => {
        if (sentence.text || sentence.sentence) {
          const text = sentence.text || sentence.sentence;
          
          // Normalize text
          const normalizedText = text
            .replace(/\s+/g, " ")
            .trim();
          
          const lineInfo: DVTLineInfo = {
            pageNo: sentence.pageNumber || 0,
            lineNo: sentence.lineNumber || 0,
            text: normalizedText,
            startTime: sentence.start,
            endTime: sentence.end
          };
          
          lineMap.set(normalizedText, lineInfo);
        }
      });
      
      console.log(`Parsed ${lineMap.size} lines from SYN file`);
    }
  } catch (error) {
    console.error("Error parsing SYN:", error);
  }
  
  return lineMap;
}

/**
 * Parse a SYN file and extract page/line number information indexing by Start Time
 * Returns a map of startTime -> DVTLineInfo for lookup
 */
export function parseSYNForLineInfoByTime(synContent: string): Map<number, DVTLineInfo> {
  const lineMap = new Map<number, DVTLineInfo>();
  
  try {
    const synData = JSON.parse(synContent);
    
    if (synData.synchronization && synData.synchronization.sentences) {
      synData.synchronization.sentences.forEach((sentence: any) => {
        if ((sentence.text || sentence.sentence) && typeof sentence.start === 'number') {
          const text = sentence.text || sentence.sentence;
          const normalizedText = text.replace(/\s+/g, " ").trim();
          
          const lineInfo: DVTLineInfo = {
            pageNo: sentence.pageNumber || 0,
            lineNo: sentence.lineNumber || 0,
            text: normalizedText,
            startTime: sentence.start,
            endTime: sentence.end
          };
          
          // Index by start time
          lineMap.set(sentence.start, lineInfo);
        }
      });
      
      console.log(`Parsed ${lineMap.size} lines from SYN file by Time`);
    }
  } catch (error) {
    console.error("Error parsing SYN by Time:", error);
  }
  
  return lineMap;
}

/**
 * Enrich mapped sentence results with page/line numbers from DVT or SYN
 * Tries to match by startTime first, then falls back to text matching if available, or preserves existing.
 */
export function enrichWithLineNumbers(
  mappedSentences: any[],
  lineInfoMap: Map<string, DVTLineInfo>,
  timeInfoMap?: Map<number, DVTLineInfo> // Optional time-based map
): any[] {
  return mappedSentences.map((sentence) => {
    let lineInfo: DVTLineInfo | undefined;

    // 1. Try matching by Time (if available and valid timestamp)
    if (timeInfoMap && typeof sentence.start === 'number' && sentence.start > 0) {
        lineInfo = timeInfoMap.get(sentence.start);
    }

    // 2. Fallback to Text matching
    if (!lineInfo) {
        const text = (sentence.text || sentence.sentence || "")
        .replace(/\s+/g, " ")
        .trim();
        lineInfo = lineInfoMap.get(text);
    }
    
    if (lineInfo) {
      return {
        ...sentence,
        pageNumber: lineInfo.pageNo,
        lineNumber: lineInfo.lineNo
      };
    }
    
    return {
      ...sentence,
      // Keep existing page/line numbers if enrichment fails (don't overwrite with 0)
      pageNumber: sentence.pageNumber || 0,
      lineNumber: sentence.lineNumber || 0
    };
  });
}