import type {
  Difference,
  DifferenceCategory,
  DifferenceSeverity,
} from '../types/comparison';

const identifierFieldKeys = new Set([
  'poNumber',
  'invoiceNumber',
  'itemCode',
]);
const amountFieldKeys = new Set([
  'amount',
  'total',
  'unitPrice',
  'lineTotal',
]);
const wordingFieldKeys = new Set([
  'itemDescription',
  'remarks',
  'customer',
  'supplier',
]);

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

function classifyCategory(difference: Difference): DifferenceCategory {
  const fieldKey = difference.fieldKey ?? '';
  const text = getDifferenceText(difference);

  if (
    identifierFieldKeys.has(fieldKey) ||
    /\b(?:identifier|reference|account|order|invoice|item)\s*(?:no|number|code|id)\b/i.test(text)
  ) {
    return 'Identifier Change';
  }

  if (fieldKey === 'quantity' || /\b(?:quantity|qty)\b/i.test(difference.fieldLabel ?? '')) {
    return 'Quantity Change';
  }

  if (
    amountFieldKeys.has(fieldKey) ||
    /\b(?:amount|total|price|rate|cost)\b/i.test(difference.fieldLabel ?? '')
  ) {
    return 'Amount Change';
  }

  if (fieldKey === 'date' || /\bdate\b/i.test(difference.fieldLabel ?? '')) {
    return 'Date Change';
  }

  if (wordingFieldKeys.has(fieldKey)) {
    return 'Text Wording Change';
  }

  if (
    difference.ignoredReason !== undefined ||
    /\b(?:page|printed|generated|created|exported|header|footer|address|timestamp|metadata)\b/i.test(text)
  ) {
    return 'Metadata Change';
  }

  if (difference.isFieldDifference) {
    return 'Table Value Change';
  }

  if (difference.type === 'modified' && difference.inlineParts !== undefined) {
    return 'Text Wording Change';
  }

  return 'Unknown';
}

function classifySeverity(category: DifferenceCategory): DifferenceSeverity {
  switch (category) {
    case 'Identifier Change':
    case 'Amount Change':
      return 'High';
    case 'Quantity Change':
    case 'Date Change':
    case 'Table Value Change':
      return 'Medium';
    case 'Text Wording Change':
    case 'Metadata Change':
    case 'Unknown':
      return 'Low';
  }
}

export function classifyDifference(difference: Difference): Difference {
  const category = classifyCategory(difference);

  return {
    ...difference,
    category,
    severity: classifySeverity(category),
  };
}

export function classifyDifferences(differences: Difference[]) {
  return differences.map(classifyDifference);
}
