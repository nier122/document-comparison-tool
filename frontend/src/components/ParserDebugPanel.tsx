import { useState } from 'react';
import type { Difference, ParserDebugSide } from '../types/comparison';

type ParserDebugPanelProps = {
  differences: Difference[];
};

function DebugValue({
  label,
  value,
}: {
  label: string;
  value: string | undefined;
}) {
  return (
    <div>
      <strong>{label}</strong>
      <pre
        style={{
          background: '#f9fafb',
          border: '1px solid #d1d5db',
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
          fontSize: '12px',
          margin: '4px 0 0',
          overflowWrap: 'anywhere',
          padding: '8px',
          whiteSpace: 'pre-wrap',
        }}
      >
        {value ?? '[Not present]'}
      </pre>
    </div>
  );
}

function ParserSide({
  title,
  side,
}: {
  title: string;
  side: ParserDebugSide | undefined;
}) {
  return (
    <section style={{ display: 'grid', gap: '8px', minWidth: 0 }}>
      <h4 style={{ margin: 0 }}>{title}</h4>
      <DebugValue label="Raw Extracted Text" value={side?.rawExtractedText} />
      <DebugValue label="Parsed Label" value={side?.parsedLabel} />
      <DebugValue label="Parsed Value" value={side?.parsedValue} />
      <DebugValue label="Normalized Label" value={side?.normalizedLabel} />
      <DebugValue label="Normalized Value" value={side?.normalizedValue} />
    </section>
  );
}

function ParserDebugPanel({ differences }: ParserDebugPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const fieldDifferences = differences.filter(
    (difference) =>
      difference.isFieldDifference && difference.parserDebug !== undefined,
  );

  return (
    <section
      aria-label="Parser Debug"
      style={{
        border: '1px solid #7c3aed',
        marginTop: '12px',
        padding: '12px',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <h2 style={{ fontSize: '16px', margin: 0 }}>
          Parser Debug ({fieldDifferences.length})
        </h2>
        <button type="button" onClick={() => setIsCollapsed((current) => !current)}>
          {isCollapsed ? 'Open Parser Debug' : 'Collapse Parser Debug'}
        </button>
      </div>

      {isCollapsed ? null : fieldDifferences.length === 0 ? (
        <p>No field differences are available for parser tracing.</p>
      ) : (
        <div style={{ display: 'grid', gap: '12px', marginTop: '12px' }}>
          {fieldDifferences.map((difference) => (
            <article
              key={difference.id}
              style={{
                background: '#faf5ff',
                border: '1px solid #d8b4fe',
                padding: '12px',
              }}
            >
              <h3 style={{ fontSize: '15px', margin: '0 0 10px' }}>
                {difference.fieldLabel ?? difference.id}
              </h3>
              <div
                style={{
                  display: 'grid',
                  gap: '12px',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                }}
              >
                <ParserSide title="PDF A / Before" side={difference.parserDebug?.before} />
                <ParserSide title="PDF B / After" side={difference.parserDebug?.after} />
              </div>
              <div style={{ marginTop: '10px' }}>
                <DebugValue
                  label="Final Difference"
                  value={difference.parserDebug?.finalDifference}
                />
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

export default ParserDebugPanel;
