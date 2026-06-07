import DifferencePanel from './components/DifferencePanel';
import SideBySideViewer from './components/SideBySideViewer';

function App() {
  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '16px',
        boxSizing: 'border-box',
      }}
    >
      <h1>Document Comparison Tool</h1>
      <SideBySideViewer />
      <DifferencePanel />
    </div>
  );
}

export default App;
