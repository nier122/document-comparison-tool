import { useEffect, useState } from 'react';
import { Document, Page } from 'react-pdf';
import PDFUploadPanel from './PDFUploadPanel';
import type { PdfExtractionState } from '../types/comparison';

type PDFViewerProps = {
  title: string;
  file: File | null;
  extraction: PdfExtractionState;
  onFileSelect: (file: File | null) => void;
};

function formatExtractionStatus(status: PdfExtractionState['status']) {
  switch (status) {
    case 'extracting':
      return 'Extracting';
    case 'extracted':
      return 'Extracted';
    case 'failed':
      return 'Failed';
    case 'not-extracted':
      return 'Not Extracted';
  }
}

function PDFViewer({ title, file, extraction, onFileSelect }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
  }, [file]);

  function handleLoadSuccess({ numPages: loadedPages }: { numPages: number }) {
    setNumPages(loadedPages);
    setPageNumber(1);
  }

  function goToPreviousPage() {
    setPageNumber((currentPage) => Math.max(currentPage - 1, 1));
  }

  function goToNextPage() {
    setPageNumber((currentPage) => {
      if (numPages === null) {
        return currentPage;
      }

      return Math.min(currentPage + 1, numPages);
    });
  }

  const pageCount = extraction.pageCount ?? numPages;

  return (
    <section
      style={{
        flex: 1,
        border: '1px solid #ccc',
        padding: '16px',
        overflow: 'auto',
      }}
    >
      <h2>{title}</h2>
      <PDFUploadPanel label={`${title} upload`} onFileSelect={onFileSelect} />

      <div style={{ marginTop: '12px' }}>
        <p>Extraction Status: {formatExtractionStatus(extraction.status)}</p>
        <p>Page Count: {pageCount ?? 'Unknown'}</p>
        {extraction.status === 'failed' ? <p>Text extraction failed for this PDF.</p> : null}
      </div>

      {file === null ? (
        <p>No PDF selected.</p>
      ) : (
        <div style={{ marginTop: '16px' }}>
          <p>
            Page {pageNumber} of {numPages ?? '...'}
          </p>

          <div style={{ display: 'flex', gap: '8px', margin: '8px 0' }}>
            <button type="button" onClick={goToPreviousPage} disabled={pageNumber <= 1}>
              Previous Page
            </button>
            <button
              type="button"
              onClick={goToNextPage}
              disabled={numPages === null || pageNumber >= numPages}
            >
              Next Page
            </button>
          </div>

          <Document file={file} onLoadSuccess={handleLoadSuccess}>
            <Page pageNumber={pageNumber} width={420} />
          </Document>
        </div>
      )}
    </section>
  );
}

export default PDFViewer;
