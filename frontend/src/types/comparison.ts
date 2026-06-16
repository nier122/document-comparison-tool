export type DifferenceType = 'added' | 'deleted' | 'modified';

export type DifferenceTextPartType = 'unchanged' | 'added' | 'deleted';

export type DifferenceTextPart = {
  type: DifferenceTextPartType;
  text: string;
};

export type Difference = {
  id: string;
  type: DifferenceType;
  pageA?: number;
  pageB?: number;
  textBefore?: string;
  textAfter?: string;
  changedTextBefore?: string;
  changedTextAfter?: string;
  beforeParts?: DifferenceTextPart[];
  afterParts?: DifferenceTextPart[];
  inlineParts?: DifferenceTextPart[];
};

export type ExtractionStatus = 'not-extracted' | 'extracting' | 'extracted' | 'failed';

export type ExtractedPdfPage = {
  pageNumber: number;
  text: string;
};

export type PdfExtractionState = {
  status: ExtractionStatus;
  pages: ExtractedPdfPage[];
  pageCount: number | null;
};
