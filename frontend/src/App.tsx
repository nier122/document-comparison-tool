import SideBySideViewer from './components/SideBySideViewer';

function App() {
  return (
    <div
      style={{
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
        overflow: 'hidden',
        padding: '12px',
        width: '100vw',
      }}
    >
      <h1 style={{ fontSize: '20px', margin: '0 0 12px' }}>Document Comparison Tool</h1>
      <SideBySideViewer />
    </div>
  );
}

export default App;
