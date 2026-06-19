const assert = require('node:assert/strict');
const test = require('node:test');
const { createApp } = require('../src/app');
const { createExtractionService } = require('../src/services/extractionService');
const { createOcrProviderRegistry } = require('../src/services/ocr/providerRegistry');
const { extractSelectableText } = require('../src/services/pdfTextService');
const {
  getBoundingBox,
  getTextFromAnchor,
  GoogleDocumentAiOcrService,
} = require('../src/services/ocr/providers/GoogleDocumentAiOcrService');

function createPdf(contentStream) {
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(contentStream, 'ascii')} >>\nstream\n${contentStream}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body, 'ascii'));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(body, 'ascii');
  const xrefEntries = offsets
    .slice(1)
    .map((offset) => `${String(offset).padStart(10, '0')} 00000 n \n`)
    .join('');

  return Buffer.from(
    `${body}xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${xrefEntries}` +
      `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
      `startxref\n${xrefOffset}\n%%EOF\n`,
    'ascii',
  );
}

test('returns text mode without calling Google OCR when selectable text exists', async () => {
  let ocrCallCount = 0;
  const service = createExtractionService({
    textExtractor: async () => ({
      pageCount: 2,
      hasSelectableText: true,
      pagesWithoutSelectableText: [2],
      pages: [
        { pageNumber: 1, text: 'Purchase Order 22884996', hasSelectableText: true },
        { pageNumber: 2, text: '', hasSelectableText: false },
      ],
    }),
    ocrProviderRegistry: {
      getProvider: () => ({
        extractText: async () => {
          ocrCallCount += 1;
          throw new Error('OCR should not run for generated PDFs.');
        },
      }),
      listProviders: () => [],
    },
  });

  const result = await service.inspectPdf(Buffer.from('pdf'));

  assert.equal(result.extractionMode, 'text');
  assert.equal(result.hasSelectableText, true);
  assert.equal(result.pages.length, 2);
  assert.deepEqual(result.pagesWithoutSelectableText, [2]);
  assert.equal(result.ocr.required, false);
  assert.equal(ocrCallCount, 0);
});

test('returns OCR text and locations when a scanned PDF is processed by Google', async () => {
  let ocrCallCount = 0;
  const service = createExtractionService({
    textExtractor: async () => ({
      pageCount: 2,
      hasSelectableText: false,
      pagesWithoutSelectableText: [1, 2],
      pages: [
        { pageNumber: 1, text: '', hasSelectableText: false },
        { pageNumber: 2, text: '', hasSelectableText: false },
      ],
    }),
    ocrProviderRegistry: {
      getProvider: () => ({
        extractText: async (_buffer, options) => {
          ocrCallCount += 1;
          assert.equal(options.sourcePages.length, 2);

          return {
            provider: 'google-document-ai',
            pages: [
              {
                pageNumber: 1,
                pageWidth: 612,
                pageHeight: 792,
                text: 'Scanned purchase order',
                locations: [
                  {
                    pageNumber: 1,
                    x: 72,
                    y: 700,
                    width: 120,
                    height: 14,
                    text: 'Scanned purchase order',
                  },
                ],
              },
            ],
          };
        },
      }),
      listProviders: () => [],
    },
  });

  const result = await service.inspectPdf(Buffer.from('pdf'));

  assert.equal(result.extractionMode, 'ocr');
  assert.equal(result.documentType, 'scanned');
  assert.equal(result.hasSelectableText, false);
  assert.equal(result.pages[0].text, 'Scanned purchase order');
  assert.equal(result.ocr.required, true);
  assert.equal(result.ocr.provider, 'google-document-ai');
  assert.equal(ocrCallCount, 1);
});

test('returns a clear failed mode when Google OCR is not configured', async () => {
  const service = createExtractionService({
    textExtractor: async () => ({
      pageCount: 1,
      hasSelectableText: false,
      pagesWithoutSelectableText: [1],
      pages: [
        {
          pageNumber: 1,
          pageWidth: 612,
          pageHeight: 792,
          text: '',
          locations: [],
        },
      ],
    }),
  });

  const result = await service.inspectPdf(Buffer.from('pdf'));

  assert.equal(result.extractionMode, 'failed');
  assert.equal(result.error.code, 'OCR_PROVIDER_NOT_CONFIGURED');
  assert.match(result.error.message, /Google Document AI OCR is not configured/);
});

test('registers Google Document AI as the only OCR provider', () => {
  const providers = createOcrProviderRegistry().listProviders();

  assert.deepEqual(providers.map((provider) => provider.provider), [
    'google-document-ai',
  ]);
  assert.equal(providers[0].implemented, true);
  assert.equal(providers[0].configured, false);
});

test('detects selectable text in a real generated PDF', async () => {
  const pdf = createPdf('BT /F1 12 Tf 72 720 Td (Selectable text) Tj ET');
  const result = await extractSelectableText(pdf);

  assert.equal(result.hasSelectableText, true);
  assert.equal(result.pageCount, 1);
  assert.match(result.pages[0].text, /Selectable text/);
});

test('marks a real image-only-style PDF page as having no selectable text', async () => {
  const pdf = createPdf('');
  const result = await extractSelectableText(pdf);

  assert.equal(result.hasSelectableText, false);
  assert.deepEqual(result.pagesWithoutSelectableText, [1]);
});

test('exposes extraction mode through the PDF upload endpoint', async (context) => {
  const app = createApp({
    extractionService: {
      inspectPdf: async () => ({
        extractionMode: 'ocr',
        pageCount: 1,
        hasSelectableText: false,
        pages: [],
        pagesWithoutSelectableText: [1],
        ocr: { required: true, providers: [] },
      }),
    },
  });
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, () => resolve(listener));
  });

  context.after(() => new Promise((resolve) => server.close(resolve)));

  const address = server.address();
  const form = new FormData();
  form.append(
    'document',
    new Blob([Buffer.from('%PDF-1.4\n')], { type: 'application/pdf' }),
    'scan.pdf',
  );

  const response = await fetch(
    `http://127.0.0.1:${address.port}/api/extractions/detect`,
    {
      method: 'POST',
      body: form,
    },
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.fileName, 'scan.pdf');
  assert.equal(body.extractionMode, 'ocr');
});

test('maps Google normalized coordinates into the existing PDF coordinate system', () => {
  const boundingBox = getBoundingBox(
    {
      boundingPoly: {
        normalizedVertices: [
          { x: 0.1, y: 0.2 },
          { x: 0.4, y: 0.2 },
          { x: 0.4, y: 0.3 },
          { x: 0.1, y: 0.3 },
        ],
      },
    },
    600,
    800,
  );

  assert.deepEqual(boundingBox, {
    x: 60,
    y: 560,
    width: 180,
    height: 80,
  });
});

test('reads Google text anchors and supports API-key configuration', () => {
  assert.equal(
    getTextFromAnchor('Purchase Order 22884996', {
      textSegments: [{ startIndex: 0, endIndex: 14 }],
    }),
    'Purchase Order',
  );

  const service = new GoogleDocumentAiOcrService({
    config: {
      projectId: 'project',
      location: 'us',
      processorId: 'processor',
      apiKey: 'api-key',
    },
    client: {},
  });

  assert.equal(service.getStatus().configured, true);
});

test('sends scanned PDFs to Google and maps OCR tokens to existing locations', async () => {
  let capturedRequest;
  const client = {
    processorPath: (projectId, location, processorId) =>
      `projects/${projectId}/locations/${location}/processors/${processorId}`,
    processDocument: async (request) => {
      capturedRequest = request;

      return [
        {
          document: {
            text: 'PO 22884996',
            pages: [
              {
                dimension: { width: 600, height: 800 },
                tokens: [
                  {
                    layout: {
                      textAnchor: {
                        textSegments: [{ startIndex: 0, endIndex: 2 }],
                      },
                      boundingPoly: {
                        normalizedVertices: [
                          { x: 0.1, y: 0.1 },
                          { x: 0.2, y: 0.1 },
                          { x: 0.2, y: 0.15 },
                          { x: 0.1, y: 0.15 },
                        ],
                      },
                      confidence: 0.98,
                    },
                  },
                ],
              },
            ],
          },
        },
      ];
    },
  };
  const service = new GoogleDocumentAiOcrService({
    config: {
      projectId: 'project',
      location: 'us',
      processorId: 'processor',
      apiKey: 'api-key',
    },
    client,
  });

  const result = await service.extractText(Buffer.from('scanned-pdf'), {
    sourcePages: [{ pageNumber: 1, pageWidth: 612, pageHeight: 792 }],
  });

  assert.equal(
    capturedRequest.name,
    'projects/project/locations/us/processors/processor',
  );
  assert.equal(capturedRequest.rawDocument.mimeType, 'application/pdf');
  assert.equal(result.pages[0].text, 'PO');
  assert.equal(result.pages[0].locations[0].text, 'PO');
  assert.equal(result.pages[0].locations[0].pageNumber, 1);
  assert.equal(result.pages[0].pageWidth, 612);
});
