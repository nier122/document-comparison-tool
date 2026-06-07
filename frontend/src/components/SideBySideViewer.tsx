import { useState } from 'react';
import PDFViewer from './PDFViewer';

function SideBySideViewer() {
  const [pdfA, setPdfA] = useState<File | null>(null);
  const [pdfB, setPdfB] = useState<File | null>(null);

  return (
    <div
      style={{
        display: 'flex',
        gap: '16px',
        flex: 1,
      }}
    >
      <PDFViewer title="PDF A" file={pdfA} onFileSelect={setPdfA} />
      <PDFViewer title="PDF B" file={pdfB} onFileSelect={setPdfB} />
    </div>
  );
}

export default SideBySideViewer;
