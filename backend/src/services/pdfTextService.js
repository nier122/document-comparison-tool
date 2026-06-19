const path = require('node:path');

const MIN_PAGE_SELECTABLE_TEXT_CHARACTERS = 12;
const MIN_DOCUMENT_SELECTABLE_TEXT_CHARACTERS = 20;
const PDFJS_ROOT = path.dirname(require.resolve('pdfjs-dist/package.json'));
const STANDARD_FONT_DATA_URL = `${path.join(PDFJS_ROOT, 'standard_fonts').replaceAll('\\', '/')}/`;

function normalizeExtractedText(text) {
  return text
    .normalize('NFKC')
    .replace(/\u00ad/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMeaningfulText(text) {
  return getMeaningfulCharacterCount(text) >= MIN_PAGE_SELECTABLE_TEXT_CHARACTERS;
}

function getMeaningfulCharacterCount(text) {
  return normalizeExtractedText(text).replace(/[^\p{L}\p{N}]/gu, '').length;
}

function getPositionedTextItem(item, pageNumber) {
  if (!('str' in item) || !Array.isArray(item.transform)) {
    return null;
  }

  const text = normalizeExtractedText(item.str);

  if (text.length === 0) {
    return null;
  }

  return {
    pageNumber,
    text,
    x: item.transform[4] ?? 0,
    y: item.transform[5] ?? 0,
    width: item.width ?? 0,
    height: item.height ?? Math.abs(item.transform[3] ?? 0),
  };
}

async function loadPdfJs() {
  return import('pdfjs-dist/legacy/build/pdf.mjs');
}

async function extractSelectableText(pdfBuffer) {
  const { getDocument } = await loadPdfJs();
  const loadingTask = getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
    useSystemFonts: false,
  });

  try {
    const pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const viewport = page.getViewport({ scale: 1 });
      const textContent = await page.getTextContent();
      const locations = textContent.items
        .map((item) => getPositionedTextItem(item, pageNumber))
        .filter(Boolean);
      const text = normalizeExtractedText(locations.map((location) => location.text).join(' '));

      pages.push({
        pageNumber,
        pageWidth: viewport.width,
        pageHeight: viewport.height,
        text,
        locations,
        hasSelectableText: hasMeaningfulText(text),
        meaningfulCharacterCount: getMeaningfulCharacterCount(text),
      });

      page.cleanup();
    }

    const meaningfulCharacterCount = pages.reduce(
      (total, page) => total + page.meaningfulCharacterCount,
      0,
    );
    const pagesWithSelectableText = pages.filter(
      (page) => page.hasSelectableText,
    ).length;
    const minimumTextPageCount = Math.max(1, Math.ceil(pdf.numPages * 0.5));
    const hasSelectableText =
      meaningfulCharacterCount >= MIN_DOCUMENT_SELECTABLE_TEXT_CHARACTERS ||
      pagesWithSelectableText >= minimumTextPageCount;

    return {
      pageCount: pdf.numPages,
      pages,
      hasSelectableText,
      meaningfulCharacterCount,
      pagesWithoutSelectableText: pages
        .filter((page) => !page.hasSelectableText)
        .map((page) => page.pageNumber),
    };
  } finally {
    await loadingTask.destroy();
  }
}

module.exports = {
  extractSelectableText,
  getMeaningfulCharacterCount,
  hasMeaningfulText,
  normalizeExtractedText,
};
