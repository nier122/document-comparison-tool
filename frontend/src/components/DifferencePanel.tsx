import type { Difference } from '../types/comparison';

type DifferencePanelProps = {
  differences?: Difference[];
};

function DifferencePanel({ differences = [] }: DifferencePanelProps) {
  return (
    <section
      style={{
        marginTop: '16px',
        border: '1px solid #ccc',
        padding: '16px',
        height: '200px',
      }}
    >
      <h2>Differences</h2>

      {differences.length === 0 ? (
        <p>No documents loaded.</p>
      ) : (
        <ul>
          {differences.map((difference) => (
            <li key={difference.id}>{difference.type}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default DifferencePanel;
