# Document Comparison Tool

## Project Vision
Build a web application that allows users to upload two PDF documents and compare them side-by-side.

The application should help users quickly identify differences between document versions and navigate directly to the location of those differences.

The initial focus is accuracy, transparency, and usability.

AI features should only be added after a reliable comparison engine exists.

## Primary User Workflow

1. User uploads PDF A.
2. User uploads PDF B.
3. System extracts text and document structure.
4. System identifies differences.
5. System displays both PDFs side-by-side.
6. System displays a list of detected differences.
7. User clicks a difference.
8. System navigates to the corresponding location in both PDFs.
9. Changed text is highlighted.

## Key Product Principles

- Verification First
- Exact Location Matters
- Human Review Friendly
- Future Ready

## MVP Scope

Included:
- Upload two PDFs
- PDF rendering
- Text extraction from generated PDFs
- Difference detection
- Side-by-side viewer
- Difference navigation panel
- Highlighting changed text
- Page synchronization

Excluded:
- OCR
- User authentication
- Team collaboration
- Standards memory
- Compliance checking
- Multi-document comparison
- Backend services

## Current Implementation Focus

The current implementation should remain focused on generated PDFs only.

Do not add OCR, handwritten recognition, or backend services during the current MVP phase.

Generated-PDF extraction should continue improving before scanned-PDF workflows are introduced.

## Future Extraction Requirements

The app must eventually support more document-aware extraction features:

- Table-aware extraction so tabular content can be compared by rows, columns, and cells.
- Header and footer detection so repeated page furniture does not create false differences.
- Column-aware reading order so multi-column documents are extracted in visual reading order.
- Scanned PDF OCR after generated-PDF comparison is reliable.
- Handwritten PDF OCR as a future advanced feature after standard scanned OCR is proven.

## Technical Preferences

Frontend:
- React
- TypeScript
- PDF.js

Backend:
- Node.js
- Express
- Backend work is deferred until the frontend comparison workflow is validated.

Comparison:
- diff-match-patch
- jsdiff
- Current implementation may use custom frontend comparison services where they better fit PDF extraction data.

Extraction:
- Coordinate-based text ordering for generated PDFs
- Future table-aware extraction
- Future header/footer detection
- Future column-aware reading order
- Future OCR for scanned PDFs
- Future advanced OCR for handwritten PDFs

Deployment:
- Vercel
- GitHub
