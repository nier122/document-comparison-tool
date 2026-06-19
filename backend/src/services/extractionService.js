const { extractSelectableText } = require('./pdfTextService');
const { createOcrProviderRegistry } = require('./ocr/providerRegistry');

function createExtractionService({
  textExtractor = extractSelectableText,
  ocrProviderRegistry = createOcrProviderRegistry(),
} = {}) {
  return {
    async inspectPdf(pdfBuffer) {
      let textExtraction;

      try {
        textExtraction = await textExtractor(pdfBuffer);
      } catch (error) {
        return {
          extractionMode: 'failed',
          pageCount: null,
          hasSelectableText: false,
          pages: [],
          error: {
            code: 'PDF_TEXT_EXTRACTION_FAILED',
            message: `Unable to inspect PDF text: ${error.message}`,
          },
        };
      }

      if (textExtraction.hasSelectableText) {
        return {
          extractionMode: 'text',
          documentType: 'generated',
          pageCount: textExtraction.pageCount,
          hasSelectableText: true,
          pages: textExtraction.pages,
          pagesWithoutSelectableText: textExtraction.pagesWithoutSelectableText,
          ocr: {
            required: false,
            providers: ocrProviderRegistry.listProviders(),
          },
        };
      }

      const googleOcr = ocrProviderRegistry.getProvider('google-document-ai');

      try {
        const ocrResult = await googleOcr.extractText(pdfBuffer, {
          sourcePages: textExtraction.pages,
        });

        return {
          extractionMode: 'ocr',
          documentType: 'scanned',
          pageCount: textExtraction.pageCount,
          hasSelectableText: false,
          pages: ocrResult.pages,
          pagesWithoutSelectableText: textExtraction.pagesWithoutSelectableText,
          ocr: {
            required: true,
            provider: ocrResult.provider,
          },
        };
      } catch (error) {
        return {
          extractionMode: 'failed',
          documentType: 'scanned',
          pageCount: textExtraction.pageCount,
          hasSelectableText: false,
          pages: [],
          pagesWithoutSelectableText: textExtraction.pagesWithoutSelectableText,
          error: {
            code: error.code ?? 'GOOGLE_OCR_FAILED',
            message: error.message,
          },
          ocr: {
            required: true,
            provider: 'google-document-ai',
            providers: ocrProviderRegistry.listProviders(),
          },
        };
      }
    },
  };
}

module.exports = { createExtractionService };
