type Props = {
  step: number;
  steps: string[];
};

export default function Stepper({ step, steps }: Props) {
  return (
    <div style={{ display: "flex", gap: 20, marginBottom: 30 }}>
      {steps.map((label, i) => (
        <div
          key={label}
          style={{
            padding: "8px 16px",
            borderRadius: 20,
            background: i === step ? "#396cd8" : "#e0e0e0",
            color: i === step ? "white" : "black",
            fontSize: 14,
          }}
        >
          {i + 1}. {label}
        </div>
      ))}
    </div>
  );
}
