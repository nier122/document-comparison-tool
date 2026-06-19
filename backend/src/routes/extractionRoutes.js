const express = require('express');
const multer = require('multer');

const PDF_UPLOAD_LIMIT_BYTES = 25 * 1024 * 1024;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: PDF_UPLOAD_LIMIT_BYTES,
    files: 1,
  },
});

function isPdf(file) {
  return (
    file?.mimetype === 'application/pdf' ||
    file?.originalname?.toLowerCase().endsWith('.pdf')
  );
}

function hasPdfSignature(buffer) {
  return buffer?.subarray(0, 5).toString('ascii') === '%PDF-';
}

function createExtractionRouter({ extractionService }) {
  const router = express.Router();

  async function analyzeDocument(request, response, next) {
    try {
      if (request.file === undefined) {
        response.status(400).json({
          error: 'PDF_REQUIRED',
          message: 'Upload a PDF using the "document" form field.',
        });
        return;
      }

      if (!isPdf(request.file) || !hasPdfSignature(request.file.buffer)) {
        response.status(415).json({
          error: 'INVALID_PDF',
          message: 'The uploaded file is not a valid PDF.',
        });
        return;
      }

      const result = await extractionService.inspectPdf(request.file.buffer);

      response.json({
        fileName: request.file.originalname,
        ...result,
      });
    } catch (error) {
      next(error);
    }
  }

  router.post('/analyze', upload.single('document'), analyzeDocument);
  router.post('/detect', upload.single('document'), analyzeDocument);

  return router;
}

module.exports = { createExtractionRouter };
