import type {
  ComparisonFieldKey,
  ComparisonSettings,
  IgnoreRuleKey,
} from '../types/comparison';

type ComparisonSettingsPanelProps = {
  ignoredDifferenceCount: number;
  settings: ComparisonSettings;
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
  settings,
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
        display: 'grid',
        gap: '12px',
        gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
        marginTop: '10px',
        padding: '12px',
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
    </section>
  );
}

export default ComparisonSettingsPanel;
