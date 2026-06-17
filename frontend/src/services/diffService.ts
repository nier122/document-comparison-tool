import type {
  ComparisonFieldKey,
  ComparisonResult,
  ComparisonSettings,
  Difference,
  DifferenceTextPart,
  ExtractedPdfPage,
  PdfTextLocation,
} from '../types/comparison';

type TextBlock = {
  pageNumber: number;
  text: string;
  key: string;
  tokens: string[];
  locations: PdfTextLocation[];
};

type FieldDefinition = {
  key: string;
  label: string;
  labelPattern: string;
  valuePattern: string;
  aliases: string[];
};

type ExtractedField = {
  key: string;
  label: string;
  values: string[];
  normalizedValues: string[];
  pageNumber: number;
  sourceText: string;
  locations: PdfTextLocation[];
};

type FieldCandidate = {
  key: string;
  label: string;
  value: string;
  pageNumber: number;
  sourceText: string;
  locations: PdfTextLocation[];
};

type TextLine = {
  pageNumber: number;
  pageHeight: number;
  text: string;
  y: number;
  locations: PdfTextLocation[];
};

type BlockUnit = {
  text: string;
  locations: PdfTextLocation[];
};

type DiffOperation =
  | {
      type: 'equal';
      blockA: TextBlock;
      blockB: TextBlock;
    }
  | {
      type: 'delete';
      block: TextBlock;
    }
  | {
      type: 'add';
      block: TextBlock;
    };

const MIN_MEANINGFUL_KEY_LENGTH = 3;
const MODIFIED_SIMILARITY_THRESHOLD = 0.35;
const TABLE_LINE_Y_TOLERANCE = 3;
const MAX_MULTI_WORD_FIELD_VALUE_LOCATIONS = 4;
export const defaultComparisonSettings: ComparisonSettings = {
  importantFields: {
    poNumber: true,
    invoiceNumber: true,
    date: true,
    quantity: true,
    amount: true,
    total: true,
    itemDescription: true,
    remarks: true,
  },
  ignoreRules: {
    pageNumbers: true,
    printDates: true,
    generatedDates: true,
    footerText: true,
    headerText: true,
    companyAddress: true,
    boilerplateTerms: true,
  },
  showIgnoredDifferences: false,
};
const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'poNumber',
    label: 'PO Number',
    labelPattern: String.raw`(?:P\.?\s*O\.?|PO|Purchase\s+Order)\s*(?:No\.?|Number)?`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9./-]*`,
    aliases: ['po', 'po no', 'po number', 'purchase order', 'purchase order no', 'purchase order number'],
  },
  {
    key: 'invoiceNumber',
    label: 'Invoice Number',
    labelPattern: String.raw`Invoice\s*(?:No\.?|Number)?`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9./-]*`,
    aliases: ['invoice', 'invoice no', 'invoice number', 'inv no', 'inv number'],
  },
  {
    key: 'date',
    label: 'Date',
    labelPattern: String.raw`Date`,
    valuePattern: String.raw`(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})`,
    aliases: ['date', 'order date', 'invoice date'],
  },
  {
    key: 'amount',
    label: 'Amount',
    labelPattern: String.raw`Amount`,
    valuePattern: String.raw`(?:[$\u20ac\u00a3]\s*)?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?`,
    aliases: ['amount', 'amt'],
  },
  {
    key: 'total',
    label: 'Total',
    labelPattern: String.raw`(?:Grand\s+)?Total`,
    valuePattern: String.raw`(?:[$\u20ac\u00a3]\s*)?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?`,
    aliases: ['total', 'grand total', 'net total'],
  },
  {
    key: 'quantity',
    label: 'Quantity',
    labelPattern: String.raw`(?:Qty\.?|Quantity)`,
    valuePattern: String.raw`-?\d+(?:\.\d+)?`,
    aliases: ['qty', 'quantity'],
  },
  {
    key: 'itemCode',
    label: 'Item Code',
    labelPattern: String.raw`(?:Item\s*(?:Code|No\.?|Number)|SKU|Part\s*(?:Code|No\.?|Number))`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9._/-]*`,
    aliases: ['item code', 'item no', 'item number', 'sku', 'part code', 'part no', 'part number'],
  },
  {
    key: 'customer',
    label: 'Customer',
    labelPattern: String.raw`(?:Customer|Bill\s*To|Buyer)`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9&.,'() /-]{1,80}`,
    aliases: ['customer', 'customer name', 'bill to', 'buyer'],
  },
  {
    key: 'supplier',
    label: 'Supplier',
    labelPattern: String.raw`(?:Supplier|Vendor|Seller|Ship\s*From)`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9&.,'() /-]{1,80}`,
    aliases: ['supplier', 'vendor', 'seller', 'ship from'],
  },
  {
    key: 'itemDescription',
    label: 'Item Description',
    labelPattern: String.raw`(?:Item\s*Description|Description|Material|Service|Item)`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9&.,'() /-]{1,160}`,
    aliases: ['item description', 'description', 'material', 'service', 'item'],
  },
  {
    key: 'remarks',
    label: 'Remarks',
    labelPattern: String.raw`(?:Remarks?|Notes?|Comments?)`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9&.,'() /-]{1,220}`,
    aliases: ['remark', 'remarks', 'note', 'notes', 'comment', 'comments'],
  },
];

function normalizeDisplayText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/([A-Za-z])-\s+([A-Za-z])/g, '$1$2')
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/\s+([,.;:!?])/g, '$1')
    .replace(/([([{])\s+/g, '$1')
    .replace(/\s+([)\]}])/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

function createComparisonKey(text: string) {
  return normalizeDisplayText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokenizeKey(key: string) {
  if (key.length === 0) {
    return [];
  }

  return key.split(' ');
}

function getLocationKey(location: PdfTextLocation) {
  return createComparisonKey(location.text);
}

function dedupeLocations(locations: PdfTextLocation[]) {
  const seenLocations = new Set<string>();
  const uniqueLocations: PdfTextLocation[] = [];

  locations.forEach((location) => {
    const key = getLocationIdentity(location);

    if (seenLocations.has(key)) {
      return;
    }

    seenLocations.add(key);
    uniqueLocations.push(location);
  });

  return uniqueLocations;
}

function getLocationIdentity(location: PdfTextLocation) {
  return [
    location.pageNumber,
    Math.round(location.x * 100) / 100,
    Math.round(location.y * 100) / 100,
    location.text,
  ].join('|');
}

function findLocationsForText(locations: PdfTextLocation[], text: string) {
  const textTokens = new Set(tokenizeKey(createComparisonKey(text)));

  if (textTokens.size === 0) {
    return [];
  }

  return dedupeLocations(
    locations.filter((location) => {
      const locationTokens = tokenizeKey(getLocationKey(location));

      return locationTokens.some((token) => textTokens.has(token));
    }),
  );
}

function getLineLocationsByReadingOrder(locations: PdfTextLocation[]) {
  return [...locations].sort((locationA, locationB) => locationB.y - locationA.y || locationA.x - locationB.x);
}

function groupLocationsIntoLines(page: ExtractedPdfPage): TextLine[] {
  const lineGroups: PdfTextLocation[][] = [];

  getLineLocationsByReadingOrder(page.locations).forEach((location) => {
    const matchingLine = lineGroups.find(
      (line) => Math.abs(line[0].y - location.y) <= Math.max(TABLE_LINE_Y_TOLERANCE, location.height * 0.4),
    );

    if (matchingLine === undefined) {
      lineGroups.push([location]);
    } else {
      matchingLine.push(location);
    }
  });

  return lineGroups
    .map((lineLocations) => {
      const sortedLocations = [...lineLocations].sort((locationA, locationB) => locationA.x - locationB.x);

      return {
        pageNumber: page.pageNumber,
        pageHeight: page.pageHeight,
        text: normalizeDisplayText(sortedLocations.map((location) => location.text).join(' ')),
        y: sortedLocations.reduce((total, location) => total + location.y, 0) / sortedLocations.length,
        locations: sortedLocations,
      };
    })
    .filter((line) => line.text.length > 0)
    .sort((lineA, lineB) => lineB.y - lineA.y);
}

function getCanonicalFieldDefinition(label: string) {
  const labelKey = createComparisonKey(label);

  if (labelKey.length === 0) {
    return undefined;
  }

  return FIELD_DEFINITIONS.find((fieldDefinition) =>
    fieldDefinition.aliases.some((alias) => {
      const aliasKey = createComparisonKey(alias);

      return labelKey === aliasKey || labelKey.endsWith(` ${aliasKey}`) || aliasKey.endsWith(` ${labelKey}`);
    }),
  );
}

function doesValueMatchField(fieldDefinition: FieldDefinition, value: string) {
  return new RegExp(`^${fieldDefinition.valuePattern}$`, 'i').test(normalizeDisplayText(value));
}

function isMultiWordField(fieldDefinition: FieldDefinition) {
  return (
    fieldDefinition.key === 'customer' ||
    fieldDefinition.key === 'supplier' ||
    fieldDefinition.key === 'itemDescription' ||
    fieldDefinition.key === 'remarks'
  );
}

function getValueLocationsAfterLabel(
  fieldDefinition: FieldDefinition,
  locations: PdfTextLocation[],
  valueStartIndex: number,
) {
  const valueLocations: PdfTextLocation[] = [];

  for (let locationIndex = valueStartIndex; locationIndex < locations.length; locationIndex += 1) {
    const location = locations[locationIndex];
    const adjacentLabelText = normalizeDisplayText(
      [location.text, locations[locationIndex + 1]?.text].filter(Boolean).join(' '),
    );

    if (
      valueLocations.length > 0 &&
      (getCanonicalFieldDefinition(location.text) !== undefined ||
        getCanonicalFieldDefinition(adjacentLabelText) !== undefined)
    ) {
      break;
    }

    const nextValueLocations = [...valueLocations, location];
    const singleValue = normalizeDisplayText(location.text);
    const combinedValue = normalizeDisplayText(nextValueLocations.map((valueLocation) => valueLocation.text).join(' '));

    if (doesValueMatchField(fieldDefinition, singleValue)) {
      return [location];
    }

    if (doesValueMatchField(fieldDefinition, combinedValue)) {
      return nextValueLocations;
    }

    if (!isMultiWordField(fieldDefinition)) {
      break;
    }

    valueLocations.push(location);

    if (valueLocations.length >= MAX_MULTI_WORD_FIELD_VALUE_LOCATIONS) {
      break;
    }
  }

  return valueLocations;
}

function addFieldCandidate(candidates: FieldCandidate[], candidate: FieldCandidate) {
  const value = normalizeDisplayText(candidate.value);

  if (value.length === 0) {
    return;
  }

  candidates.push({
    ...candidate,
    value,
    sourceText: normalizeDisplayText(candidate.sourceText),
    locations: dedupeLocations(candidate.locations),
  });
}

function isMeaningfulKey(key: string) {
  return key.replace(/\s/g, '').length >= MIN_MEANINGFUL_KEY_LENGTH;
}

function normalizeFieldValue(value: string) {
  return normalizeDisplayText(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[$\u20ac\u00a3,]/g, '')
    .trim();
}

function getFieldPattern(fieldDefinition: FieldDefinition) {
  return new RegExp(
    String.raw`(?:^|\b)(${fieldDefinition.labelPattern})\s*(?:[:|#-]|\s{2,}|\s)\s*(${fieldDefinition.valuePattern})`,
    'gi',
  );
}

function extractInlineFieldCandidates(page: ExtractedPdfPage, line: TextLine) {
  const candidates: FieldCandidate[] = [];

  FIELD_DEFINITIONS.forEach((fieldDefinition) => {
    const pattern = getFieldPattern(fieldDefinition);
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line.text)) !== null) {
      const sourceText = normalizeDisplayText(match[0]);
      const value = normalizeDisplayText(match[2] ?? '');

      addFieldCandidate(candidates, {
        key: fieldDefinition.key,
        label: fieldDefinition.label,
        value,
        pageNumber: page.pageNumber,
        sourceText,
        locations: findLocationsForText(line.locations, value),
      });
    }
  });

  return candidates;
}

function extractRowFieldCandidates(page: ExtractedPdfPage, line: TextLine) {
  const candidates: FieldCandidate[] = [];

  line.locations.forEach((location, locationIndex) => {
    const adjacentLabelText = normalizeDisplayText(
      [location.text, line.locations[locationIndex + 1]?.text].filter(Boolean).join(' '),
    );
    const adjacentFieldDefinition = getCanonicalFieldDefinition(adjacentLabelText);
    const singleFieldDefinition = getCanonicalFieldDefinition(location.text);
    const fieldDefinition = adjacentFieldDefinition ?? singleFieldDefinition;
    const valueStartIndex = adjacentFieldDefinition === undefined ? locationIndex + 1 : locationIndex + 2;

    if (fieldDefinition === undefined || valueStartIndex >= line.locations.length) {
      return;
    }

    const valueLocations = getValueLocationsAfterLabel(fieldDefinition, line.locations, valueStartIndex);

    if (valueLocations.length === 0) {
      return;
    }

    addFieldCandidate(candidates, {
      key: fieldDefinition.key,
      label: fieldDefinition.label,
      value: valueLocations.map((valueLocation) => valueLocation.text).join(' '),
      pageNumber: page.pageNumber,
      sourceText: line.text,
      locations: valueLocations,
    });
  });

  return candidates;
}

function getHeaderColumns(headerLine: TextLine) {
  const columns: { fieldDefinition: FieldDefinition; x: number }[] = [];

  headerLine.locations.forEach((location, locationIndex) => {
    const adjacentLabelText = normalizeDisplayText(
      [location.text, headerLine.locations[locationIndex + 1]?.text].filter(Boolean).join(' '),
    );
    const fieldDefinition =
      getCanonicalFieldDefinition(adjacentLabelText) ?? getCanonicalFieldDefinition(location.text);

    if (fieldDefinition === undefined) {
      return;
    }

    columns.push({
      fieldDefinition,
      x: location.x + location.width / 2,
    });
  });

  return columns;
}

function isLikelyValueLocation(location: PdfTextLocation) {
  return createComparisonKey(location.text).length > 0;
}

function extractTableFieldCandidates(page: ExtractedPdfPage, lines: TextLine[]) {
  const candidates: FieldCandidate[] = [];

  lines.forEach((line, lineIndex) => {
    const columns = getHeaderColumns(line);

    if (columns.length < 2) {
      return;
    }

    const valueLines = lines.slice(lineIndex + 1, lineIndex + 4).filter((valueLine) => valueLine.y < line.y);

    valueLines.forEach((valueLine) => {
      valueLine.locations.filter(isLikelyValueLocation).forEach((location) => {
        const locationCenterX = location.x + location.width / 2;
        const nearestColumn = columns.reduce((nearest, column) => {
          const nearestDistance = Math.abs(nearest.x - locationCenterX);
          const columnDistance = Math.abs(column.x - locationCenterX);

          return columnDistance < nearestDistance ? column : nearest;
        }, columns[0]);

        if (Math.abs(nearestColumn.x - locationCenterX) > page.pageWidth * 0.18) {
          return;
        }

        addFieldCandidate(candidates, {
          key: nearestColumn.fieldDefinition.key,
          label: nearestColumn.fieldDefinition.label,
          value: location.text,
          pageNumber: page.pageNumber,
          sourceText: valueLine.text,
          locations: [location],
        });
      });
    });
  });

  return candidates;
}

function mergeFieldCandidate(fieldsByKey: Map<string, ExtractedField>, candidate: FieldCandidate) {
  const normalizedValue = normalizeFieldValue(candidate.value);

  if (normalizedValue.length === 0) {
    return;
  }

  const existingField = fieldsByKey.get(candidate.key);

  if (existingField === undefined) {
    fieldsByKey.set(candidate.key, {
      key: candidate.key,
      label: candidate.label,
      values: [candidate.value],
      normalizedValues: [normalizedValue],
      pageNumber: candidate.pageNumber,
      sourceText: candidate.sourceText,
      locations: candidate.locations,
    });
    return;
  }

  if (existingField.normalizedValues.includes(normalizedValue)) {
    return;
  }

  existingField.values.push(candidate.value);
  existingField.normalizedValues.push(normalizedValue);
  existingField.sourceText = `${existingField.sourceText} ${candidate.sourceText}`;
  existingField.locations = dedupeLocations([...existingField.locations, ...candidate.locations]);
}

function extractStructuredFields(pages: ExtractedPdfPage[]) {
  const fieldsByKey = new Map<string, ExtractedField>();

  pages.forEach((page) => {
    const lines = groupLocationsIntoLines(page);
    const candidates = [
      ...lines.flatMap((line) => extractInlineFieldCandidates(page, line)),
      ...lines.flatMap((line) => extractRowFieldCandidates(page, line)),
      ...extractTableFieldCandidates(page, lines),
    ];

    candidates.forEach((candidate) => mergeFieldCandidate(fieldsByKey, candidate));
  });

  return fieldsByKey;
}

function getFieldDisplayValue(field: ExtractedField | undefined) {
  return field?.values.join(' | ');
}

function doFieldValuesMatch(fieldA: ExtractedField | undefined, fieldB: ExtractedField | undefined) {
  if (fieldA === undefined || fieldB === undefined) {
    return fieldA === fieldB;
  }

  if (fieldA.normalizedValues.length !== fieldB.normalizedValues.length) {
    return false;
  }

  const valuesB = new Set(fieldB.normalizedValues);

  return fieldA.normalizedValues.every((value) => valuesB.has(value));
}

function createFieldDifference(
  id: number,
  fieldKey: string,
  fieldA: ExtractedField | undefined,
  fieldB: ExtractedField | undefined,
): Difference {
  const fieldLabel = fieldA?.label ?? fieldB?.label ?? fieldKey;
  const valueA = getFieldDisplayValue(fieldA);
  const valueB = getFieldDisplayValue(fieldB);

  if (fieldA === undefined) {
    return {
      id: `field-${id}-${fieldKey}-added`,
      type: 'added',
      isFieldDifference: true,
      fieldKey,
      fieldLabel,
      pageB: fieldB?.pageNumber,
      textAfter: valueB,
      changedTextAfter: valueB,
      afterLocations: fieldB?.locations,
      afterParts: valueB === undefined ? undefined : [{ type: 'added', text: valueB }],
      inlineParts: valueB === undefined ? undefined : [{ type: 'added', text: valueB }],
    };
  }

  if (fieldB === undefined) {
    return {
      id: `field-${id}-${fieldKey}-deleted`,
      type: 'deleted',
      isFieldDifference: true,
      fieldKey,
      fieldLabel,
      pageA: fieldA.pageNumber,
      textBefore: valueA,
      changedTextBefore: valueA,
      beforeLocations: fieldA.locations,
      beforeParts: valueA === undefined ? undefined : [{ type: 'deleted', text: valueA }],
      inlineParts: valueA === undefined ? undefined : [{ type: 'deleted', text: valueA }],
    };
  }

  return {
    id: `field-${id}-${fieldKey}-modified`,
    type: 'modified',
    isFieldDifference: true,
    fieldKey,
    fieldLabel,
    pageA: fieldA.pageNumber,
    pageB: fieldB.pageNumber,
    textBefore: valueA,
    textAfter: valueB,
    changedTextBefore: valueA,
    changedTextAfter: valueB,
    beforeLocations: fieldA.locations,
    afterLocations: fieldB.locations,
    beforeParts: valueA === undefined ? undefined : [{ type: 'deleted', text: valueA }],
    afterParts: valueB === undefined ? undefined : [{ type: 'added', text: valueB }],
    inlineParts: [
      ...(valueA === undefined ? [] : [{ type: 'deleted' as const, text: valueA }]),
      ...(valueB === undefined ? [] : [{ type: 'added' as const, text: valueB }]),
    ],
  };
}

function compareStructuredFields(
  fieldsA: Map<string, ExtractedField>,
  fieldsB: Map<string, ExtractedField>,
) {
  const fieldDifferences: Difference[] = [];
  const fieldKeys = new Set([...fieldsA.keys(), ...fieldsB.keys()]);

  fieldKeys.forEach((fieldKey) => {
    const fieldA = fieldsA.get(fieldKey);
    const fieldB = fieldsB.get(fieldKey);

    if (doFieldValuesMatch(fieldA, fieldB)) {
      return;
    }

    fieldDifferences.push(createFieldDifference(fieldDifferences.length + 1, fieldKey, fieldA, fieldB));
  });

  return fieldDifferences;
}

function removeFieldSourcesFromPages(pages: ExtractedPdfPage[], fields: Map<string, ExtractedField>) {
  const fieldLocationKeys = new Set(
    [...fields.values()].flatMap((field) => field.locations.map((location) => getLocationIdentity(location))),
  );

  return pages.map((page) => {
    const pageFields = [...fields.values()].filter((field) => field.pageNumber === page.pageNumber);
    let text = page.text;

    pageFields.forEach((field) => {
      text = text.replace(field.sourceText, ' ');
    });

    return {
      ...page,
      text: normalizeDisplayText(text),
      locations: page.locations.filter((location) => !fieldLocationKeys.has(getLocationIdentity(location))),
    };
  });
}

function splitIntoBlocks(text: string): string[] {
  const normalized = normalizeDisplayText(text);

  if (normalized.length === 0) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?;:]+(?:[.!?;:]+["')\]]*)?/g) ?? [normalized];

  return sentenceMatches.map((block) => normalizeDisplayText(block)).filter(Boolean);
}

function hasCellLikeSpacing(line: TextLine) {
  if (line.locations.length < 3) {
    return false;
  }

  return line.locations.some((location, locationIndex) => {
    const nextLocation = line.locations[locationIndex + 1];

    if (nextLocation === undefined) {
      return false;
    }

    return nextLocation.x - (location.x + location.width) > 18;
  });
}

function splitLineIntoBlockUnits(line: TextLine): BlockUnit[] {
  if (hasCellLikeSpacing(line)) {
    return line.locations
      .map((location) => ({
        text: normalizeDisplayText(location.text),
        locations: [location],
      }))
      .filter((unit) => unit.text.length > 0);
  }

  return splitIntoBlocks(line.text).map((text) => ({
    text,
    locations: findLocationsForText(line.locations, text),
  }));
}

function createBlocks(pages: ExtractedPdfPage[]) {
  return pages.flatMap((page) =>
    groupLocationsIntoLines(page)
      .flatMap(splitLineIntoBlockUnits)
      .map((unit) => {
        const key = createComparisonKey(unit.text);

        return {
          pageNumber: page.pageNumber,
          text: unit.text,
          key,
          tokens: tokenizeKey(key),
          locations: unit.locations,
        };
      })
      .filter((block) => isMeaningfulKey(block.key)),
  );
}

function buildLcsTable(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const table = Array.from({ length: blocksA.length + 1 }, () =>
    Array.from({ length: blocksB.length + 1 }, () => 0),
  );

  for (let indexA = blocksA.length - 1; indexA >= 0; indexA -= 1) {
    for (let indexB = blocksB.length - 1; indexB >= 0; indexB -= 1) {
      if (blocksA[indexA].key === blocksB[indexB].key) {
        table[indexA][indexB] = table[indexA + 1][indexB + 1] + 1;
      } else {
        table[indexA][indexB] = Math.max(table[indexA + 1][indexB], table[indexA][indexB + 1]);
      }
    }
  }

  return table;
}

function diffBlocks(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const operations: DiffOperation[] = [];
  const lcsTable = buildLcsTable(blocksA, blocksB);
  let indexA = 0;
  let indexB = 0;

  while (indexA < blocksA.length && indexB < blocksB.length) {
    if (blocksA[indexA].key === blocksB[indexB].key) {
      operations.push({
        type: 'equal',
        blockA: blocksA[indexA],
        blockB: blocksB[indexB],
      });
      indexA += 1;
      indexB += 1;
    } else if (lcsTable[indexA + 1][indexB] >= lcsTable[indexA][indexB + 1]) {
      operations.push({
        type: 'delete',
        block: blocksA[indexA],
      });
      indexA += 1;
    } else {
      operations.push({
        type: 'add',
        block: blocksB[indexB],
      });
      indexB += 1;
    }
  }

  while (indexA < blocksA.length) {
    operations.push({
      type: 'delete',
      block: blocksA[indexA],
    });
    indexA += 1;
  }

  while (indexB < blocksB.length) {
    operations.push({
      type: 'add',
      block: blocksB[indexB],
    });
    indexB += 1;
  }

  return operations;
}

function getTokenSimilarity(blocksA: TextBlock[], blocksB: TextBlock[]) {
  const tokensA = new Set(blocksA.flatMap((block) => block.tokens));
  const tokensB = new Set(blocksB.flatMap((block) => block.tokens));

  if (tokensA.size === 0 || tokensB.size === 0) {
    return 0;
  }

  let overlap = 0;
  tokensA.forEach((token) => {
    if (tokensB.has(token)) {
      overlap += 1;
    }
  });

  return (2 * overlap) / (tokensA.size + tokensB.size);
}

function joinBlockText(blocks: TextBlock[]) {
  return blocks.map((block) => block.text).join(' ');
}

function joinBlockLocations(blocks: TextBlock[]) {
  return dedupeLocations(blocks.flatMap((block) => block.locations));
}

function tokenizeText(text: string) {
  return normalizeDisplayText(text).match(/\S+/g) ?? [];
}

function getWordKey(word: string) {
  return word
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

function buildWordLcsTable(wordsA: string[], wordsB: string[]) {
  const table = Array.from({ length: wordsA.length + 1 }, () =>
    Array.from({ length: wordsB.length + 1 }, () => 0),
  );

  for (let indexA = wordsA.length - 1; indexA >= 0; indexA -= 1) {
    for (let indexB = wordsB.length - 1; indexB >= 0; indexB -= 1) {
      if (getWordKey(wordsA[indexA]) === getWordKey(wordsB[indexB])) {
        table[indexA][indexB] = table[indexA + 1][indexB + 1] + 1;
      } else {
        table[indexA][indexB] = Math.max(table[indexA + 1][indexB], table[indexA][indexB + 1]);
      }
    }
  }

  return table;
}

function appendPart(parts: DifferenceTextPart[], part: DifferenceTextPart) {
  if (part.text.length === 0) {
    return;
  }

  const previousPart = parts[parts.length - 1];

  if (previousPart?.type === part.type) {
    previousPart.text = `${previousPart.text} ${part.text}`;
  } else {
    parts.push(part);
  }
}

function getChangedText(parts: DifferenceTextPart[], type: DifferenceTextPart['type']) {
  return parts
    .filter((part) => part.type === type)
    .map((part) => part.text)
    .join(' ')
    .trim();
}

function createWordLevelDiff(textBefore: string, textAfter: string) {
  const wordsBefore = tokenizeText(textBefore);
  const wordsAfter = tokenizeText(textAfter);
  const lcsTable = buildWordLcsTable(wordsBefore, wordsAfter);
  const beforeParts: DifferenceTextPart[] = [];
  const afterParts: DifferenceTextPart[] = [];
  const inlineParts: DifferenceTextPart[] = [];
  let indexBefore = 0;
  let indexAfter = 0;

  while (indexBefore < wordsBefore.length && indexAfter < wordsAfter.length) {
    if (getWordKey(wordsBefore[indexBefore]) === getWordKey(wordsAfter[indexAfter])) {
      appendPart(beforeParts, { type: 'unchanged', text: wordsBefore[indexBefore] });
      appendPart(afterParts, { type: 'unchanged', text: wordsAfter[indexAfter] });
      appendPart(inlineParts, { type: 'unchanged', text: wordsAfter[indexAfter] });
      indexBefore += 1;
      indexAfter += 1;
    } else if (lcsTable[indexBefore + 1][indexAfter] >= lcsTable[indexBefore][indexAfter + 1]) {
      appendPart(beforeParts, { type: 'deleted', text: wordsBefore[indexBefore] });
      appendPart(inlineParts, { type: 'deleted', text: wordsBefore[indexBefore] });
      indexBefore += 1;
    } else {
      appendPart(afterParts, { type: 'added', text: wordsAfter[indexAfter] });
      appendPart(inlineParts, { type: 'added', text: wordsAfter[indexAfter] });
      indexAfter += 1;
    }
  }

  while (indexBefore < wordsBefore.length) {
    appendPart(beforeParts, { type: 'deleted', text: wordsBefore[indexBefore] });
    appendPart(inlineParts, { type: 'deleted', text: wordsBefore[indexBefore] });
    indexBefore += 1;
  }

  while (indexAfter < wordsAfter.length) {
    appendPart(afterParts, { type: 'added', text: wordsAfter[indexAfter] });
    appendPart(inlineParts, { type: 'added', text: wordsAfter[indexAfter] });
    indexAfter += 1;
  }

  return {
    beforeParts,
    afterParts,
    inlineParts,
    changedTextBefore: getChangedText(beforeParts, 'deleted'),
    changedTextAfter: getChangedText(afterParts, 'added'),
  };
}

function getFirstPage(blocks: TextBlock[]) {
  return blocks[0]?.pageNumber;
}

function createAddedDifference(id: number, blocks: TextBlock[]): Difference {
  return {
    id: `difference-${id}-added`,
    type: 'added',
    pageB: getFirstPage(blocks),
    textAfter: joinBlockText(blocks),
    changedTextAfter: joinBlockText(blocks),
    afterLocations: joinBlockLocations(blocks),
  };
}

function createDeletedDifference(id: number, blocks: TextBlock[]): Difference {
  return {
    id: `difference-${id}-deleted`,
    type: 'deleted',
    pageA: getFirstPage(blocks),
    textBefore: joinBlockText(blocks),
    changedTextBefore: joinBlockText(blocks),
    beforeLocations: joinBlockLocations(blocks),
  };
}

function createModifiedDifference(
  id: number,
  deletedBlocks: TextBlock[],
  addedBlocks: TextBlock[],
): Difference {
  const textBefore = joinBlockText(deletedBlocks);
  const textAfter = joinBlockText(addedBlocks);
  const wordDiff = createWordLevelDiff(textBefore, textAfter);
  const deletedLocations = joinBlockLocations(deletedBlocks);
  const addedLocations = joinBlockLocations(addedBlocks);
  const beforeLocations = findLocationsForText(deletedLocations, wordDiff.changedTextBefore);
  const afterLocations = findLocationsForText(addedLocations, wordDiff.changedTextAfter);

  return {
    id: `difference-${id}-modified`,
    type: 'modified',
    pageA: getFirstPage(deletedBlocks),
    pageB: getFirstPage(addedBlocks),
    textBefore,
    textAfter,
    beforeLocations: beforeLocations.length > 0 ? beforeLocations : deletedLocations,
    afterLocations: afterLocations.length > 0 ? afterLocations : addedLocations,
    ...wordDiff,
  };
}

function pushMeaningfulChanges(
  differences: Difference[],
  deletedBlocks: TextBlock[],
  addedBlocks: TextBlock[],
) {
  if (deletedBlocks.length === 0 && addedBlocks.length === 0) {
    return;
  }

  const nextId = differences.length + 1;

  if (deletedBlocks.length === 0) {
    differences.push(createAddedDifference(nextId, addedBlocks));
    return;
  }

  if (addedBlocks.length === 0) {
    differences.push(createDeletedDifference(nextId, deletedBlocks));
    return;
  }

  if (getTokenSimilarity(deletedBlocks, addedBlocks) >= MODIFIED_SIMILARITY_THRESHOLD) {
    differences.push(createModifiedDifference(nextId, deletedBlocks, addedBlocks));
    return;
  }

  differences.push(createDeletedDifference(nextId, deletedBlocks));
  differences.push(createAddedDifference(nextId + 1, addedBlocks));
}

function getDifferenceText(difference: Difference) {
  return [
    difference.fieldLabel,
    difference.textBefore,
    difference.textAfter,
    difference.changedTextBefore,
    difference.changedTextAfter,
  ]
    .filter(Boolean)
    .join(' ');
}

function isEdgeLocation(location: PdfTextLocation, edge: 'top' | 'bottom', pageHeights: Map<number, number>) {
  const pageHeight = pageHeights.get(location.pageNumber) ?? Math.max(location.y + location.height, 1);
  const ratio = location.y / pageHeight;

  return edge === 'top' ? ratio >= 0.88 : ratio <= 0.12;
}

function hasOnlyEdgeLocations(
  difference: Difference,
  edge: 'top' | 'bottom',
  pageHeights: Map<number, number>,
) {
  const locations = [...(difference.beforeLocations ?? []), ...(difference.afterLocations ?? [])];

  return locations.length > 0 && locations.every((location) => isEdgeLocation(location, edge, pageHeights));
}

function getIgnoredReason(
  difference: Difference,
  settings: ComparisonSettings,
  pageHeights: Map<number, number>,
) {
  const text = getDifferenceText(difference);
  const key = createComparisonKey(text);
  const fieldKey = difference.fieldKey as ComparisonFieldKey | undefined;

  if (
    difference.isFieldDifference &&
    fieldKey !== undefined &&
    fieldKey in settings.importantFields &&
    !settings.importantFields[fieldKey]
  ) {
    return `${difference.fieldLabel ?? fieldKey} is not selected as an important field`;
  }

  if (settings.ignoreRules.pageNumbers && /^(?:page\s*)?\d+\s*(?:of|\/|-)\s*\d+$|^\d+$/i.test(text.trim())) {
    return 'Ignored page number';
  }

  if (
    settings.ignoreRules.printDates &&
    /\b(?:printed|print date)\b/i.test(text) &&
    /\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/.test(text)
  ) {
    return 'Ignored print date';
  }

  if (
    settings.ignoreRules.generatedDates &&
    /\b(?:generated|created|exported)\b/i.test(text) &&
    /\b\d{1,4}[/-]\d{1,2}[/-]\d{1,4}\b/.test(text)
  ) {
    return 'Ignored generated date';
  }

  if (settings.ignoreRules.headerText && hasOnlyEdgeLocations(difference, 'top', pageHeights)) {
    return 'Ignored header text';
  }

  if (settings.ignoreRules.footerText && hasOnlyEdgeLocations(difference, 'bottom', pageHeights)) {
    return 'Ignored footer text';
  }

  if (
    settings.ignoreRules.companyAddress &&
    /\b(?:address|street|road|avenue|suite|floor|unit|postal|zip|tel|phone|fax|email)\b/i.test(text)
  ) {
    return 'Ignored company address';
  }

  if (
    settings.ignoreRules.boilerplateTerms &&
    /\b(?:terms?|conditions?|standard approval workflow|confidential|all rights reserved|system generated|no signature required)\b/i.test(text)
  ) {
    return 'Ignored boilerplate terms';
  }

  if (key.length < MIN_MEANINGFUL_KEY_LENGTH) {
    return 'Ignored low-signal text';
  }

  return undefined;
}

function applyComparisonSettings(
  differences: Difference[],
  settings: ComparisonSettings,
  pageHeights: Map<number, number>,
): ComparisonResult {
  const visibleDifferences: Difference[] = [];
  const ignoredDifferences: Difference[] = [];

  differences.forEach((difference) => {
    const ignoredReason = getIgnoredReason(difference, settings, pageHeights);

    if (ignoredReason === undefined) {
      visibleDifferences.push(difference);
      return;
    }

    ignoredDifferences.push({
      ...difference,
      ignoredReason,
    });
  });

  return {
    differences: visibleDifferences,
    ignoredDifferences,
  };
}

export function generateComparisonResult(
  pdfAPages: ExtractedPdfPage[],
  pdfBPages: ExtractedPdfPage[],
  settings: ComparisonSettings = defaultComparisonSettings,
): ComparisonResult {
  const pageHeights = new Map(
    [...pdfAPages, ...pdfBPages].map((page) => [page.pageNumber, page.pageHeight] as const),
  );
  const fieldsA = extractStructuredFields(pdfAPages);
  const fieldsB = extractStructuredFields(pdfBPages);
  const fieldDifferences = compareStructuredFields(fieldsA, fieldsB);
  const filteredPdfAPages = removeFieldSourcesFromPages(pdfAPages, fieldsA);
  const filteredPdfBPages = removeFieldSourcesFromPages(pdfBPages, fieldsB);
  const blocksA = createBlocks(filteredPdfAPages);
  const blocksB = createBlocks(filteredPdfBPages);
  const operations = diffBlocks(blocksA, blocksB);
  const differences: Difference[] = [...fieldDifferences];
  let deletedBlocks: TextBlock[] = [];
  let addedBlocks: TextBlock[] = [];

  operations.forEach((operation) => {
    if (operation.type === 'equal') {
      pushMeaningfulChanges(differences, deletedBlocks, addedBlocks);
      deletedBlocks = [];
      addedBlocks = [];
      return;
    }

    if (operation.type === 'delete') {
      deletedBlocks.push(operation.block);
      return;
    }

    addedBlocks.push(operation.block);
  });

  pushMeaningfulChanges(differences, deletedBlocks, addedBlocks);

  return applyComparisonSettings(differences, settings, pageHeights);
}

export function generateDifferences(
  pdfAPages: ExtractedPdfPage[],
  pdfBPages: ExtractedPdfPage[],
): Difference[] {
  return generateComparisonResult(pdfAPages, pdfBPages).differences;
}
