export type DifferenceType = 'added' | 'deleted' | 'modified';

export type DifferenceCategory =
  | 'Identifier Change'
  | 'Quantity Change'
  | 'Amount Change'
  | 'Date Change'
  | 'Text Wording Change'
  | 'Metadata Change'
  | 'Table Value Change'
  | 'Unknown';

export type DifferenceSeverity = 'High' | 'Medium' | 'Low';

export type DifferenceTextPartType = 'unchanged' | 'added' | 'deleted';

export type DifferenceTextPart = {
  type: DifferenceTextPartType;
  text: string;
};

export type ImportantFieldSetting = {
  key: string;
  label: string;
  enabled: boolean;
  isCustom: boolean;
};

export type IgnoreRuleKey =
  | 'pageNumbers'
  | 'printDates'
  | 'generatedDates'
  | 'footerText'
  | 'headerText'
  | 'companyAddress'
  | 'boilerplateTerms';

export type ComparisonSettings = {
  importantFields: ImportantFieldSetting[];
  ignoreRules: Record<IgnoreRuleKey, boolean>;
  showIgnoredDifferences: boolean;
};

export type PdfTextLocation = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
};

export type PdfTextSelection = {
  side: 'before' | 'after';
  pageNumber: number;
  text: string;
};

export type LinkedSelectionState = {
  text: string;
  difference?: Difference;
  message: string;
};

export type Difference = {
  id: string;
  type: DifferenceType;
  category?: DifferenceCategory;
  severity?: DifferenceSeverity;
  isFieldDifference?: boolean;
  fieldKey?: string;
  fieldLabel?: string;
  fieldMatchConfidence?: number;
  fieldMatchConfidenceLevel?: 'high' | 'medium' | 'low';
  pageA?: number;
  pageB?: number;
  textBefore?: string;
  textAfter?: string;
  changedTextBefore?: string;
  changedTextAfter?: string;
  beforeParts?: DifferenceTextPart[];
  afterParts?: DifferenceTextPart[];
  inlineParts?: DifferenceTextPart[];
  beforeLocations?: PdfTextLocation[];
  afterLocations?: PdfTextLocation[];
  ignoredReason?: string;
};

export type ComparisonResult = {
  differences: Difference[];
  ignoredDifferences: Difference[];
};

export type ExtractionStatus = 'not-extracted' | 'extracting' | 'extracted' | 'failed';
export type ExtractionMode = 'text' | 'ocr' | 'failed';

export type ExtractedPdfPage = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  text: string;
  locations: PdfTextLocation[];
};

export type PdfExtractionState = {
  status: ExtractionStatus;
  extractionMode?: ExtractionMode;
  errorMessage?: string;
  pages: ExtractedPdfPage[];
  pageCount: number | null;
};
