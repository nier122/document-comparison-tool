import type { Difference, PdfTextSelection } from '../types/comparison';

const selectionStopWords = new Set([
  'a',
  'an',
  'and',
  'for',
  'in',
  'of',
  'on',
  'or',
  'the',
  'to',
]);

function normalizeSelectionText(text: string) {
  return text
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getTextMatchScore(selectedText: string, candidateText: string) {
  const selectedKey = normalizeSelectionText(selectedText);
  const candidateKey = normalizeSelectionText(candidateText);

  if (selectedKey.length === 0 || candidateKey.length === 0) {
    return 0;
  }

  if (!/\d/.test(selectedKey) && !selectedKey.includes(' ') && selectionStopWords.has(selectedKey)) {
    return 0;
  }

  if (selectedKey === candidateKey) {
    return 100;
  }

  if (selectedKey.includes(candidateKey)) {
    return 75 + Math.min((candidateKey.length / selectedKey.length) * 20, 20);
  }

  if (candidateKey.includes(selectedKey)) {
    return 70 + Math.min((selectedKey.length / candidateKey.length) * 20, 20);
  }

  const selectedTokens = new Set(selectedKey.split(' '));
  const candidateTokens = new Set(candidateKey.split(' '));
  const overlap = [...selectedTokens].filter((token) => candidateTokens.has(token)).length;

  if (overlap === 0) {
    return 0;
  }

  return (2 * overlap * 60) / (selectedTokens.size + candidateTokens.size);
}

function getDifferenceSelectionScore(
  difference: Difference,
  selection: PdfTextSelection,
) {
  const pageNumber = selection.side === 'before' ? difference.pageA : difference.pageB;

  if (pageNumber !== selection.pageNumber) {
    return 0;
  }

  const changedText =
    selection.side === 'before'
      ? difference.changedTextBefore ?? difference.textBefore
      : difference.changedTextAfter ?? difference.textAfter;
  const fullText =
    selection.side === 'before' ? difference.textBefore : difference.textAfter;
  const locations =
    selection.side === 'before'
      ? difference.beforeLocations ?? []
      : difference.afterLocations ?? [];
  const scores = [
    difference.fieldLabel === undefined
      ? 0
      : getTextMatchScore(selection.text, difference.fieldLabel) + 8,
    changedText === undefined ? 0 : getTextMatchScore(selection.text, changedText) + 10,
    fullText === undefined ? 0 : getTextMatchScore(selection.text, fullText),
    ...locations.map((location) => getTextMatchScore(selection.text, location.text) + 5),
  ];

  return Math.max(...scores);
}

export function findLinkedDifference(
  differences: Difference[],
  selection: PdfTextSelection,
) {
  return differences
    .map((difference) => ({
      difference,
      score: getDifferenceSelectionScore(difference, selection),
    }))
    .filter((candidate) => candidate.score >= 45)
    .sort((candidateA, candidateB) => candidateB.score - candidateA.score)[0]?.difference;
}
