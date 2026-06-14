import { useEffect, useMemo, useState } from 'react';
import { getDocument } from 'pdfjs-dist';
import DifferencePanel from './DifferencePanel';
import PDFViewer from './PDFViewer';
import { generateDifferences } from '../services/diffService';
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
  const [selectedDifference, setSelectedDifference] = useState<Difference | null>(null);
  const pdfAExtraction = usePdfTextExtraction(pdfA);
  const pdfBExtraction = usePdfTextExtraction(pdfB);
  const differences = useMemo(() => {
    if (pdfAExtraction.status !== 'extracted' || pdfBExtraction.status !== 'extracted') {
      return [];
    }

    return generateDifferences(pdfAExtraction.pages, pdfBExtraction.pages);
  }, [pdfAExtraction, pdfBExtraction]);

  useEffect(() => {
    if (
      selectedDifference !== null &&
      differences.every((difference) => difference.id !== selectedDifference.id)
    ) {
      setSelectedDifference(null);
    }
  }, [differences, selectedDifference]);

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '16px',
          flex: 1,
        }}
      >
        <PDFViewer
          title="PDF A"
          file={pdfA}
          extraction={pdfAExtraction}
          targetPage={selectedDifference?.pageA}
          onFileSelect={setPdfA}
        />
        <PDFViewer
          title="PDF B"
          file={pdfB}
          extraction={pdfBExtraction}
          targetPage={selectedDifference?.pageB}
          onFileSelect={setPdfB}
        />
      </div>
      <DifferencePanel
        differences={differences}
        selectedDifferenceId={selectedDifference?.id}
        onDifferenceSelect={setSelectedDifference}
      />
    </>
  );
}

export default SideBySideViewer;
