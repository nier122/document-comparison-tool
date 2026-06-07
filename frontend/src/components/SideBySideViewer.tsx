import PDFViewer from './PDFViewer';

function SideBySideViewer() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        flex: 1,
      }}
    >
      <PDFViewer title="PDF A" />
      <PDFViewer title="PDF B" />
    </div>
  );
}

export default SideBySideViewer;
