import type { Difference, DifferenceTextPart } from '../types/comparison';

type DifferencePanelProps = {
  differences?: Difference[];
  selectedDifferenceId?: string;
  onDifferenceSelect?: (difference: Difference) => void;
};

function getPageLabel(difference: Difference) {
  if (difference.pageA !== undefined && difference.pageB !== undefined) {
    return `PDF A page ${difference.pageA} / PDF B page ${difference.pageB}`;
  }

  if (difference.pageA !== undefined) {
    return `PDF A page ${difference.pageA}`;
  }

  if (difference.pageB !== undefined) {
    return `PDF B page ${difference.pageB}`;
  }

  return 'Page unknown';
}

function formatDifferenceType(type: Difference['type']) {
  switch (type) {
    case 'added':
      return 'Added';
    case 'deleted':
      return 'Deleted';
    case 'modified':
      return 'Modified';
  }
}

function getDifferenceTone(type: Difference['type']) {
  switch (type) {
    case 'added':
      return {
        background: '#ecfdf5',
        border: '#10b981',
      };
    case 'deleted':
      return {
        background: '#fef2f2',
        border: '#ef4444',
      };
    case 'modified':
      return {
        background: '#fffbeb',
        border: '#f59e0b',
      };
  }
}

function renderText(text: string | undefined, emptyLabel: string) {
  if (text === undefined || text.length === 0) {
    return <span style={{ color: '#6b7280' }}>{emptyLabel}</span>;
  }

  return text;
}

function getPartStyle(type: DifferenceTextPart['type']) {
  switch (type) {
    case 'added':
      return {
        background: '#bbf7d0',
        color: '#14532d',
        fontWeight: 700,
      };
    case 'deleted':
      return {
        background: '#fecaca',
        color: '#7f1d1d',
        fontWeight: 700,
        textDecoration: 'line-through',
      };
    case 'unchanged':
      return {
        background: 'transparent',
        color: 'inherit',
        fontWeight: 400,
      };
  }
}

function renderTextParts(
  parts: DifferenceTextPart[] | undefined,
  fallbackText: string | undefined,
  emptyLabel: string,
) {
  if (parts === undefined || parts.length === 0) {
    return renderText(fallbackText, emptyLabel);
  }

  return parts.map((part, index) => (
    <span key={`${part.type}-${index}`} style={getPartStyle(part.type)}>
      {part.text}
      {index < parts.length - 1 ? ' ' : ''}
    </span>
  ));
}

function renderInlineDifference(difference: Difference) {
  if (difference.inlineParts === undefined || difference.inlineParts.length === 0) {
    return null;
  }

  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #d1d5db',
        marginTop: '12px',
        padding: '10px',
      }}
    >
      <strong>Changed words</strong>
      <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
        {renderTextParts(difference.inlineParts, undefined, 'No word-level changes found')}
      </p>
    </div>
  );
}

function DifferencePanel({
  differences = [],
  selectedDifferenceId,
  onDifferenceSelect,
}: DifferencePanelProps) {
  return (
    <section
      aria-label="Detected differences"
      style={{
        marginTop: '16px',
        border: '1px solid #ccc',
        padding: '16px',
        height: '420px',
        minHeight: '220px',
        maxHeight: '78vh',
        overflow: 'auto',
        resize: 'vertical',
      }}
    >
      <h2>Differences ({differences.length})</h2>

      {differences.length === 0 ? (
        <p>No differences detected.</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {differences.map((difference) => {
            const isSelected = difference.id === selectedDifferenceId;
            const tone = getDifferenceTone(difference.type);

            return (
              <li key={difference.id} style={{ marginBottom: '14px' }}>
                <article
                  aria-current={isSelected ? 'true' : undefined}
                  onClick={() => onDifferenceSelect?.(difference)}
                  style={{
                    border: isSelected ? '2px solid #4f46e5' : `1px solid ${tone.border}`,
                    background: isSelected ? '#eef2ff' : '#fff',
                    cursor: 'pointer',
                    padding: '12px',
                  }}
                >
                  <div
                    style={{
                      alignItems: 'center',
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '8px',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>{formatDifferenceType(difference.type)}</strong>
                      <span style={{ color: '#4b5563', marginLeft: '8px' }}>
                        {getPageLabel(difference)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDifferenceSelect?.(difference);
                      }}
                    >
                      Go To Difference
                    </button>
                  </div>

                  {difference.type === 'modified' ? renderInlineDifference(difference) : null}

                  <div
                    style={{
                      display: 'grid',
                      gap: '12px',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                      marginTop: '12px',
                    }}
                  >
                    <div
                      style={{
                        background: difference.type === 'added' ? '#f9fafb' : '#fff',
                        border: '1px solid #d1d5db',
                        padding: '10px',
                      }}
                    >
                      <strong>Before</strong>
                      <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                        {renderTextParts(
                          difference.beforeParts,
                          difference.textBefore,
                          'No matching text in PDF A',
                        )}
                      </p>
                    </div>
                    <div
                      style={{
                        background: tone.background,
                        border: `1px solid ${tone.border}`,
                        padding: '10px',
                      }}
                    >
                      <strong>After</strong>
                      <p style={{ marginBottom: 0, whiteSpace: 'pre-wrap' }}>
                        {renderTextParts(
                          difference.afterParts,
                          difference.textAfter,
                          'No matching text in PDF B',
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DifferencePanel;
