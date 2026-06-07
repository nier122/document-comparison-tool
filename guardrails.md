# Phase 1 Guardrails

Allowed:
- PDF upload
- Text extraction
- Text comparison
- Highlighting
- Difference navigation

Not Allowed:
- OCR
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
