import type { Difference, DifferenceTextPart } from '../types/comparison';

type DifferencePanelProps = {
  currentDifferenceIndex?: number;
  differences?: Difference[];
  isCollapsed?: boolean;
  selectedDifferenceId?: string;
  onCollapseChange?: (isCollapsed: boolean) => void;
  onDifferenceSelect?: (difference: Difference) => void;
  onNextDifference?: () => void;
  onPreviousDifference?: () => void;
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
        background: '#f0fdf4',
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

function getCompactContext(text: string) {
  const words = text.match(/\S+/g) ?? [];

  if (words.length <= 12) {
    return text;
  }

  return `${words.slice(0, 6).join(' ')} ... ${words.slice(-6).join(' ')}`;
}

function renderCompactParts(parts: DifferenceTextPart[] | undefined) {
  if (parts === undefined || parts.length === 0) {
    return <span style={{ color: '#6b7280' }}>No word-level details available</span>;
  }

  return parts.map((part, index) => {
    const text = part.type === 'unchanged' ? getCompactContext(part.text) : part.text;

    return (
      <span key={`${part.type}-${index}`} style={getPartStyle(part.type)}>
        {text}
        {index < parts.length - 1 ? ' ' : ''}
      </span>
    );
  });
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
        {renderCompactParts(difference.inlineParts)}
      </p>
    </div>
  );
}

function renderLegend() {
  return (
    <div
      aria-label="Highlight legend"
      style={{
        background: '#f9fafb',
        border: '1px solid #d1d5db',
        display: 'grid',
        gap: '6px',
        marginBottom: '12px',
        padding: '10px',
      }}
    >
      <strong>Legend</strong>
      <span>
        <mark style={{ background: '#fecaca', color: '#7f1d1d', padding: '0 4px' }}>Red</mark>{' '}
        = Before / removed text from PDF A
      </span>
      <span>
        <mark style={{ background: '#bbf7d0', color: '#14532d', padding: '0 4px' }}>Green</mark>{' '}
        = After / added text from PDF B
      </span>
    </div>
  );
}

function renderFieldDifference(difference: Difference) {
  return (
    <div
      style={{
        background: '#f9fafb',
        border: '1px solid #d1d5db',
        display: 'grid',
        gap: '8px',
        marginTop: '12px',
        padding: '10px',
      }}
    >
      <strong>{difference.fieldLabel ?? 'Detected Field'}</strong>
      <div>
        <span style={{ color: '#4b5563' }}>Before: </span>
        {difference.textBefore === undefined ? (
          <span style={{ color: '#6b7280' }}>Not present in PDF A</span>
        ) : (
          <mark style={{ background: '#fecaca', color: '#7f1d1d', padding: '0 4px' }}>
            {difference.textBefore}
          </mark>
        )}
      </div>
      <div>
        <span style={{ color: '#4b5563' }}>After: </span>
        {difference.textAfter === undefined ? (
          <span style={{ color: '#6b7280' }}>Not present in PDF B</span>
        ) : (
          <mark style={{ background: '#bbf7d0', color: '#14532d', padding: '0 4px' }}>
            {difference.textAfter}
          </mark>
        )}
      </div>
    </div>
  );
}

function DifferencePanel({
  currentDifferenceIndex = -1,
  differences = [],
  isCollapsed = false,
  selectedDifferenceId,
  onCollapseChange,
  onDifferenceSelect,
  onNextDifference,
  onPreviousDifference,
}: DifferencePanelProps) {
  const selectedDifferenceNumber = currentDifferenceIndex >= 0 ? currentDifferenceIndex + 1 : null;
  const currentDifferenceLabel =
    selectedDifferenceNumber === null
      ? `No difference selected (${differences.length} total)`
      : `Difference ${selectedDifferenceNumber} of ${differences.length}`;
  const fieldDifferences = differences.filter((difference) => difference.isFieldDifference);
  const textDifferences = differences.filter((difference) => !difference.isFieldDifference);

  function renderDifferenceList(title: string, sectionDifferences: Difference[]) {
    if (sectionDifferences.length === 0) {
      return null;
    }

    return (
      <section style={{ marginBottom: '18px' }}>
        <h3 style={{ margin: '0 0 10px' }}>
          {title} ({sectionDifferences.length})
        </h3>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {sectionDifferences.map((difference) => {
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
                      <strong>
                        {difference.isFieldDifference
                          ? 'Field Difference'
                          : formatDifferenceType(difference.type)}
                      </strong>
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

                  {difference.isFieldDifference ? (
                    renderFieldDifference(difference)
                  ) : difference.type === 'modified' ? (
                    renderInlineDifference(difference)
                  ) : (
                    <p style={{ margin: '12px 0 0', whiteSpace: 'pre-wrap' }}>
                      {difference.type === 'deleted'
                        ? difference.textBefore
                        : difference.textAfter}
                    </p>
                  )}
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    );
  }

  return (
    <section
      aria-label="Detected differences"
      style={{
        border: '1px solid #ccc',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        padding: '16px',
      }}
    >
      <div
        style={{
          alignItems: 'center',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '12px',
          justifyContent: 'space-between',
          marginBottom: '12px',
        }}
      >
        <h2
          style={{
            margin: 0,
            writingMode: isCollapsed ? 'vertical-rl' : 'horizontal-tb',
          }}
        >
          {isCollapsed ? `Differences (${differences.length})` : `Differences (${differences.length})`}
        </h2>
        <button type="button" onClick={() => onCollapseChange?.(!isCollapsed)}>
          {isCollapsed ? 'Open' : 'Collapse'}
        </button>
        {!isCollapsed ? (
        <div style={{ alignItems: 'center', display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
          <button
            type="button"
            disabled={currentDifferenceIndex <= 0}
            onClick={onPreviousDifference}
          >
            Previous Difference
          </button>
          <span>{currentDifferenceLabel}</span>
          <button
            type="button"
            disabled={
              differences.length === 0 ||
              (currentDifferenceIndex !== -1 && currentDifferenceIndex >= differences.length - 1)
            }
            onClick={onNextDifference}
          >
            Next Difference
          </button>
        </div>
        ) : null}
      </div>

      {isCollapsed ? null : differences.length === 0 ? (
        <p>No differences detected.</p>
      ) : (
        <>
          {renderLegend()}
          <div style={{ overflow: 'auto', paddingRight: '2px' }}>
            {renderDifferenceList('Field Differences', fieldDifferences)}
            {renderDifferenceList('Text Differences', textDifferences)}
          </div>
        </>
      )}
    </section>
  );
}

export default DifferencePanel;
