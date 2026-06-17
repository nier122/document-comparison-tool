import { useEffect, useMemo, useState } from 'react';
import { getDocument } from 'pdfjs-dist';
import ComparisonSettingsPanel from './ComparisonSettingsPanel';
import DifferencePanel from './DifferencePanel';
import PDFExtractionDebugView from './PDFExtractionDebugView';
import PDFViewer from './PDFViewer';
import { defaultComparisonSettings, generateComparisonResult } from '../services/diffService';
import type {
  ComparisonSettings,
  Difference,
  ExtractedPdfPage,
  PdfExtractionState,
  PdfTextLocation,
} from '../types/comparison';

const initialExtractionState: PdfExtractionState = {
  status: 'not-extracted',
  pages: [],
  pageCount: null,
};

const failedExtractionState: PdfExtractionState = {
  status: 'failed',
  pages: [],
  pageCount: null,
};

type PositionedTextItem = PdfTextLocation;

type ExtractedLine = {
  text: string;
  y: number;
  pageHeight: number;
  items: PositionedTextItem[];
};

type ExtractedPageLines = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  lines: ExtractedLine[];
};

type PdfTextContentItem = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
};

const LINE_Y_TOLERANCE = 3;
const PAGE_EDGE_RATIO = 0.12;
const MIN_REPEATED_BOILERPLATE_PAGES = 2;

function normalizeExtractedText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, '$1$2')
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function getLineKey(text: string) {
  return normalizeExtractedText(text).toLowerCase();
}

function isPageEdgeLine(line: ExtractedLine) {
  const yRatio = line.y / line.pageHeight;

  return yRatio <= PAGE_EDGE_RATIO || yRatio >= 1 - PAGE_EDGE_RATIO;
}

function isPageNumberLine(text: string) {
  return /^(?:page\s*)?\d+\s*(?:of|\/|-)\s*\d+$/i.test(text) || /^\d+$/.test(text);
}

function isPrintDateLine(text: string) {
  return (
    /\b(?:printed|print date|generated|created|exported)\b/i.test(text) &&
    /\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/.test(text)
  );
}

function shouldIgnoreLine(line: ExtractedLine, repeatedBoilerplateKeys: Set<string>) {
  const key = getLineKey(line.text);

  if (key.length === 0) {
    return true;
  }

  if (!isPageEdgeLine(line)) {
    return false;
  }

  return isPageNumberLine(key) || isPrintDateLine(key) || repeatedBoilerplateKeys.has(key);
}

function getPositionedTextItem(item: PdfTextContentItem, pageNumber: number): PositionedTextItem | null {
  if (item.str === undefined || item.transform === undefined) {
    return null;
  }

  const text = normalizeExtractedText(item.str);

  if (text.length === 0) {
    return null;
  }

  return {
    pageNumber,
    text,
    x: item.transform[4] ?? 0,
    y: item.transform[5] ?? 0,
    width: item.width ?? 0,
    height: item.height ?? Math.abs(item.transform[3] ?? 0),
  };
}

function groupItemsIntoLines(items: PositionedTextItem[], pageHeight: number): ExtractedLine[] {
  const lines: PositionedTextItem[][] = [];
  const sortedItems = [...items].sort((itemA, itemB) => itemB.y - itemA.y || itemA.x - itemB.x);

  sortedItems.forEach((item) => {
    const matchingLine = lines.find(
      (line) => Math.abs(line[0].y - item.y) <= Math.max(LINE_Y_TOLERANCE, item.height * 0.4),
    );

    if (matchingLine === undefined) {
      lines.push([item]);
    } else {
      matchingLine.push(item);
    }
  });

  return lines
    .map((line) => {
      const sortedLine = [...line].sort((itemA, itemB) => itemA.x - itemB.x);
      const text = normalizeExtractedText(sortedLine.map((item) => item.text).join(' '));
      const y = sortedLine.reduce((total, item) => total + item.y, 0) / sortedLine.length;

      return {
        text,
        y,
        pageHeight,
        items: sortedLine,
      };
    })
    .filter((line) => line.text.length > 0)
    .sort((lineA, lineB) => lineB.y - lineA.y);
}

function getRepeatedBoilerplateKeys(pages: ExtractedPageLines[]) {
  const pageCountByKey = new Map<string, number>();
  const minimumRepeatCount = Math.max(
    MIN_REPEATED_BOILERPLATE_PAGES,
    Math.ceil(pages.length * 0.5),
  );

  pages.forEach((page) => {
    const pageKeys = new Set(
      page.lines.filter(isPageEdgeLine).map((line) => getLineKey(line.text)).filter(Boolean),
    );

    pageKeys.forEach((key) => {
      pageCountByKey.set(key, (pageCountByKey.get(key) ?? 0) + 1);
    });
  });

  return new Set(
    [...pageCountByKey.entries()]
      .filter(([, pageCount]) => pageCount >= minimumRepeatCount)
      .map(([key]) => key),
  );
}

function removeBoilerplateLines(pages: ExtractedPageLines[]): ExtractedPdfPage[] {
  const repeatedBoilerplateKeys = getRepeatedBoilerplateKeys(pages);

  return pages.map((page) => ({
    pageNumber: page.pageNumber,
    pageWidth: page.pageWidth,
    pageHeight: page.pageHeight,
    text: page.lines
      .filter((line) => !shouldIgnoreLine(line, repeatedBoilerplateKeys))
      .map((line) => line.text)
      .join(' ')
      .trim(),
    locations: page.lines
      .filter((line) => !shouldIgnoreLine(line, repeatedBoilerplateKeys))
      .flatMap((line) => line.items),
  }));
}

async function extractPdfText(file: File): Promise<ExtractedPdfPage[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: ExtractedPageLines[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();
    const positionedItems = textContent.items
      .map((item) => getPositionedTextItem(item as PdfTextContentItem, pageIndex))
      .filter((item): item is PositionedTextItem => item !== null);

    pages.push({
      pageNumber: pageIndex,
      pageWidth: viewport.width,
      pageHeight: viewport.height,
      lines: groupItemsIntoLines(positionedItems, viewport.height),
    });
  }

  return removeBoilerplateLines(pages);
}

function usePdfTextExtraction(file: File | null) {
  const [extraction, setExtraction] = useState<PdfExtractionState>(initialExtractionState);

  useEffect(() => {
    let isCurrent = true;

    if (file === null) {
      setExtraction(initialExtractionState);
      return () => {
        isCurrent = false;
      };
    }

    setExtraction({
      status: 'extracting',
      pages: [],
      pageCount: null,
    });

    extractPdfText(file)
      .then((pages) => {
        if (!isCurrent) {
          return;
        }

        setExtraction({
          status: 'extracted',
          pages,
          pageCount: pages.length,
        });
      })
      .catch(() => {
        if (!isCurrent) {
          return;
        }

        setExtraction(failedExtractionState);
      });

    return () => {
      isCurrent = false;
    };
  }, [file]);

  return extraction;
}

function SideBySideViewer() {
  const [pdfA, setPdfA] = useState<File | null>(null);
  const [pdfB, setPdfB] = useState<File | null>(null);
  const [selectedDifference, setSelectedDifference] = useState<Difference | null>(null);
  const [navigationRequest, setNavigationRequest] = useState(0);
  const [showDebugView, setShowDebugView] = useState(false);
  const [isDifferencePanelCollapsed, setIsDifferencePanelCollapsed] = useState(false);
  const [comparisonSettings, setComparisonSettings] =
    useState<ComparisonSettings>(defaultComparisonSettings);
  const pdfAExtraction = usePdfTextExtraction(pdfA);
  const pdfBExtraction = usePdfTextExtraction(pdfB);
  const comparisonResult = useMemo(() => {
    if (pdfAExtraction.status !== 'extracted' || pdfBExtraction.status !== 'extracted') {
      return {
        differences: [],
        ignoredDifferences: [],
      };
    }

    return generateComparisonResult(pdfAExtraction.pages, pdfBExtraction.pages, comparisonSettings);
  }, [comparisonSettings, pdfAExtraction, pdfBExtraction]);
  const differences = comparisonResult.differences;
  const ignoredDifferences = comparisonResult.ignoredDifferences;
  const selectedDifferenceIndex = useMemo(() => {
    if (selectedDifference === null) {
      return -1;
    }

    return differences.findIndex((difference) => difference.id === selectedDifference.id);
  }, [differences, selectedDifference]);

  useEffect(() => {
    if (
      selectedDifference !== null &&
      differences.every((difference) => difference.id !== selectedDifference.id)
    ) {
      setSelectedDifference(null);
    }
  }, [differences, selectedDifference]);

  function handleDifferenceSelect(difference: Difference) {
    setSelectedDifference(difference);
    setNavigationRequest((currentRequest) => currentRequest + 1);
  }

  function goToDifferenceAtIndex(nextIndex: number) {
    const nextDifference = differences[nextIndex];

    if (nextDifference === undefined) {
      return;
    }

    handleDifferenceSelect(nextDifference);
  }

  function goToPreviousDifference() {
    if (selectedDifferenceIndex <= 0) {
      return;
    }

    goToDifferenceAtIndex(selectedDifferenceIndex - 1);
  }

  function goToNextDifference() {
    if (differences.length === 0) {
      return;
    }

    if (selectedDifferenceIndex === -1) {
      goToDifferenceAtIndex(0);
      return;
    }

    goToDifferenceAtIndex(selectedDifferenceIndex + 1);
  }

  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'grid',
          flex: 1,
          gap: '12px',
          gridTemplateColumns: isDifferencePanelCollapsed ? 'minmax(0, 1fr) 56px' : 'minmax(0, 1fr) minmax(340px, 26vw)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <main
          aria-label="PDF review workspace"
          style={{
            display: 'flex',
            gap: '12px',
            minHeight: 0,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <PDFViewer
            title="PDF A"
            file={pdfA}
            extraction={pdfAExtraction}
            highlightSide="before"
            selectedDifference={selectedDifference}
            targetPage={selectedDifference?.pageA}
            navigationRequest={navigationRequest}
            onFileSelect={setPdfA}
          />
          <PDFViewer
            title="PDF B"
            file={pdfB}
            extraction={pdfBExtraction}
            highlightSide="after"
            selectedDifference={selectedDifference}
            targetPage={selectedDifference?.pageB}
            navigationRequest={navigationRequest}
            onFileSelect={setPdfB}
          />
        </main>
        <DifferencePanel
          currentDifferenceIndex={selectedDifferenceIndex}
          differences={differences}
          isCollapsed={isDifferencePanelCollapsed}
          selectedDifferenceId={selectedDifference?.id}
          onCollapseChange={setIsDifferencePanelCollapsed}
          onDifferenceSelect={handleDifferenceSelect}
          onNextDifference={goToNextDifference}
          onPreviousDifference={goToPreviousDifference}
        />
      </div>
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          marginTop: '10px',
        }}
      >
        <label>
          <input
            checked={showDebugView}
            onChange={(event) => setShowDebugView(event.target.checked)}
            type="checkbox"
          />{' '}
          Show Debug View
        </label>
      </div>
      <ComparisonSettingsPanel
        ignoredDifferenceCount={ignoredDifferences.length}
        settings={comparisonSettings}
        onSettingsChange={setComparisonSettings}
      />
      {showDebugView ? (
        <div style={{ maxHeight: '34vh', overflow: 'auto' }}>
          <PDFExtractionDebugView
            pdfAExtraction={pdfAExtraction}
            pdfBExtraction={pdfBExtraction}
          />
        </div>
      ) : null}
      {comparisonSettings.showIgnoredDifferences && ignoredDifferences.length > 0 ? (
        <div style={{ maxHeight: '34vh', marginTop: '10px', overflow: 'auto' }}>
          <DifferencePanel
            differences={ignoredDifferences}
            selectedDifferenceId={selectedDifference?.id}
            onDifferenceSelect={handleDifferenceSelect}
          />
        </div>
      ) : null}
    </div>
  );
}

export default SideBySideViewer;
