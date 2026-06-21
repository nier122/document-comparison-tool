export type FieldLabelAlias<T> = {
  alias: string;
  field: T;
};

export type ParsedFieldLabel<T> = {
  rawText: string;
  labelText: string;
  valueText: string;
  field: T;
};

export type FieldParserDebugEntry = {
  rawText: string;
  detectedLabel: string;
  detectedValue: string;
};

const LABEL_SUFFIX_PATTERN = /^(?:no\.?|number|#|id|ref\.?|code|type)$/i;
const LEADING_SEPARATOR_PATTERN = /^\s*(?::|\||-)\s*/;
const TOKEN_PATTERN = /\S+/g;

export const DEBUG_FIELD_LABELS = [
  'PO',
  'Purchase Order',
  'Order',
  'Invoice',
  'Reference',
  'Customer',
  'Part',
  'Item',
  'Supplier',
  'Vendor',
  'Quantity',
  'Qty',
  'Amount',
  'Total',
  'Date',
];

function normalizeParserText(text: string) {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getTokens(text: string) {
  return [...text.matchAll(TOKEN_PATTERN)].map((match) => ({
    text: match[0],
    index: match.index,
    end: match.index + match[0].length,
  }));
}

function isLikelyValueStart(token: string, remainingText: string) {
  const normalizedToken = token.replace(/^[([{]+|[)\]},;:]+$/g, '');

  return (
    /^(?:[$€£]|SGD|USD|EUR|GBP|AUD|CAD|JPY|CNY|RMB|MYR)$/i.test(normalizedToken) ||
    /^-?\d[\d,]*(?:\.\d+)?$/.test(normalizedToken) ||
    /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/.test(
      normalizedToken,
    ) ||
    (/^[A-Z0-9][A-Z0-9._/#-]*$/i.test(normalizedToken) &&
      /\d/.test(normalizedToken)) ||
    /\b(?:ltd|limited|llc|inc|corp|corporation|company|co\.?|pte|plc|gmbh|sdn|bhd)\b/i.test(
      remainingText,
    )
  );
}

function extendLabelBoundary(textAfterAlias: string) {
  const tokens = getTokens(textAfterAlias);
  let consumedEnd = 0;

  for (const token of tokens) {
    if (!LABEL_SUFFIX_PATTERN.test(token.text)) {
      break;
    }

    consumedEnd = token.end;
  }

  if (consumedEnd > 0) {
    return consumedEnd;
  }

  const firstToken = tokens[0];

  if (
    firstToken !== undefined &&
    isLikelyValueStart(firstToken.text, textAfterAlias.slice(firstToken.index))
  ) {
    return 0;
  }

  return 0;
}

export function parseFieldLabelAtStart<T>(
  rawText: string,
  aliases: FieldLabelAlias<T>[],
): ParsedFieldLabel<T> | undefined {
  const text = normalizeParserText(rawText);
  const matches = aliases
    .map(({ alias, field }) => {
      const match = new RegExp(
        String.raw`^${escapeRegExp(alias).replace(/\s+/g, String.raw`\s+`)}(?=$|\s|[:|#-])`,
        'i',
      ).exec(text);

      if (match === null) {
        return null;
      }

      let labelEnd = match[0].length;
      const textAfterAlias = text.slice(labelEnd);
      const suffixLength = extendLabelBoundary(textAfterAlias);

      if (suffixLength > 0) {
        labelEnd += suffixLength;
      }

      const separator = LEADING_SEPARATOR_PATTERN.exec(text.slice(labelEnd));

      if (separator !== null) {
        labelEnd += separator[0].length;
      }

      const labelText = text.slice(0, labelEnd).replace(/\s*(?::|\||-)\s*$/, '').trim();
      const valueText = text.slice(labelEnd).trim();

      return {
        rawText,
        labelText,
        valueText,
        field,
        aliasLength: match[0].length,
      };
    })
    .filter((match): match is NonNullable<typeof match> => match !== null)
    .sort(
      (matchA, matchB) =>
        matchB.labelText.length - matchA.labelText.length ||
        matchB.aliasLength - matchA.aliasLength,
    );

  const match = matches[0];

  if (match === undefined) {
    return undefined;
  }

  return {
    rawText: match.rawText,
    labelText: match.labelText,
    valueText: match.valueText,
    field: match.field,
  };
}

export function getFieldParserDebugEntries(
  rawTexts: string[],
): FieldParserDebugEntry[] {
  const aliases = DEBUG_FIELD_LABELS.map((alias) => ({
    alias,
    field: alias,
  }));

  return rawTexts
    .map((rawText) => parseFieldLabelAtStart(rawText, aliases))
    .filter((match): match is NonNullable<typeof match> => match !== undefined)
    .filter((match) => match.valueText.length > 0)
    .map((match) => ({
      rawText: match.rawText,
      detectedLabel: match.labelText,
      detectedValue: match.valueText,
    }));
}
