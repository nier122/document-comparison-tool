import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { Document, Page } from 'react-pdf';
import PDFUploadPanel from './PDFUploadPanel';
import type {
  Difference,
  PdfExtractionState,
  PdfTextLocation,
  PdfTextSelection,
} from '../types/comparison';

type PDFViewerProps = {
  title: string;
  file: File | null;
  extraction: PdfExtractionState;
  highlightSide: 'before' | 'after';
  selectedDifference: Difference | null;
  targetPage?: number;
  navigationRequest?: number;
  onFileSelect: (file: File | null) => void;
  onTextSelect: (selection: PdfTextSelection) => void;
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

function getHighlightLocations(
  selectedDifference: Difference | null,
  highlightSide: PDFViewerProps['highlightSide'],
  pageNumber: number,
) {
  if (selectedDifference === null) {
    return [];
  }

  const locations =
    highlightSide === 'before'
      ? selectedDifference.beforeLocations ?? []
      : selectedDifference.afterLocations ?? [];

  return locations.filter((location) => location.pageNumber === pageNumber);
}

function getLocationTop(location: PdfTextLocation, sourcePageHeight: number, scale: number) {
  return (sourcePageHeight - location.y - location.height) * scale;
}

function PDFViewer({
  title,
  file,
  extraction,
  highlightSide,
  selectedDifference,
  targetPage,
  navigationRequest,
  onFileSelect,
  onTextSelect,
}: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [fitToWidth, setFitToWidth] = useState(true);
  const [availablePageWidth, setAvailablePageWidth] = useState(640);
  const viewerRef = useRef<HTMLElement | null>(null);
  const pageAreaRef = useRef<HTMLDivElement | null>(null);
  const firstHighlightRef = useRef<HTMLDivElement | null>(null);

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

  function handleTextPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim() ?? '';
    const target = event.target;
    let text = selectedText;

    if (
      text.length === 0 &&
      target instanceof HTMLElement &&
      target.closest('.react-pdf__Page__textContent') !== null
    ) {
      text = target.textContent?.trim() ?? '';
    }

    if (text.length === 0) {
      return;
    }

    onTextSelect({
      side: highlightSide,
      pageNumber,
      text,
    });
  }

  const pageCount = extraction.pageCount ?? numPages;
  const pageWidth = fitToWidth ? availablePageWidth : Math.round(640 * zoom);
  const currentExtractedPage = extraction.pages.find((page) => page.pageNumber === pageNumber);
  const sourcePageWidth = currentExtractedPage?.pageWidth ?? pageWidth;
  const sourcePageHeight = currentExtractedPage?.pageHeight ?? pageWidth * 1.3;
  const coordinateScale = pageWidth / sourcePageWidth;
  const highlightLocations = useMemo(
    () => getHighlightLocations(selectedDifference, highlightSide, pageNumber),
    [highlightSide, pageNumber, selectedDifference],
  );
  const highlightColor =
    highlightSide === 'before' ? 'rgba(248, 113, 113, 0.36)' : 'rgba(74, 222, 128, 0.36)';
  const highlightBorder = highlightSide === 'before' ? '#dc2626' : '#16a34a';

  useEffect(() => {
    const firstLocation = highlightLocations[0];
    const pageArea = pageAreaRef.current;

    if (firstLocation === undefined || pageArea === null) {
      return;
    }

    const nextTop = Math.max(getLocationTop(firstLocation, sourcePageHeight, coordinateScale) - 80, 0);
    const nextLeft = Math.max(firstLocation.x * coordinateScale - 80, 0);

    pageArea.scrollTo({
      top: nextTop,
      left: nextLeft,
      behavior: 'smooth',
    });

    firstHighlightRef.current?.focus({ preventScroll: true });
  }, [coordinateScale, highlightLocations, navigationRequest, sourcePageHeight]);

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
                data-highlight-layer={highlightLocations.length > 0 ? highlightSide : 'none'}
                onPointerUp={handleTextPointerUp}
                style={{ cursor: 'text', display: 'inline-block', position: 'relative' }}
              >
                <Page pageNumber={pageNumber} width={pageWidth} />
                {highlightLocations.map((location, index) => {
                  const top = getLocationTop(location, sourcePageHeight, coordinateScale);
                  const left = location.x * coordinateScale;
                  const width = Math.max(location.width * coordinateScale, 6);
                  const height = Math.max(location.height * coordinateScale, 8);

                  return (
                    <div
                      aria-label={`${highlightSide === 'before' ? 'Removed' : 'Added'} text: ${location.text}`}
                      key={`${location.pageNumber}-${location.x}-${location.y}-${location.text}-${index}`}
                      ref={index === 0 ? firstHighlightRef : undefined}
                      tabIndex={index === 0 ? -1 : undefined}
                      title={location.text}
                      style={{
                        background: highlightColor,
                        border: `2px solid ${highlightBorder}`,
                        boxShadow:
                          index === 0
                            ? `0 0 0 3px ${highlightSide === 'before' ? 'rgba(220, 38, 38, 0.22)' : 'rgba(22, 163, 74, 0.22)'}`
                            : 'none',
                        left,
                        minHeight: '8px',
                        pointerEvents: 'none',
                        position: 'absolute',
                        top,
                        width,
                        height,
                        zIndex: 4,
                      }}
                    />
                  );
                })}
              </div>
            </Document>
          </div>
        </div>
      )}
    </section>
  );
}

export default PDFViewer;
