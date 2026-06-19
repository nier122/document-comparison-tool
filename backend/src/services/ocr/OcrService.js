class OcrNotConfiguredError extends Error {
  constructor(provider, { message } = {}) {
    super(message ?? `OCR provider "${provider}" is not configured.`);
    this.name = 'OcrNotConfiguredError';
    this.code = 'OCR_PROVIDER_NOT_CONFIGURED';
    this.status = 501;
    this.provider = provider;
  }
}

/**
 * Provider-neutral OCR contract.
 *
 * Implementations must return:
 * {
 *   provider: string,
 *   pages: Array<{
 *     pageNumber: number,
 *     text: string,
 *     confidence?: number,
 *     words?: Array<{
 *       text: string,
 *       confidence?: number,
 *       boundingBox?: { x: number, y: number, width: number, height: number }
 *     }>
 *   }>
 * }
 */
class OcrService {
  constructor(provider) {
    if (new.target === OcrService) {
      throw new TypeError('OcrService is an abstract class.');
    }

    this.provider = provider;
  }

  getStatus() {
    return {
      provider: this.provider,
      configured: false,
      implemented: false,
    };
  }

  async extractText(_pdfBuffer, _options = {}) {
    throw new OcrNotConfiguredError(this.provider);
  }
}

module.exports = { OcrNotConfiguredError, OcrService };
