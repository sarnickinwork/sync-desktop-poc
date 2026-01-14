import { useTheme } from "@mui/material/styles";

export default function LogsPanel({ logs }: { logs: string[] }) {
  const theme = useTheme();

  return (
    <div
      style={{
        // Dynamic background and border colors
        background: theme.palette.mode === "dark" ? "#1e1e1e" : "#f4f4f4",
        border: `1px solid ${theme.palette.divider}`,
        color: theme.palette.text.primary,
        padding: "15px",
        borderRadius: "8px",
        height: "150px",
        overflowY: "auto",
      }}
    >
      <strong>Logs:</strong>
      {logs.map((l, i) => (
        <div key={i} style={{ fontSize: "12px", marginTop: "4px" }}>
          {l}
        </div>
      ))}
    </div>
  );
}
