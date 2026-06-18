export type DifferenceType = 'added' | 'deleted' | 'modified';

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

export type Difference = {
  id: string;
  type: DifferenceType;
  isFieldDifference?: boolean;
  fieldKey?: string;
  fieldLabel?: string;
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

export type ExtractedPdfPage = {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  text: string;
  locations: PdfTextLocation[];
};

export type PdfExtractionState = {
  status: ExtractionStatus;
  pages: ExtractedPdfPage[];
  pageCount: number | null;
};
