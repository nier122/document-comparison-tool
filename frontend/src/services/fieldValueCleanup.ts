import { isFieldLabelSuffix } from './fieldLabelParser.ts';

export type FieldValueCleanupResult = {
  rawValue: string;
  cleanedValue?: string;
  changed: boolean;
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
