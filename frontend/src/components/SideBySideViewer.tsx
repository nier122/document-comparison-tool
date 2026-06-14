import { useEffect, useMemo, useState } from 'react';
import { getDocument } from 'pdfjs-dist';
import DifferencePanel from './DifferencePanel';
import PDFViewer from './PDFViewer';
import type { Difference, ExtractedPdfPage, PdfExtractionState } from '../types/comparison';

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

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

function createDifferences(pdfAPages: ExtractedPdfPage[], pdfBPages: ExtractedPdfPage[]): Difference[] {
  const differences: Difference[] = [];
  const maxPageCount = Math.max(pdfAPages.length, pdfBPages.length);

  for (let pageIndex = 0; pageIndex < maxPageCount; pageIndex += 1) {
    const pageA = pdfAPages[pageIndex];
    const pageB = pdfBPages[pageIndex];
    const textA = normalizeText(pageA?.text ?? '');
    const textB = normalizeText(pageB?.text ?? '');

    if (textA === textB) {
      continue;
    }

    if (textA.length === 0 && textB.length > 0) {
      differences.push({
        id: `page-${pageIndex + 1}-added`,
        type: 'added',
        pageB: pageB?.pageNumber ?? pageIndex + 1,
        textAfter: textB,
      });
      continue;
    }

    if (textA.length > 0 && textB.length === 0) {
      differences.push({
        id: `page-${pageIndex + 1}-removed`,
        type: 'removed',
        pageA: pageA?.pageNumber ?? pageIndex + 1,
        textBefore: textA,
      });
      continue;
    }

    differences.push({
      id: `page-${pageIndex + 1}-modified`,
      type: 'modified',
      pageA: pageA?.pageNumber ?? pageIndex + 1,
      pageB: pageB?.pageNumber ?? pageIndex + 1,
      textBefore: textA,
      textAfter: textB,
    });
  }

  return differences;
}

async function extractPdfText(file: File): Promise<ExtractedPdfPage[]> {
  const buffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: new Uint8Array(buffer) }).promise;
  const pages: ExtractedPdfPage[] = [];

  for (let pageIndex = 1; pageIndex <= pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex);
    const textContent = await page.getTextContent();
    const text = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();

    pages.push({
      pageNumber: pageIndex,
      text,
    });
  }

  return pages;
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
  const pdfAExtraction = usePdfTextExtraction(pdfA);
  const pdfBExtraction = usePdfTextExtraction(pdfB);
  const differences = useMemo(() => {
    if (pdfAExtraction.status !== 'extracted' || pdfBExtraction.status !== 'extracted') {
      return [];
    }

    return createDifferences(pdfAExtraction.pages, pdfBExtraction.pages);
  }, [pdfAExtraction, pdfBExtraction]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flex: 1,
        }}
      >
        <PDFViewer title="PDF A" file={pdfA} extraction={pdfAExtraction} onFileSelect={setPdfA} />
        <PDFViewer title="PDF B" file={pdfB} extraction={pdfBExtraction} onFileSelect={setPdfB} />
      </div>
      <DifferencePanel differences={differences} />
    </>
  );
}

export default SideBySideViewer;
