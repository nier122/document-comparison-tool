import type { Difference } from '../types/comparison';

type DifferencePanelProps = {
  differences?: Difference[];
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

function DifferencePanel({ differences = [] }: DifferencePanelProps) {
  return (
    <section
      style={{
        marginTop: '16px',
        border: '1px solid #ccc',
        padding: '16px',
        height: '200px',
        overflow: 'auto',
      }}
    >
      <h2>Differences</h2>

      {differences.length === 0 ? (
        <p>No differences detected.</p>
      ) : (
        <ul>
          {differences.map((difference) => (
            <li key={difference.id}>
              <strong>{difference.type}</strong> - {getPageLabel(difference)}
              <p>{getDifferencePreview(difference)}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default DifferencePanel;
