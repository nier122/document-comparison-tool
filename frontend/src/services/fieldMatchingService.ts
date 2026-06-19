export type SemanticField = {
  key: string;
  label: string;
  aliases: string[];
  values: string[];
};

export type FieldMatchConfidenceLevel = 'high' | 'medium' | 'low';

export type SemanticFieldMatch = {
  fieldA: SemanticField;
  fieldB: SemanticField;
  canonicalKey: string;
  canonicalLabel: string;
  confidence: number;
  confidenceLevel: FieldMatchConfidenceLevel;
  labelScore: number;
  valueFormatScore: number;
};

type ValueFormat =
  | 'empty'
  | 'date'
  | 'currency'
  | 'number'
  | 'identifier'
  | 'company'
  | 'long-description'
  | 'text';

type CanonicalFieldDefinition = {
  key: string;
  label: string;
  aliases: string[];
  expectedFormats: ValueFormat[];
};

type CanonicalField = {
  key: string;
  label: string;
  score: number;
};

type ScoredFieldMatch = SemanticFieldMatch & {
  isCanonicalMatch: boolean;
};

const MIN_CONFIDENT_LABEL_SCORE = 0.7;
const MIN_POSSIBLE_LABEL_SCORE = 0.54;
const MIN_CONFIDENT_MATCH_SCORE = 0.78;
const MIN_POSSIBLE_MATCH_SCORE = 0.66;
const MIN_CANDIDATE_MARGIN = 0.07;

const LABEL_TOKEN_EQUIVALENTS: Record<string, string[]> = {
  amt: ['amount'],
  bill: ['customer'],
  buyer: ['customer'],
  desc: ['description'],
  each: ['unit'],
  ext: ['extended'],
  inv: ['invoice'],
  no: ['number'],
  num: ['number'],
  nbr: ['number'],
  po: ['purchase', 'order'],
  product: ['item'],
  qty: ['quantity'],
  rate: ['price'],
  seller: ['supplier'],
  sku: ['item', 'code'],
  vendor: ['supplier'],
};

const CANONICAL_FIELDS: CanonicalFieldDefinition[] = [
  {
    key: 'poNumber',
    label: 'PO Number',
    aliases: [
      'po',
      'po no',
      'po number',
      'purchase order',
      'purchase order no',
      'purchase order number',
      'order no',
      'order number',
    ],
    expectedFormats: ['identifier', 'number'],
  },
  {
    key: 'invoiceNumber',
    label: 'Invoice Number',
    aliases: ['invoice', 'invoice no', 'invoice number', 'inv no', 'inv number'],
    expectedFormats: ['identifier', 'number'],
  },
  {
    key: 'quantity',
    label: 'Quantity',
    aliases: ['qty', 'quantity', 'ordered quantity'],
    expectedFormats: ['number'],
  },
  {
    key: 'supplier',
    label: 'Supplier',
    aliases: ['supplier', 'supplier name', 'vendor', 'vendor name', 'seller', 'ship from'],
    expectedFormats: ['company', 'text'],
  },
  {
    key: 'customer',
    label: 'Customer',
    aliases: ['customer', 'customer name', 'buyer', 'buyer name', 'bill to'],
    expectedFormats: ['company', 'text'],
  },
  {
    key: 'date',
    label: 'Date',
    aliases: ['date', 'order date', 'invoice date', 'document date'],
    expectedFormats: ['date'],
  },
  {
    key: 'amount',
    label: 'Amount',
    aliases: ['amount', 'amt', 'net amount'],
    expectedFormats: ['currency', 'number'],
  },
  {
    key: 'total',
    label: 'Total',
    aliases: ['total', 'grand total', 'net total', 'order total'],
    expectedFormats: ['currency', 'number'],
  },
  {
    key: 'unitPrice',
    label: 'Unit Price',
    aliases: ['unit price', 'price per unit', 'unit rate', 'rate'],
    expectedFormats: ['currency', 'number'],
  },
  {
    key: 'lineTotal',
    label: 'Line Total',
    aliases: ['line total', 'extended amount', 'ext amount'],
    expectedFormats: ['currency', 'number'],
  },
  {
    key: 'itemCode',
    label: 'Item Code',
    aliases: ['item code', 'item no', 'item number', 'sku', 'part code', 'part no', 'part number'],
    expectedFormats: ['identifier'],
  },
  {
    key: 'itemDescription',
    label: 'Item Description',
    aliases: ['item description', 'description', 'material', 'service description', 'product description'],
    expectedFormats: ['long-description', 'text'],
  },
  {
    key: 'remarks',
    label: 'Remarks',
    aliases: ['remark', 'remarks', 'note', 'notes', 'comment', 'comments'],
    expectedFormats: ['long-description', 'text'],
  },
];

function clampScore(score: number) {
  return Math.max(0, Math.min(1, score));
}

function normalizeText(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSemanticTokens(text: string) {
  const tokens = normalizeText(text).split(' ').filter(Boolean);

  return new Set(tokens.flatMap((token) => LABEL_TOKEN_EQUIVALENTS[token] ?? [token]));
}

function getSetSimilarity(valuesA: Set<string>, valuesB: Set<string>) {
  if (valuesA.size === 0 || valuesB.size === 0) {
    return 0;
  }

  const intersectionSize = [...valuesA].filter((value) => valuesB.has(value)).length;

  return (2 * intersectionSize) / (valuesA.size + valuesB.size);
}

function getCharacterBigrams(text: string) {
  const normalized = normalizeText(text).replace(/\s/g, '');
  const bigrams = new Set<string>();

  if (normalized.length === 1) {
    bigrams.add(normalized);
  }

  for (let index = 0; index < normalized.length - 1; index += 1) {
    bigrams.add(normalized.slice(index, index + 2));
  }

  return bigrams;
}

function getTextSimilarity(textA: string, textB: string) {
  const normalizedA = normalizeText(textA);
  const normalizedB = normalizeText(textB);

  if (normalizedA.length === 0 || normalizedB.length === 0) {
    return 0;
  }

  if (normalizedA === normalizedB) {
    return 1;
  }

  const tokenScore = getSetSimilarity(getSemanticTokens(textA), getSemanticTokens(textB));
  const characterScore = getSetSimilarity(getCharacterBigrams(textA), getCharacterBigrams(textB));

  return clampScore(tokenScore * 0.82 + characterScore * 0.18);
}

function getCanonicalField(field: SemanticField): CanonicalField | undefined {
  const labels = [field.label, ...field.aliases];
  const candidates = CANONICAL_FIELDS.map((definition) => ({
    key: definition.key,
    label: definition.label,
    score:
      field.key === definition.key
        ? 1
        : Math.max(
            ...labels.flatMap((label) =>
              [definition.label, ...definition.aliases].map((alias) =>
                getTextSimilarity(label, alias),
              ),
            ),
          ),
  })).sort((candidateA, candidateB) => candidateB.score - candidateA.score);
  const bestCandidate = candidates[0];
  const secondCandidate = candidates[1];

  if (
    bestCandidate === undefined ||
    bestCandidate.score < 0.72 ||
    (bestCandidate.score < 1 &&
      secondCandidate !== undefined &&
      bestCandidate.score - secondCandidate.score < 0.08)
  ) {
    return undefined;
  }

  return bestCandidate;
}

function getValueFormat(value: string): ValueFormat {
  const normalized = value.trim();

  if (normalized.length === 0) {
    return 'empty';
  }

  if (
    /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2}|[a-z]{3,9}\s+\d{1,2},?\s+\d{4})$/i.test(
      normalized,
    )
  ) {
    return 'date';
  }

  if (
    /^(?:(?:SGD|USD|EUR|GBP|AUD|CAD|JPY|CNY|RMB|MYR)\s*|[$\u20ac\u00a3]\s*)-?\d[\d,]*(?:\.\d+)?$/i.test(
      normalized,
    )
  ) {
    return 'currency';
  }

  if (/^-?\d[\d,]*(?:\.\d+)?$/.test(normalized)) {
    return 'number';
  }

  if (/\b(?:ltd|limited|llc|inc|corp|corporation|company|co\.?|pte|plc|gmbh|sdn|bhd)\b/i.test(normalized)) {
    return 'company';
  }

  if (/^[a-z0-9][a-z0-9._/#-]*$/i.test(normalized) && /\d/.test(normalized)) {
    return 'identifier';
  }

  if (normalized.length >= 48 || normalized.split(/\s+/).length >= 8) {
    return 'long-description';
  }

  return 'text';
}

function getFieldFormats(field: SemanticField) {
  return new Set(field.values.map(getValueFormat).filter((format) => format !== 'empty'));
}

function getExpectedFormats(canonicalField: CanonicalField | undefined) {
  return new Set(
    CANONICAL_FIELDS.find((definition) => definition.key === canonicalField?.key)
      ?.expectedFormats ?? [],
  );
}

function getFormatCompatibility(formatA: ValueFormat, formatB: ValueFormat) {
  if (formatA === formatB) {
    return 1;
  }

  const numericFormats = new Set<ValueFormat>(['currency', 'number']);

  if (numericFormats.has(formatA) && numericFormats.has(formatB)) {
    return 0.72;
  }

  if (
    (formatA === 'identifier' && formatB === 'number') ||
    (formatA === 'number' && formatB === 'identifier')
  ) {
    return 0.78;
  }

  const proseFormats = new Set<ValueFormat>(['company', 'long-description', 'text']);

  if (proseFormats.has(formatA) && proseFormats.has(formatB)) {
    return formatA === 'company' || formatB === 'company' ? 0.82 : 0.72;
  }

  return 0;
}

function getValueFormatSimilarity(
  fieldA: SemanticField,
  fieldB: SemanticField,
  canonicalA: CanonicalField | undefined,
  canonicalB: CanonicalField | undefined,
) {
  const formatsA = getFieldFormats(fieldA);
  const formatsB = getFieldFormats(fieldB);

  if (formatsA.size === 0 || formatsB.size === 0) {
    return 0.5;
  }

  const pairScore = Math.max(
    ...[...formatsA].flatMap((formatA) =>
      [...formatsB].map((formatB) => getFormatCompatibility(formatA, formatB)),
    ),
  );
  const expectedFormats = new Set([
    ...getExpectedFormats(canonicalA),
    ...getExpectedFormats(canonicalB),
  ]);

  if (expectedFormats.size === 0) {
    return pairScore;
  }

  const fitsExpectedFormat = [...formatsA, ...formatsB].every((format) =>
    [...expectedFormats].some(
      (expectedFormat) => getFormatCompatibility(format, expectedFormat) > 0,
    ),
  );

  return fitsExpectedFormat ? pairScore : pairScore * 0.45;
}

function getNormalizedValue(value: string) {
  return normalizeText(value)
    .replace(/\b(?:sgd|usd|eur|gbp|aud|cad|jpy|cny|rmb|myr)\b/g, '')
    .replace(/[$\u20ac\u00a3,\s]/g, '');
}

function getValueSimilarity(fieldA: SemanticField, fieldB: SemanticField) {
  if (fieldA.values.length === 0 || fieldB.values.length === 0) {
    return 0;
  }

  return Math.max(
    ...fieldA.values.flatMap((valueA) =>
      fieldB.values.map((valueB) => {
        if (getNormalizedValue(valueA) === getNormalizedValue(valueB)) {
          return 1;
        }

        return getTextSimilarity(valueA, valueB);
      }),
    ),
  );
}

function getLabelSimilarity(
  fieldA: SemanticField,
  fieldB: SemanticField,
  canonicalA: CanonicalField | undefined,
  canonicalB: CanonicalField | undefined,
) {
  if (fieldA.key === fieldB.key) {
    return 1;
  }

  if (canonicalA !== undefined && canonicalA.key === canonicalB?.key) {
    return Math.max(0.9, Math.min(canonicalA.score, canonicalB.score));
  }

  return Math.max(
    ...[fieldA.label, ...fieldA.aliases].flatMap((labelA) =>
      [fieldB.label, ...fieldB.aliases].map((labelB) => getTextSimilarity(labelA, labelB)),
    ),
  );
}

function getConfidenceLevel(
  confidence: number,
  isCanonicalMatch: boolean,
): FieldMatchConfidenceLevel {
  if (isCanonicalMatch && confidence >= 0.84) {
    return 'high';
  }

  if (confidence >= MIN_CONFIDENT_MATCH_SCORE) {
    return 'medium';
  }

  return 'low';
}

function scoreFieldMatch(fieldA: SemanticField, fieldB: SemanticField): ScoredFieldMatch | null {
  const canonicalA = getCanonicalField(fieldA);
  const canonicalB = getCanonicalField(fieldB);
  const hasCanonicalConflict =
    canonicalA !== undefined &&
    canonicalB !== undefined &&
    canonicalA.key !== canonicalB.key;

  if (hasCanonicalConflict) {
    return null;
  }

  const isCanonicalMatch =
    fieldA.key === fieldB.key ||
    (canonicalA !== undefined && canonicalA.key === canonicalB?.key);
  const labelScore = getLabelSimilarity(fieldA, fieldB, canonicalA, canonicalB);
  const valueFormatScore = getValueFormatSimilarity(fieldA, fieldB, canonicalA, canonicalB);
  const valueScore = getValueSimilarity(fieldA, fieldB);

  if (
    valueFormatScore === 0 ||
    (!isCanonicalMatch && labelScore < MIN_POSSIBLE_LABEL_SCORE)
  ) {
    return null;
  }

  const confidence = clampScore(
    labelScore * 0.72 + valueFormatScore * 0.23 + valueScore * 0.05,
  );
  const canonicalKey = canonicalA?.key ?? canonicalB?.key ?? fieldA.key;
  const canonicalLabel = canonicalA?.label ?? canonicalB?.label ?? fieldA.label;

  return {
    fieldA,
    fieldB,
    canonicalKey,
    canonicalLabel,
    labelScore,
    valueFormatScore,
    confidence,
    confidenceLevel: getConfidenceLevel(confidence, isCanonicalMatch),
    isCanonicalMatch,
  };
}

function hasClearCandidateMargin(
  candidate: ScoredFieldMatch,
  candidates: ScoredFieldMatch[],
  side: 'A' | 'B',
) {
  if (candidate.isCanonicalMatch) {
    return true;
  }

  const competingScores = candidates
    .filter((otherCandidate) =>
      side === 'A'
        ? otherCandidate.fieldA.key === candidate.fieldA.key &&
          otherCandidate.fieldB.key !== candidate.fieldB.key
        : otherCandidate.fieldB.key === candidate.fieldB.key &&
          otherCandidate.fieldA.key !== candidate.fieldA.key,
    )
    .map((otherCandidate) => otherCandidate.confidence);

  return candidate.confidence - Math.max(0, ...competingScores) >= MIN_CANDIDATE_MARGIN;
}

export function matchSemanticFields(
  fieldsA: SemanticField[],
  fieldsB: SemanticField[],
): SemanticFieldMatch[] {
  const candidates = fieldsA
    .flatMap((fieldA) => fieldsB.map((fieldB) => scoreFieldMatch(fieldA, fieldB)))
    .filter((candidate): candidate is ScoredFieldMatch => candidate !== null);
  const eligibleCandidates = candidates
    .filter(
      (candidate) =>
        candidate.confidence >= MIN_POSSIBLE_MATCH_SCORE &&
        (candidate.isCanonicalMatch ||
          candidate.labelScore >= MIN_CONFIDENT_LABEL_SCORE ||
          (candidate.labelScore >= MIN_POSSIBLE_LABEL_SCORE &&
            candidate.valueFormatScore >= 0.82)),
    )
    .filter(
      (candidate) =>
        hasClearCandidateMargin(candidate, candidates, 'A') &&
        hasClearCandidateMargin(candidate, candidates, 'B'),
    )
    .sort((candidateA, candidateB) => {
      if (candidateA.isCanonicalMatch !== candidateB.isCanonicalMatch) {
        return candidateA.isCanonicalMatch ? -1 : 1;
      }

      return candidateB.confidence - candidateA.confidence;
    });
  const matchedKeysA = new Set<string>();
  const matchedKeysB = new Set<string>();
  const matches: SemanticFieldMatch[] = [];

  eligibleCandidates.forEach((candidate) => {
    if (matchedKeysA.has(candidate.fieldA.key) || matchedKeysB.has(candidate.fieldB.key)) {
      return;
    }

    matchedKeysA.add(candidate.fieldA.key);
    matchedKeysB.add(candidate.fieldB.key);
    matches.push({
      fieldA: candidate.fieldA,
      fieldB: candidate.fieldB,
      canonicalKey: candidate.canonicalKey,
      canonicalLabel: candidate.canonicalLabel,
      confidence: candidate.confidence,
      confidenceLevel: candidate.confidenceLevel,
      labelScore: candidate.labelScore,
      valueFormatScore: candidate.valueFormatScore,
    });
  });

  return matches;
}
