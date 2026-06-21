import type { PdfExtractionState } from '../types/comparison';
import { getFieldParserDebugEntries } from '../services/fieldLabelParser';

type PDFExtractionDebugViewProps = {
  pdfAExtraction: PdfExtractionState;
  pdfBExtraction: PdfExtractionState;
};

function formatDebugStatus(status: PdfExtractionState['status']) {
  switch (status) {
    case 'extracting':
      return 'Extracting';
    case 'extracted':
      return 'Extracted';
    case 'failed':
      return 'Failed';
    case 'not-extracted':
      return 'Not Extracted';
  }
}

function getDebugRawLines(
  locations: PdfExtractionState['pages'][number]['locations'],
) {
  const lineGroups: typeof locations[] = [];

  [...locations]
    .sort((locationA, locationB) => locationB.y - locationA.y || locationA.x - locationB.x)
    .forEach((location) => {
      const matchingLine = lineGroups.find(
        (line) =>
          Math.abs(line[0].y - location.y) <=
          Math.max(3, location.height * 0.4),
      );

      if (matchingLine === undefined) {
        lineGroups.push([location]);
      } else {
        matchingLine.push(location);
      }
    });

  return lineGroups.map((line) =>
    [...line]
      .sort((locationA, locationB) => locationA.x - locationB.x)
      .map((location) => location.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim(),
  );
}

function renderExtractedPages(extraction: PdfExtractionState) {
  if (extraction.status !== 'extracted') {
    return <p>Extraction Status: {formatDebugStatus(extraction.status)}</p>;
  }

  if (extraction.pages.length === 0) {
    return <p>No extracted pages available.</p>;
  }

  return extraction.pages.map((page) => {
    const parserEntries = getFieldParserDebugEntries(getDebugRawLines(page.locations));

    return (
      <section key={page.pageNumber} style={{ marginBottom: '18px' }}>
        <h4 style={{ marginBottom: '6px' }}>Page {page.pageNumber}</h4>
        <pre
          style={{
            background: '#f9fafb',
            border: '1px solid #d1d5db',
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
            fontSize: '13px',
            lineHeight: 1.5,
            margin: 0,
            maxHeight: '220px',
            overflow: 'auto',
            padding: '10px',
            whiteSpace: 'pre-wrap',
          }}
        >
          {page.text || '[No text extracted]'}
        </pre>
        <h5 style={{ margin: '10px 0 6px' }}>Field Parser Debug</h5>
        {parserEntries.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>No label/value pairs detected.</p>
        ) : (
          <pre
            style={{
              background: '#eff6ff',
              border: '1px solid #bfdbfe',
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
              fontSize: '12px',
              lineHeight: 1.5,
              margin: 0,
              maxHeight: '220px',
              overflow: 'auto',
              padding: '10px',
              whiteSpace: 'pre-wrap',
            }}
          >
            {parserEntries
              .map(
                (entry) =>
                  `Raw: ${entry.rawText}\nLabel: ${entry.detectedLabel}\nValue: ${entry.detectedValue}`,
              )
              .join('\n\n')}
          </pre>
        )}
      </section>
    );
  });
}

function PDFExtractionDebugView({
  pdfAExtraction,
  pdfBExtraction,
}: PDFExtractionDebugViewProps) {
  return (
    <section
      aria-label="PDF extraction debug view"
      style={{
        border: '1px solid #ccc',
        marginTop: '16px',
        padding: '16px',
      }}
    >
      <h2>PDF Extraction Debug View</h2>

      <div
        style={{
          display: 'grid',
          gap: '16px',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        }}
      >
        <section>
          <h3>PDF A Extracted Text</h3>
          {renderExtractedPages(pdfAExtraction)}
        </section>
        <section>
          <h3>PDF B Extracted Text</h3>
          {renderExtractedPages(pdfBExtraction)}
        </section>
      </div>
    </section>
  );
}

export default PDFExtractionDebugView;
