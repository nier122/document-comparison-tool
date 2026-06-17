import type {
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
};

type ExtractedField = {
  key: string;
  label: string;
  value: string;
  normalizedValue: string;
  pageNumber: number;
  sourceText: string;
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
const FIELD_DEFINITIONS: FieldDefinition[] = [
  {
    key: 'poNumber',
    label: 'PO Number',
    labelPattern: String.raw`(?:P\.?\s*O\.?|PO|Purchase\s+Order)\s*(?:No\.?|Number)?`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9./-]*`,
  },
  {
    key: 'invoiceNumber',
    label: 'Invoice Number',
    labelPattern: String.raw`Invoice\s*(?:No\.?|Number)?`,
    valuePattern: String.raw`[A-Z0-9][A-Z0-9./-]*`,
  },
  {
    key: 'date',
    label: 'Date',
    labelPattern: String.raw`Date`,
    valuePattern: String.raw`(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[A-Z][a-z]{2,8}\s+\d{1,2},?\s+\d{4})`,
  },
  {
    key: 'amount',
    label: 'Amount',
    labelPattern: String.raw`Amount`,
    valuePattern: String.raw`(?:[$\u20ac\u00a3]\s*)?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?`,
  },
  {
    key: 'total',
    label: 'Total',
    labelPattern: String.raw`(?:Grand\s+)?Total`,
    valuePattern: String.raw`(?:[$\u20ac\u00a3]\s*)?-?\d{1,3}(?:,\d{3})*(?:\.\d+)?|-?\d+(?:\.\d+)?`,
  },
  {
    key: 'quantity',
    label: 'Quantity',
    labelPattern: String.raw`(?:Qty\.?|Quantity)`,
    valuePattern: String.raw`-?\d+(?:\.\d+)?`,
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
    const key = [
      location.pageNumber,
      Math.round(location.x * 100) / 100,
      Math.round(location.y * 100) / 100,
      location.text,
    ].join('|');

    if (seenLocations.has(key)) {
      return;
    }

    seenLocations.add(key);
    uniqueLocations.push(location);
  });

  return uniqueLocations;
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

function extractStructuredFields(pages: ExtractedPdfPage[]) {
  const fieldsByKey = new Map<string, ExtractedField>();

  pages.forEach((page) => {
    FIELD_DEFINITIONS.forEach((fieldDefinition) => {
      const pattern = getFieldPattern(fieldDefinition);
      let match: RegExpExecArray | null;

      while ((match = pattern.exec(page.text)) !== null) {
        const sourceText = normalizeDisplayText(match[0]);
        const value = normalizeDisplayText(match[2] ?? '');

        if (value.length === 0) {
          continue;
        }

        const existingField = fieldsByKey.get(fieldDefinition.key);

        if (existingField !== undefined) {
          continue;
        }

        fieldsByKey.set(fieldDefinition.key, {
          key: fieldDefinition.key,
          label: fieldDefinition.label,
          value,
          normalizedValue: normalizeFieldValue(value),
          pageNumber: page.pageNumber,
          sourceText,
          locations: findLocationsForText(page.locations, value),
        });
      }
    });
  });

  return fieldsByKey;
}

function createFieldDifference(
  id: number,
  fieldKey: string,
  fieldA: ExtractedField | undefined,
  fieldB: ExtractedField | undefined,
): Difference {
  const fieldLabel = fieldA?.label ?? fieldB?.label ?? fieldKey;

  if (fieldA === undefined) {
    return {
      id: `field-${id}-${fieldKey}-added`,
      type: 'added',
      isFieldDifference: true,
      fieldKey,
      fieldLabel,
      pageB: fieldB?.pageNumber,
      textAfter: fieldB?.value,
      changedTextAfter: fieldB?.value,
      afterLocations: fieldB?.locations,
      afterParts: fieldB === undefined ? undefined : [{ type: 'added', text: fieldB.value }],
      inlineParts: fieldB === undefined ? undefined : [{ type: 'added', text: fieldB.value }],
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
      textBefore: fieldA.value,
      changedTextBefore: fieldA.value,
      beforeLocations: fieldA.locations,
      beforeParts: [{ type: 'deleted', text: fieldA.value }],
      inlineParts: [{ type: 'deleted', text: fieldA.value }],
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
    textBefore: fieldA.value,
    textAfter: fieldB.value,
    changedTextBefore: fieldA.value,
    changedTextAfter: fieldB.value,
    beforeLocations: fieldA.locations,
    afterLocations: fieldB.locations,
    beforeParts: [{ type: 'deleted', text: fieldA.value }],
    afterParts: [{ type: 'added', text: fieldB.value }],
    inlineParts: [
      { type: 'deleted', text: fieldA.value },
      { type: 'added', text: fieldB.value },
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

    if (fieldA?.normalizedValue === fieldB?.normalizedValue) {
      return;
    }

    fieldDifferences.push(createFieldDifference(fieldDifferences.length + 1, fieldKey, fieldA, fieldB));
  });

  return fieldDifferences;
}

function removeFieldSourcesFromPages(pages: ExtractedPdfPage[], fields: Map<string, ExtractedField>) {
  return pages.map((page) => {
    const pageFields = [...fields.values()].filter((field) => field.pageNumber === page.pageNumber);
    let text = page.text;

    pageFields.forEach((field) => {
      text = text.replace(field.sourceText, ' ');
    });

    return {
      ...page,
      text: normalizeDisplayText(text),
    };
  });
}

function splitIntoBlocks(text: string) {
  const normalized = normalizeDisplayText(text);

  if (normalized.length === 0) {
    return [];
  }

  const sentenceMatches = normalized.match(/[^.!?;:]+(?:[.!?;:]+["')\]]*)?/g) ?? [normalized];

  return sentenceMatches.map((block) => normalizeDisplayText(block)).filter(Boolean);
}

function createBlocks(pages: ExtractedPdfPage[]) {
  return pages.flatMap((page) =>
    splitIntoBlocks(page.text)
      .map((text) => {
        const key = createComparisonKey(text);

        return {
          pageNumber: page.pageNumber,
          text,
          key,
          tokens: tokenizeKey(key),
          locations: findLocationsForText(page.locations, text),
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

export function generateDifferences(
  pdfAPages: ExtractedPdfPage[],
  pdfBPages: ExtractedPdfPage[],
): Difference[] {
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

  return differences;
}
