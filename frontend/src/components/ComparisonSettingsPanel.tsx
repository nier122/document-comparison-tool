import type {
  ComparisonFieldKey,
  ComparisonSettings,
  IgnoreRuleKey,
} from '../types/comparison';

type ComparisonSettingsPanelProps = {
  ignoredDifferenceCount: number;
  isCollapsed: boolean;
  settings: ComparisonSettings;
  onCollapseChange: (isCollapsed: boolean) => void;
  onSettingsChange: (settings: ComparisonSettings) => void;
};

const fieldOptions: { key: ComparisonFieldKey; label: string }[] = [
  { key: 'poNumber', label: 'PO Number' },
  { key: 'invoiceNumber', label: 'Invoice Number' },
  { key: 'date', label: 'Date' },
  { key: 'quantity', label: 'Quantity' },
  { key: 'amount', label: 'Amount' },
  { key: 'total', label: 'Total' },
  { key: 'itemDescription', label: 'Item Description' },
  { key: 'remarks', label: 'Remarks' },
];

const ignoreOptions: { key: IgnoreRuleKey; label: string }[] = [
  { key: 'pageNumbers', label: 'Page numbers' },
  { key: 'printDates', label: 'Print dates' },
  { key: 'generatedDates', label: 'Generated dates' },
  { key: 'footerText', label: 'Footer text' },
  { key: 'headerText', label: 'Header text' },
  { key: 'companyAddress', label: 'Company address' },
  { key: 'boilerplateTerms', label: 'Boilerplate terms' },
];

function ComparisonSettingsPanel({
  ignoredDifferenceCount,
  isCollapsed,
  settings,
  onCollapseChange,
  onSettingsChange,
}: ComparisonSettingsPanelProps) {
  function updateImportantField(fieldKey: ComparisonFieldKey, isImportant: boolean) {
    onSettingsChange({
      ...settings,
      importantFields: {
        ...settings.importantFields,
        [fieldKey]: isImportant,
      },
    });
  }

  function updateIgnoreRule(ruleKey: IgnoreRuleKey, shouldIgnore: boolean) {
    onSettingsChange({
      ...settings,
      ignoreRules: {
        ...settings.ignoreRules,
        [ruleKey]: shouldIgnore,
      },
    });
  }

  function updateShowIgnoredDifferences(showIgnoredDifferences: boolean) {
    onSettingsChange({
      ...settings,
      showIgnoredDifferences,
    });
  }

  return (
    <section
      aria-label="Comparison settings"
      style={{
        border: '1px solid #d1d5db',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
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
        <h2 style={{ fontSize: '16px', margin: 0 }}>Comparison Settings</h2>
        <button type="button" onClick={() => onCollapseChange(!isCollapsed)}>
          {isCollapsed ? 'Open' : 'Collapse'}
        </button>
      </div>

      {isCollapsed ? null : (
        <div
          style={{
            display: 'grid',
            gap: '16px',
            gridTemplateColumns: 'repeat(3, minmax(220px, 1fr))',
            marginTop: '12px',
            minHeight: 0,
            overflow: 'auto',
          }}
        >
          <div>
            <h3 style={{ margin: '0 0 8px' }}>Important Fields</h3>
            <div style={{ display: 'grid', gap: '6px' }}>
              {fieldOptions.map((fieldOption) => (
                <label key={fieldOption.key}>
                  <input
                    checked={settings.importantFields[fieldOption.key]}
                    onChange={(event) => updateImportantField(fieldOption.key, event.target.checked)}
                    type="checkbox"
                  />{' '}
                  {fieldOption.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px' }}>Ignore Noise</h3>
            <div style={{ display: 'grid', gap: '6px' }}>
              {ignoreOptions.map((ignoreOption) => (
                <label key={ignoreOption.key}>
                  <input
                    checked={settings.ignoreRules[ignoreOption.key]}
                    onChange={(event) => updateIgnoreRule(ignoreOption.key, event.target.checked)}
                    type="checkbox"
                  />{' '}
                  {ignoreOption.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ margin: '0 0 8px' }}>Debug</h3>
            <label>
              <input
                checked={settings.showIgnoredDifferences}
                onChange={(event) => updateShowIgnoredDifferences(event.target.checked)}
                type="checkbox"
              />{' '}
              Show ignored differences ({ignoredDifferenceCount})
            </label>
          </div>
        </div>
      )}
    </section>
  );
}

export default ComparisonSettingsPanel;
