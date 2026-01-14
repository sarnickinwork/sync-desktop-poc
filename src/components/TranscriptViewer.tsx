import { useTheme } from "@mui/material/styles";

export default function TranscriptViewer({ data }: { data: any }) {
  const theme = useTheme();

  if (!data) return null;

  return (
    <div style={{ marginTop: "30px" }}>
      <h3 style={{ color: theme.palette.text.primary }}>
        Transcription Result (JSON):
      </h3>
      <div
        style={{
          // We keep the code block dark (standard for code),
          // or you could use theme.palette.background.paper if you want it to flip
          background: "#1e1e1e",
          color: "#a6e22e",
          padding: "20px",
          borderRadius: "8px",
          overflowX: "auto",
          maxHeight: "500px",
          overflowY: "auto",
          border: `1px solid ${theme.palette.divider}`,
        }}
      >
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
