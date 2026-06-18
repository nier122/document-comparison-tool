import { useMemo, useState } from 'react';
import type {
  Difference,
  DifferenceCategory,
  DifferenceSeverity,
  DifferenceTextPart,
} from '../types/comparison';

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

type SeveritySort = 'document' | 'high-to-low' | 'low-to-high';

const differenceCategories: DifferenceCategory[] = [
  'Identifier Change',
  'Quantity Change',
  'Amount Change',
  'Date Change',
  'Text Wording Change',
  'Metadata Change',
  'Table Value Change',
  'Unknown',
];

const severityRank: Record<DifferenceSeverity, number> = {
  High: 3,
  Medium: 2,
  Low: 1,
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

function getSeverityStyle(severity: DifferenceSeverity) {
  switch (severity) {
    case 'High':
      return {
        background: '#fee2e2',
        color: '#991b1b',
      };
    case 'Medium':
      return {
        background: '#fef3c7',
        color: '#92400e',
      };
    case 'Low':
      return {
        background: '#e5e7eb',
        color: '#374151',
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
  const [categoryFilter, setCategoryFilter] = useState<DifferenceCategory | 'All'>('All');
  const [severitySort, setSeveritySort] = useState<SeveritySort>('document');
  const displayedDifferences = useMemo(() => {
    const filteredDifferences =
      categoryFilter === 'All'
        ? differences
        : differences.filter(
            (difference) => (difference.category ?? 'Unknown') === categoryFilter,
          );

    if (severitySort === 'document') {
      return filteredDifferences;
    }

    const sortDirection = severitySort === 'high-to-low' ? -1 : 1;

    return [...filteredDifferences].sort((differenceA, differenceB) => {
      const severityA = severityRank[differenceA.severity ?? 'Low'];
      const severityB = severityRank[differenceB.severity ?? 'Low'];

      return (severityA - severityB) * sortDirection;
    });
  }, [categoryFilter, differences, severitySort]);
  const displayedDifferenceIndex = selectedDifferenceId
    ? displayedDifferences.findIndex((difference) => difference.id === selectedDifferenceId)
    : -1;
  const selectedDifferenceNumber =
    displayedDifferenceIndex >= 0
      ? displayedDifferenceIndex + 1
      : currentDifferenceIndex >= 0 && categoryFilter === 'All' && severitySort === 'document'
        ? currentDifferenceIndex + 1
        : null;
  const currentDifferenceLabel =
    selectedDifferenceNumber === null
      ? `No difference selected (${displayedDifferences.length} shown)`
      : `Difference ${selectedDifferenceNumber} of ${displayedDifferences.length}`;
  const fieldDifferences = displayedDifferences.filter((difference) => difference.isFieldDifference);
  const textDifferences = displayedDifferences.filter((difference) => !difference.isFieldDifference);

  function selectDisplayedDifference(nextIndex: number, fallback?: () => void) {
    const nextDifference = displayedDifferences[nextIndex];

    if (nextDifference !== undefined && onDifferenceSelect !== undefined) {
      onDifferenceSelect(nextDifference);
      return;
    }

    fallback?.();
  }

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
            const category = difference.category ?? 'Unknown';
            const severity = difference.severity ?? 'Low';

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
                      <div
                        style={{
                          alignItems: 'center',
                          display: 'flex',
                          flexWrap: 'wrap',
                          gap: '6px',
                          marginTop: '6px',
                        }}
                      >
                        <span
                          style={{
                            background: '#e0f2fe',
                            color: '#075985',
                            fontSize: '12px',
                            padding: '2px 6px',
                          }}
                        >
                          {category}
                        </span>
                        <span
                          style={{
                            ...getSeverityStyle(severity),
                            fontSize: '12px',
                            fontWeight: 700,
                            padding: '2px 6px',
                          }}
                        >
                          {severity}
                        </span>
                      </div>
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
                  {difference.ignoredReason !== undefined ? (
                    <p style={{ color: '#6b7280', margin: '10px 0 0' }}>
                      Ignored: {difference.ignoredReason}
                    </p>
                  ) : null}
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
            disabled={displayedDifferenceIndex <= 0}
            onClick={() =>
              selectDisplayedDifference(displayedDifferenceIndex - 1, onPreviousDifference)
            }
          >
            Previous Difference
          </button>
          <span>{currentDifferenceLabel}</span>
          <button
            type="button"
            disabled={
              displayedDifferences.length === 0 ||
              (displayedDifferenceIndex !== -1 &&
                displayedDifferenceIndex >= displayedDifferences.length - 1)
            }
            onClick={() =>
              selectDisplayedDifference(
                displayedDifferenceIndex === -1 ? 0 : displayedDifferenceIndex + 1,
                onNextDifference,
              )
            }
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
          <div
            style={{
              display: 'grid',
              gap: '8px',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              marginBottom: '12px',
            }}
          >
            <label style={{ display: 'grid', gap: '4px' }}>
              <span>Category</span>
              <select
                aria-label="Filter differences by category"
                onChange={(event) =>
                  setCategoryFilter(event.target.value as DifferenceCategory | 'All')
                }
                value={categoryFilter}
              >
                <option value="All">All categories</option>
                {differenceCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: 'grid', gap: '4px' }}>
              <span>Sort</span>
              <select
                aria-label="Sort differences by severity"
                onChange={(event) => setSeveritySort(event.target.value as SeveritySort)}
                value={severitySort}
              >
                <option value="document">Document order</option>
                <option value="high-to-low">Severity: High to Low</option>
                <option value="low-to-high">Severity: Low to High</option>
              </select>
            </label>
          </div>
          <div style={{ overflow: 'auto', paddingRight: '2px' }}>
            {displayedDifferences.length === 0 ? (
              <p>No differences match the selected category.</p>
            ) : (
              <>
                {renderDifferenceList('Field Differences', fieldDifferences)}
                {renderDifferenceList('Text Differences', textDifferences)}
              </>
            )}
          </div>
        </>
      )}
    </section>
  );
}

export default DifferencePanel;
