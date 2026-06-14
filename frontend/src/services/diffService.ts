import type { Difference, ExtractedPdfPage } from '../types/comparison';

function normalizeText(text: string) {
  return text.replace(/\s+/g, ' ').trim();
}

export function generateDifferences(
  pdfAPages: ExtractedPdfPage[],
  pdfBPages: ExtractedPdfPage[],
): Difference[] {
  const differences: Difference[] = [];
  const maxPageCount = Math.max(pdfAPages.length, pdfBPages.length);

  for (let pageIndex = 0; pageIndex < maxPageCount; pageIndex += 1) {
    const pageA = pdfAPages[pageIndex];
    const pageB = pdfBPages[pageIndex];
    const textA = normalizeText(pageA?.text ?? '');
    const textB = normalizeText(pageB?.text ?? '');

    if (textA === textB) {
      continue;
    }

    if (textA.length === 0 && textB.length > 0) {
      differences.push({
        id: `page-${pageIndex + 1}-added`,
        type: 'added',
        pageB: pageB?.pageNumber ?? pageIndex + 1,
        textAfter: textB,
      });
      continue;
    }

    if (textA.length > 0 && textB.length === 0) {
      differences.push({
        id: `page-${pageIndex + 1}-deleted`,
        type: 'deleted',
        pageA: pageA?.pageNumber ?? pageIndex + 1,
        textBefore: textA,
      });
      continue;
    }

    differences.push({
      id: `page-${pageIndex + 1}-modified`,
      type: 'modified',
      pageA: pageA?.pageNumber ?? pageIndex + 1,
      pageB: pageB?.pageNumber ?? pageIndex + 1,
      textBefore: textA,
      textAfter: textB,
    });
  }

  return differences;
}
