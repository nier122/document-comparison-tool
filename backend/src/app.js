const express = require('express');
const { createExtractionRouter } = require('./routes/extractionRoutes');
const { createExtractionService } = require('./services/extractionService');

function createApp({ extractionService = createExtractionService() } = {}) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_request, response) => {
    response.json({ status: 'ok' });
  });

  app.use('/api/extractions', createExtractionRouter({ extractionService }));

  app.use((error, _request, response, _next) => {
    if (error?.code === 'LIMIT_FILE_SIZE') {
      response.status(413).json({
        error: 'PDF_TOO_LARGE',
        message: 'The PDF exceeds the 25 MB upload limit.',
      });
      return;
    }

    const status = Number.isInteger(error?.status) ? error.status : 500;

    response.status(status).json({
      error: error?.code ?? 'INTERNAL_SERVER_ERROR',
      message: status >= 500 ? 'Unable to inspect the PDF.' : error.message,
    });
  });

  return app;
}

module.exports = { createApp };
