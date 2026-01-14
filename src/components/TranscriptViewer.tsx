export default function TranscriptViewer({ data }: { data: any }) {
  if (!data) return null;

  return (
    <div style={{ marginTop: "30px" }}>
      <h3>Transcription Result (JSON):</h3>
      <div
        style={{
          background: "#1e1e1e",
          color: "#a6e22e",
          padding: "20px",
          borderRadius: "8px",
          overflowX: "auto",
          maxHeight: "500px",
          overflowY: "auto",
        }}
      >
        <pre>{JSON.stringify(data, null, 2)}</pre>
      </div>
    </div>
  );
}
