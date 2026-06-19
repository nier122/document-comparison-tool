# Phase 1 Guardrails

Allowed:
- PDF upload
- Text extraction
- Selectable-text detection
- Google Document AI OCR for scanned PDFs only
- Text comparison
- Highlighting
- Difference navigation

Not Allowed:
- OCR calls for generated PDFs with sufficient selectable text
- OCR providers other than Google Document AI
- Standards memory
- Compliance engine
- User accounts
- Datadog
- Appwrite

Reason:
Validate document comparison before adding complexity.

Success Criteria:
- User uploads two PDFs.
- Differences are detected.
- Differences are clickable.
- User can navigate to the exact location of each difference.
