export type DifferenceType = 'added' | 'removed' | 'modified';

export type Difference = {
  id: string;
  type: DifferenceType;
  pageA?: number;
  pageB?: number;
  textA?: string;
  textB?: string;
};

export type ExtractionStatus = 'not-extracted' | 'extracting' | 'extracted';

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionState = {
  status: ExtractionStatus;
  pages: ExtractedPdfPage[];
  pageCount: number | null;
};
