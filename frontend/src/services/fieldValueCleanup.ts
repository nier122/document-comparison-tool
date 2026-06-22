import { isFieldLabelSuffix } from './fieldLabelParser.ts';

export type FieldValueCleanupResult = {
  rawValue: string;
  cleanedValue?: string;
  changed: boolean;
};

export type FieldValuesSafetyResult = {
  values: string[];
  removedValues: string[];
  recoveredValues: string[];
  valid: boolean;
};

function normalizeValue(text: string) {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function isRealFieldValue(text: string) {
  const value = normalizeValue(text);

  if (value.length === 0 || isFieldLabelSuffix(value)) {
    return false;
  }

  return (
    /^-?\d[\d,]*(?:\.\d+)?$/.test(value) ||
    /^(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})$/.test(
      value,
    ) ||
    /^(?:(?:SGD|USD|EUR|GBP|AUD|CAD|JPY|CNY|RMB|MYR)\s*|[$€£]\s*)-?\d[\d,]*(?:\.\d+)?$/i.test(
      value,
    ) ||
    (/^[A-Z0-9][A-Z0-9._/#-]*$/i.test(value) && /\d/.test(value)) ||
    value.split(/\s+/).length > 1
  );
}

export function cleanFieldValue(
  rawValue: string,
  nearbyValues: string[],
): FieldValueCleanupResult {
  const normalizedRawValue = normalizeValue(rawValue);

  if (!isFieldLabelSuffix(normalizedRawValue)) {
    return {
      rawValue,
      cleanedValue: normalizedRawValue,
      changed: normalizedRawValue !== rawValue,
    };
  }

  const cleanedValue = nearbyValues
    .map(normalizeValue)
    .find(isRealFieldValue);

  return {
    rawValue,
    cleanedValue,
    changed: cleanedValue !== undefined && cleanedValue !== normalizedRawValue,
  };
}

export function cleanFieldValuesForDifference(
  values: string[],
  nearbyTexts: string[],
): FieldValuesSafetyResult {
  const normalizedValues = values.map(normalizeValue).filter(Boolean);
  const validValues = normalizedValues.filter(
    (value) => !isFieldLabelSuffix(value),
  );
  const removedValues = normalizedValues.filter(isFieldLabelSuffix);
  const contextCandidates = nearbyTexts.flatMap((text) => {
    const normalizedText = normalizeValue(text);
    const tokens = normalizedText
      .split(/\s*\|\s*|\s+/)
      .filter(Boolean);
    const shouldIncludeWholeText =
      tokens.length > 2 || !tokens.some(isFieldLabelSuffix);

    return [
      ...tokens,
      ...(shouldIncludeWholeText ? [normalizedText] : []),
    ];
  });
  const recoveredValues = removedValues.flatMap((removedValue) => {
    const recovery = cleanFieldValue(removedValue, [
      ...validValues,
      ...contextCandidates,
    ]);

    return recovery.cleanedValue === undefined ? [] : [recovery.cleanedValue];
  });
  const cleanedValues = [...new Set([...validValues, ...recoveredValues])];

  return {
    values: cleanedValues,
    removedValues,
    recoveredValues,
    valid: cleanedValues.length > 0,
  };
}

export function isInvalidDisplayedFieldValue(value: string | undefined) {
  return value !== undefined && isFieldLabelSuffix(value);
}

export function shouldDisplayFieldDifference(difference: {
  isFieldDifference?: boolean;
  textBefore?: string;
  textAfter?: string;
}) {
  if (!difference.isFieldDifference) {
    return true;
  }

  return (
    !isInvalidDisplayedFieldValue(difference.textBefore) &&
    !isInvalidDisplayedFieldValue(difference.textAfter)
  );
}
