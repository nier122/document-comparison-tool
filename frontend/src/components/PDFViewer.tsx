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
  const [fitToWidth, setFitToWidth] = useState(true);
  const [availablePageWidth, setAvailablePageWidth] = useState(640);
  const viewerRef = useRef<HTMLElement | null>(null);
  const pageAreaRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setNumPages(null);
    setPageNumber(1);
  }, [file]);

  useEffect(() => {
    const pageArea = pageAreaRef.current;

    if (pageArea === null) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setAvailablePageWidth(Math.max(Math.floor(entry.contentRect.width - 24), 320));
    });

    resizeObserver.observe(pageArea);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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
    setFitToWidth(false);
    setZoom((currentZoom) => Math.max(Number((currentZoom - 0.1).toFixed(1)), 0.6));
  }

  function zoomIn() {
    setFitToWidth(false);
    setZoom((currentZoom) => Math.min(Number((currentZoom + 0.1).toFixed(1)), 1.8));
  }

  function resetZoom() {
    setFitToWidth(false);
    setZoom(1);
  }

  function fitPageToWidth() {
    setFitToWidth(true);
  }

  const pageCount = extraction.pageCount ?? numPages;
  const pageWidth = fitToWidth ? availablePageWidth : Math.round(640 * zoom);

  return (
    <section
      ref={viewerRef}
      style={{
        flex: 1,
        border: '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        minWidth: 0,
        padding: '16px',
        overflow: 'hidden',
      }}
    >
      <div style={{ alignItems: 'center', display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>{title}</h2>
        <span>{file === null ? 'No PDF selected' : `Page ${pageNumber} of ${numPages ?? '...'}`}</span>
      </div>
      <PDFUploadPanel label={`${title} upload`} onFileSelect={onFileSelect} />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', marginTop: '10px' }}>
        <span>Extraction: {formatExtractionStatus(extraction.status)}</span>
        <span>Pages: {pageCount ?? 'Unknown'}</span>
        {extraction.status === 'failed' ? <p>Text extraction failed for this PDF.</p> : null}
      </div>

      {file === null ? (
        <p>No PDF selected.</p>
      ) : (
        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', minHeight: 0, marginTop: '12px' }}>
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
              {fitToWidth ? 'Fit Width' : `${Math.round(zoom * 100)}%`}
            </button>
            <button type="button" onClick={zoomIn} disabled={zoom >= 1.8}>
              Zoom In
            </button>
            <button type="button" onClick={fitPageToWidth} disabled={fitToWidth}>
              Fit To Width
            </button>
          </div>

          <div
            ref={pageAreaRef}
            style={{
              background: '#f3f4f6',
              flex: 1,
              minHeight: 0,
              overflow: 'auto',
              padding: '12px',
            }}
          >
            <Document file={file} onLoadSuccess={handleLoadSuccess}>
              <div
                data-page-number={pageNumber}
                data-highlight-layer="pending"
                style={{ display: 'inline-block', position: 'relative' }}
              >
                <Page pageNumber={pageNumber} width={pageWidth} />
              </div>
            </Document>
          </div>
        </div>
      )}
    </section>
  );
}

export default PDFViewer;
