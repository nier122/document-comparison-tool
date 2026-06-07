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

## Technical Preferences

Frontend:
- React
- TypeScript
- PDF.js

Backend:
- Node.js
- Express

Comparison:
- diff-match-patch
- jsdiff

Deployment:
- Vercel
- GitHub
