export function App() {
  return (
    <div
      style={{
        fontFamily: "ui-sans-serif, system-ui, sans-serif",
        background: "#0c0c10",
        color: "#e8e8ee",
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
      }}
    >
      <h1 style={{ margin: 0, letterSpacing: "0.05em" }}>DnDMate</h1>
      <p style={{ margin: 0, color: "#8a8a9c", fontSize: "0.9rem" }}>Electron scaffold — M0</p>
      <p style={{ margin: 0, color: "#5dd39e", fontSize: "0.75rem" }}>
        preload bridge: {window.dndmate?.version ?? "(unavailable)"}
      </p>
    </div>
  );
}
