const { v1: documentai } = require('@google-cloud/documentai');
const { getGoogleDocumentAiConfig } = require('../../../config/googleDocumentAiConfig');
const { OcrNotConfiguredError, OcrService } = require('../OcrService');

function getTextFromAnchor(documentText, textAnchor) {
  return (textAnchor?.textSegments ?? [])
    .map((segment) => {
      const startIndex = Number(segment.startIndex ?? 0);
      const endIndex = Number(segment.endIndex ?? startIndex);

      return documentText.slice(startIndex, endIndex);
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function getBoundingBox(layout, pageWidth, pageHeight) {
  const boundingPoly = layout?.boundingPoly;
  const normalizedVertices = boundingPoly?.normalizedVertices ?? [];
  const vertices = boundingPoly?.vertices ?? [];
  const points =
    normalizedVertices.length > 0
      ? normalizedVertices.map((vertex) => ({
          x: Number(vertex.x ?? 0) * pageWidth,
          y: Number(vertex.y ?? 0) * pageHeight,
        }))
      : vertices.map((vertex) => ({
          x: Number(vertex.x ?? 0),
          y: Number(vertex.y ?? 0),
        }));

  if (points.length === 0) {
    return undefined;
  }

  const left = Math.min(...points.map((point) => point.x));
  const right = Math.max(...points.map((point) => point.x));
  const top = Math.min(...points.map((point) => point.y));
  const bottom = Math.max(...points.map((point) => point.y));

  return {
    x: left,
    y: pageHeight - bottom,
    width: Math.max(right - left, 1),
    height: Math.max(bottom - top, 1),
  };
}

function getProcessorName(client, config) {
  if (config.processorVersion) {
    return client.processorVersionPath(
      config.projectId,
      config.location,
      config.processorId,
      config.processorVersion,
    );
  }

  return client.processorPath(
    config.projectId,
    config.location,
    config.processorId,
  );
}

function createClientOptions(config) {
  const options = {
    apiEndpoint: `${config.location}-documentai.googleapis.com`,
  };

  if (config.credentials !== undefined) {
    options.credentials = config.credentials;
  }

  if (config.keyFilename !== undefined) {
    options.keyFilename = config.keyFilename;
  }

  if (config.apiKey !== undefined) {
    options.apiKey = config.apiKey;
  }

  return options;
}

class GoogleDocumentAiOcrService extends OcrService {
  constructor({
    config = getGoogleDocumentAiConfig(),
    client,
  } = {}) {
    super('google-document-ai');
    this.config = config;
    this.client = client;
  }

  isConfigured() {
    const hasProcessor =
      Boolean(this.config.projectId) && Boolean(this.config.processorId);
    const hasExplicitAuthentication =
      Boolean(this.config.credentials) ||
      Boolean(this.config.keyFilename) ||
      Boolean(this.config.apiKey) ||
      this.config.useAdc === true;

    return hasProcessor && hasExplicitAuthentication;
  }

  getStatus() {
    return {
      provider: this.provider,
      configured: this.isConfigured(),
      implemented: true,
    };
  }

  getClient() {
    this.client ??= new documentai.DocumentProcessorServiceClient(
      createClientOptions(this.config),
    );

    return this.client;
  }

  async extractText(pdfBuffer, { sourcePages = [] } = {}) {
    if (!this.isConfigured()) {
      throw new OcrNotConfiguredError(this.provider, {
        message:
          'Google Document AI OCR is not configured. Set the project, processor, location, and Google credentials environment variables.',
      });
    }

    const client = this.getClient();
    const name = getProcessorName(client, this.config);

    try {
      const [response] = await client.processDocument({
        name,
        rawDocument: {
          content: pdfBuffer.toString('base64'),
          mimeType: 'application/pdf',
        },
        processOptions: {
          ocrConfig: {
            enableImageQualityScores: true,
          },
        },
      });
      const document = response.document ?? {};
      const documentText = document.text ?? '';
      const pages = (document.pages ?? []).map((page, pageIndex) => {
        const pageNumber = pageIndex + 1;
        const sourcePage = sourcePages.find(
          (candidate) => candidate.pageNumber === pageNumber,
        );
        const pageWidth =
          sourcePage?.pageWidth ?? Number(page.dimension?.width ?? 1);
        const pageHeight =
          sourcePage?.pageHeight ?? Number(page.dimension?.height ?? 1);
        const layoutItems =
          page.tokens?.length > 0 ? page.tokens : page.lines ?? [];
        const locations = layoutItems
          .map((item) => {
            const text = getTextFromAnchor(documentText, item.layout?.textAnchor);
            const boundingBox = getBoundingBox(
              item.layout,
              pageWidth,
              pageHeight,
            );

            if (text.length === 0 || boundingBox === undefined) {
              return null;
            }

            return {
              pageNumber,
              text,
              ...boundingBox,
              confidence: item.layout?.confidence,
            };
          })
          .filter(Boolean);
        const pageText =
          getTextFromAnchor(documentText, page.layout?.textAnchor) ||
          locations.map((location) => location.text).join(' ');

        return {
          pageNumber,
          pageWidth,
          pageHeight,
          text: pageText.trim(),
          locations,
          confidence: page.layout?.confidence,
        };
      });

      return {
        provider: this.provider,
        text: documentText,
        pages,
      };
    } catch (cause) {
      const error = new Error(
        `Google Document AI OCR failed: ${cause.message ?? 'Unknown Google API error.'}`,
        { cause },
      );
      error.code = 'GOOGLE_OCR_FAILED';
      error.status = 502;
      throw error;
    }
  }
}

module.exports = {
  GoogleDocumentAiOcrService,
  getBoundingBox,
  getTextFromAnchor,
};
