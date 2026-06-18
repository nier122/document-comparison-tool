import { useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { getDocument } from 'pdfjs-dist';
import ComparisonSettingsPanel from './ComparisonSettingsPanel';
import DifferencePanel from './DifferencePanel';
import PanelResizeHandle from './PanelResizeHandle';
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
const PANEL_LAYOUT_STORAGE_KEY = 'document-comparison-panel-layout';
const COMPARISON_SETTINGS_STORAGE_KEY = 'document-comparison-settings';
const MIN_PDF_PANEL_WIDTH = 320;
const MIN_DIFFERENCE_PANEL_WIDTH = 280;
const COLLAPSED_DIFFERENCE_PANEL_WIDTH = 56;
const MIN_SETTINGS_PANEL_HEIGHT = 150;
const COLLAPSED_SETTINGS_PANEL_HEIGHT = 50;

type PanelLayout = {
  pdfA: number;
  pdfB: number;
  differences: number;
  settingsHeight: number;
  settingsCollapsed: boolean;
};

const defaultPanelLayout: PanelLayout = {
  pdfA: 0.37,
  pdfB: 0.37,
  differences: 0.26,
  settingsHeight: 220,
  settingsCollapsed: true,
};

function getInitialPanelLayout() {
  try {
    const savedLayout = window.localStorage.getItem(PANEL_LAYOUT_STORAGE_KEY);

    if (savedLayout === null) {
      return defaultPanelLayout;
    }

    return {
      ...defaultPanelLayout,
      ...(JSON.parse(savedLayout) as Partial<PanelLayout>),
    };
  } catch {
    return defaultPanelLayout;
  }
}

function getInitialComparisonSettings() {
  try {
    const savedSettings = window.localStorage.getItem(COMPARISON_SETTINGS_STORAGE_KEY);

    if (savedSettings === null) {
      return defaultComparisonSettings;
    }

    const parsedSettings = JSON.parse(savedSettings) as Partial<ComparisonSettings> & {
      importantFields?: ComparisonSettings['importantFields'] | Record<string, boolean>;
    };
    const savedFields = Array.isArray(parsedSettings.importantFields)
      ? parsedSettings.importantFields
      : [];
    const savedFieldByKey = new Map(savedFields.map((field) => [field.key, field]));
    const builtInFields = defaultComparisonSettings.importantFields.map(
      (field) => savedFieldByKey.get(field.key) ?? field,
    );
    const customFields = savedFields.filter((field) => field.isCustom);

    return {
      ...defaultComparisonSettings,
      ...parsedSettings,
      importantFields: [...builtInFields, ...customFields],
      ignoreRules: {
        ...defaultComparisonSettings.ignoreRules,
        ...parsedSettings.ignoreRules,
      },
    };
  } catch {
    return defaultComparisonSettings;
  }
}

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
  const reviewAreaRef = useRef<HTMLDivElement | null>(null);
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const [pdfA, setPdfA] = useState<File | null>(null);
  const [pdfB, setPdfB] = useState<File | null>(null);
  const [selectedDifference, setSelectedDifference] = useState<Difference | null>(null);
  const [navigationRequest, setNavigationRequest] = useState(0);
  const [showDebugView, setShowDebugView] = useState(false);
  const [isDifferencePanelCollapsed, setIsDifferencePanelCollapsed] = useState(false);
  const [panelLayout, setPanelLayout] = useState<PanelLayout>(getInitialPanelLayout);
  const [workspaceWidth, setWorkspaceWidth] = useState(0);
  const [comparisonSettings, setComparisonSettings] =
    useState<ComparisonSettings>(getInitialComparisonSettings);
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

  useEffect(() => {
    window.localStorage.setItem(PANEL_LAYOUT_STORAGE_KEY, JSON.stringify(panelLayout));
  }, [panelLayout]);

  useEffect(() => {
    window.localStorage.setItem(
      COMPARISON_SETTINGS_STORAGE_KEY,
      JSON.stringify(comparisonSettings),
    );
  }, [comparisonSettings]);

  useEffect(() => {
    const workspace = workspaceRef.current;

    if (workspace === null) {
      return;
    }

    const resizeObserver = new ResizeObserver(([entry]) => {
      setWorkspaceWidth(entry.contentRect.width);
    });

    resizeObserver.observe(workspace);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

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

  function startHorizontalResize(
    event: ReactPointerEvent<HTMLDivElement>,
    divider: 'pdfs' | 'differences',
  ) {
    event.preventDefault();

    const availableWidth = Math.max(workspaceWidth - 16, 1);
    const startX = event.clientX;
    const startWidths = {
      pdfA: panelLayout.pdfA * availableWidth,
      pdfB: panelLayout.pdfB * availableWidth,
      differences: panelLayout.differences * availableWidth,
    };

    function handlePointerMove(pointerEvent: PointerEvent) {
      const delta = pointerEvent.clientX - startX;

      if (divider === 'pdfs') {
        const combinedWidth = startWidths.pdfA + startWidths.pdfB;
        const nextPdfA = Math.min(
          Math.max(startWidths.pdfA + delta, MIN_PDF_PANEL_WIDTH),
          combinedWidth - MIN_PDF_PANEL_WIDTH,
        );
        const nextPdfB = combinedWidth - nextPdfA;

        setPanelLayout((currentLayout) => ({
          ...currentLayout,
          pdfA: nextPdfA / availableWidth,
          pdfB: nextPdfB / availableWidth,
        }));
        return;
      }

      if (isDifferencePanelCollapsed) {
        return;
      }

      const combinedWidth = startWidths.pdfB + startWidths.differences;
      const nextPdfB = Math.min(
        Math.max(startWidths.pdfB + delta, MIN_PDF_PANEL_WIDTH),
        combinedWidth - MIN_DIFFERENCE_PANEL_WIDTH,
      );
      const nextDifferenceWidth = combinedWidth - nextPdfB;

      setPanelLayout((currentLayout) => ({
        ...currentLayout,
        pdfB: nextPdfB / availableWidth,
        differences: nextDifferenceWidth / availableWidth,
      }));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function startSettingsResize(event: ReactPointerEvent<HTMLDivElement>) {
    if (panelLayout.settingsCollapsed) {
      return;
    }

    event.preventDefault();
    const startY = event.clientY;
    const startHeight = panelLayout.settingsHeight;
    const maximumHeight = Math.max((reviewAreaRef.current?.clientHeight ?? 600) * 0.55, MIN_SETTINGS_PANEL_HEIGHT);

    function handlePointerMove(pointerEvent: PointerEvent) {
      const nextHeight = Math.min(
        Math.max(startHeight + startY - pointerEvent.clientY, MIN_SETTINGS_PANEL_HEIGHT),
        maximumHeight,
      );

      setPanelLayout((currentLayout) => ({
        ...currentLayout,
        settingsHeight: nextHeight,
      }));
    }

    function handlePointerUp() {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  }

  function setSettingsCollapsed(settingsCollapsed: boolean) {
    setPanelLayout((currentLayout) => ({
      ...currentLayout,
      settingsCollapsed,
    }));
  }

  const availableWorkspaceWidth = Math.max(workspaceWidth - 16, 0);
  const expandedPdfAWidth = panelLayout.pdfA * availableWorkspaceWidth;
  const expandedPdfBWidth = panelLayout.pdfB * availableWorkspaceWidth;
  const collapsedPdfAvailableWidth = Math.max(
    availableWorkspaceWidth - COLLAPSED_DIFFERENCE_PANEL_WIDTH,
    MIN_PDF_PANEL_WIDTH * 2,
  );
  const pdfRatioTotal = panelLayout.pdfA + panelLayout.pdfB;
  const pdfAWidth = isDifferencePanelCollapsed
    ? collapsedPdfAvailableWidth * (panelLayout.pdfA / pdfRatioTotal)
    : expandedPdfAWidth;
  const pdfBWidth = isDifferencePanelCollapsed
    ? collapsedPdfAvailableWidth * (panelLayout.pdfB / pdfRatioTotal)
    : expandedPdfBWidth;
  const differencePanelWidth = isDifferencePanelCollapsed
    ? COLLAPSED_DIFFERENCE_PANEL_WIDTH
    : panelLayout.differences * availableWorkspaceWidth;
  const settingsPanelHeight = panelLayout.settingsCollapsed
    ? COLLAPSED_SETTINGS_PANEL_HEIGHT
    : panelLayout.settingsHeight;

  return (
    <div
      ref={reviewAreaRef}
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      <div
        ref={workspaceRef}
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          minWidth: 0,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex',
            minHeight: 0,
            minWidth: MIN_PDF_PANEL_WIDTH,
            overflow: 'hidden',
            width: pdfAWidth,
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
        </div>
        <PanelResizeHandle
          direction="vertical"
          label="Resize PDF A and PDF B"
          onPointerDown={(event) => startHorizontalResize(event, 'pdfs')}
        />
        <div
          style={{
            display: 'flex',
            minHeight: 0,
            minWidth: MIN_PDF_PANEL_WIDTH,
            overflow: 'hidden',
            width: pdfBWidth,
          }}
        >
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
        </div>
        <PanelResizeHandle
          direction="vertical"
          label="Resize PDF B and differences"
          onPointerDown={(event) => startHorizontalResize(event, 'differences')}
        />
        <div
          style={{
            minHeight: 0,
            minWidth: isDifferencePanelCollapsed
              ? COLLAPSED_DIFFERENCE_PANEL_WIDTH
              : MIN_DIFFERENCE_PANEL_WIDTH,
            overflow: 'hidden',
            width: differencePanelWidth,
          }}
        >
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
      </div>

      <PanelResizeHandle
        direction="horizontal"
        label="Resize comparison settings"
        onPointerDown={startSettingsResize}
      />

      <div
        style={{
          display: 'flex',
          flex: `0 0 ${settingsPanelHeight}px`,
          flexDirection: 'column',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <ComparisonSettingsPanel
          ignoredDifferenceCount={ignoredDifferences.length}
          isCollapsed={panelLayout.settingsCollapsed}
          settings={comparisonSettings}
          onCollapseChange={setSettingsCollapsed}
          onSettingsChange={setComparisonSettings}
        />
        {panelLayout.settingsCollapsed ? null : (
          <div
            style={{
              alignItems: 'center',
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 12px 0',
            }}
          >
            <label>
              <input
                checked={showDebugView}
                onChange={(event) => setShowDebugView(event.target.checked)}
                type="checkbox"
              />{' '}
              Show Extraction Debug View
            </label>
          </div>
        )}
        {!panelLayout.settingsCollapsed && showDebugView ? (
          <PDFExtractionDebugView
            pdfAExtraction={pdfAExtraction}
            pdfBExtraction={pdfBExtraction}
          />
        ) : null}
        {!panelLayout.settingsCollapsed &&
        comparisonSettings.showIgnoredDifferences &&
        ignoredDifferences.length > 0 ? (
          <DifferencePanel
            differences={ignoredDifferences}
            selectedDifferenceId={selectedDifference?.id}
            onDifferenceSelect={handleDifferenceSelect}
          />
        ) : null}
      </div>
    </div>
  );
}

export default SideBySideViewer;
