import type { Difference } from '../types/comparison';

type DifferencePanelProps = {
  differences?: Difference[];
  selectedDifferenceId?: string;
  onDifferenceSelect?: (difference: Difference) => void;
};

function getPageLabel(difference: Difference) {
  if (difference.pageA !== undefined && difference.pageB !== undefined) {
    return `PDF A page ${difference.pageA}, PDF B page ${difference.pageB}`;
  }

  if (difference.pageA !== undefined) {
    return `PDF A page ${difference.pageA}`;
  }

  if (difference.pageB !== undefined) {
    return `PDF B page ${difference.pageB}`;
  }

  return 'Page unknown';
}

function getDifferencePreview(difference: Difference) {
  const preview = difference.textAfter ?? difference.textBefore ?? '';

  if (preview.length <= 180) {
    return preview;
  }

  return `${preview.slice(0, 180)}...`;
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
        height: '320px',
        minHeight: '160px',
        maxHeight: '70vh',
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

            return (
              <li key={difference.id} style={{ marginBottom: '12px' }}>
                <button
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => onDifferenceSelect?.(difference)}
                  style={{
                    width: '100%',
                    border: isSelected ? '2px solid #4f46e5' : '1px solid #ccc',
                    background: isSelected ? '#eef2ff' : '#fff',
                    color: '#1f2937',
                    cursor: 'pointer',
                    padding: '10px',
                    textAlign: 'left',
                  }}
                >
                  <strong>{formatDifferenceType(difference.type)}</strong> -{' '}
                  {getPageLabel(difference)}
                  <p style={{ marginBottom: 0 }}>{getDifferencePreview(difference)}</p>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

export default DifferencePanel;
