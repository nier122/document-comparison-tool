# Backend document analysis and Google OCR

The backend first checks every PDF for meaningful selectable text.

- Generated PDFs return `extractionMode: "text"` without calling Google.
- Scanned PDFs are sent to a Google Document AI Document OCR processor and return `extractionMode: "ocr"`.
- Extraction or configuration errors return `extractionMode: "failed"` with a readable error.

This ordering is intentional: Google OCR is never called when normal PDF text extraction is sufficient.

## Google Cloud setup

1. Create or select a Google Cloud project with billing enabled.
2. Enable the Document AI API.
3. In Document AI, create a processor with type **Document OCR**.
4. Grant the runtime identity permission to process documents.
5. Copy `backend/.env.example` to `backend/.env`.
6. Set:
   - `GOOGLE_DOCUMENT_AI_PROJECT_ID`
   - `GOOGLE_DOCUMENT_AI_LOCATION` (`us` or `eu`, matching the processor)
   - `GOOGLE_DOCUMENT_AI_PROCESSOR_ID`
7. Configure one authentication option:
   - `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON file.
   - `GOOGLE_DOCUMENT_AI_CREDENTIALS_JSON` containing service-account JSON supplied by a secret manager.
   - `GOOGLE_DOCUMENT_AI_API_KEY`.
   - `GOOGLE_DOCUMENT_AI_USE_ADC=true` when ADC is supplied by `gcloud` or an attached cloud service account.

Application Default Credentials or a service account are the recommended Google Cloud authentication methods. API keys are supported by the client configuration, but the processor must still permit the requested operation.

## Run locally

```powershell
cd backend
npm install
Copy-Item .env.example .env
npm run dev
```

In a second terminal:

```powershell
cd frontend
npm install
npm run dev
```

Vite proxies `/api` requests to `http://localhost:3001`.

## Analyze a PDF

```powershell
curl.exe -F "document=@sample.pdf" http://localhost:3001/api/extractions/analyze
```

The response contains page text and PDF-coordinate locations. OCR coordinates are converted from Google’s top-left normalized polygons into the bottom-left coordinate system already used by PDF highlighting.
