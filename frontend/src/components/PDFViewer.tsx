import { useEffect, useRef, useState } from 'react';
import { Document, Page } from 'react-pdf';
import PDFUploadPanel from './PDFUploadPanel';
import type { PdfExtractionState } from '../types/comparison';

type PDFViewerProps = {
  title: string;
  file: File | null;
  extraction: PdfExtractionState;
  targetPage?: number;
  navigationRequest?: number;
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

function PDFViewer({
  title,
  file,
  extraction,
  targetPage,
  navigationRequest,
  onFileSelect,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const viewerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
  }, [file]);

  useEffect(() => {
    if (targetPage === undefined || numPages === null) {
      return;
    }

    const nextPage = Math.min(Math.max(targetPage, 1), numPages);
    setPageNumber(nextPage);
    viewerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [targetPage, numPages, navigationRequest]);

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

  function zoomOut() {
    setZoom((currentZoom) => Math.max(Number((currentZoom - 0.1).toFixed(1)), 0.6));
  }

  function zoomIn() {
    setZoom((currentZoom) => Math.min(Number((currentZoom + 0.1).toFixed(1)), 1.8));
  }

  function resetZoom() {
    setZoom(1);
  }

  const pageCount = extraction.pageCount ?? numPages;
  const pageWidth = Math.round(420 * zoom);

  return (
    <section
      ref={viewerRef}
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', margin: '8px 0' }}>
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
            <button type="button" onClick={zoomOut} disabled={zoom <= 0.6}>
              Zoom Out
            </button>
            <button type="button" onClick={resetZoom} disabled={zoom === 1}>
              {Math.round(zoom * 100)}%
            </button>
            <button type="button" onClick={zoomIn} disabled={zoom >= 1.8}>
              Zoom In
            </button>
          </div>

          <Document file={file} onLoadSuccess={handleLoadSuccess}>
            <Page pageNumber={pageNumber} width={pageWidth} />
          </Document>
        </div>
      )}
    </section>
  );
}

export default PDFViewer;
