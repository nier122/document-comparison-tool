function App() {
  return (
    <div
      style={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        padding: "16px",
        boxSizing: "border-box",
      }}
    >
      <h1>Document Comparison Tool</h1>

      <div
        style={{
          display: "flex",
          gap: "16px",
          flex: 1,
        }}
      >
        <div
          style={{
            flex: 1,
            border: "1px solid #ccc",
            padding: "16px",
          }}
        >
          <h2>PDF A</h2>

          <input type="file" accept=".pdf" />
        </div>

        <div
          style={{
            flex: 1,
            border: "1px solid #ccc",
            padding: "16px",
          }}
        >
          <h2>PDF B</h2>

          <input type="file" accept=".pdf" />
        </div>
      </div>

      <div
        style={{
          marginTop: "16px",
          border: "1px solid #ccc",
          padding: "16px",
          height: "200px",
        }}
      >
        <h2>Differences</h2>

        <p>No documents loaded.</p>
      </div>
    </div>
  );
}

export default App;