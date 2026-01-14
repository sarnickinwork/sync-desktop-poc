export default function LogsPanel({ logs }: { logs: string[] }) {
  return (
    <div
      style={{
        background: "#f4f4f4",
        padding: "15px",
        borderRadius: "8px",
        height: "150px",
        overflowY: "auto",
        border: "1px solid #ddd",
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
