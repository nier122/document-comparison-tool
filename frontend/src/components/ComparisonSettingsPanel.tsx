import { useState } from 'react';
import type {
  ComparisonSettings,
  ImportantFieldSetting,
  IgnoreRuleKey,
} from '../types/comparison';

type ComparisonSettingsPanelProps = {
  ignoredDifferenceCount: number;
  isCollapsed: boolean;
  settings: ComparisonSettings;
  onCollapseChange: (isCollapsed: boolean) => void;
  onSettingsChange: (settings: ComparisonSettings) => void;
};

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
  const [newFieldLabel, setNewFieldLabel] = useState('');

  function updateImportantField(fieldKey: string, isImportant: boolean) {
    onSettingsChange({
      ...settings,
      importantFields: settings.importantFields.map((field) =>
        field.key === fieldKey ? { ...field, enabled: isImportant } : field,
      ),
    });
  }

  function getCustomFieldKey(label: string) {
    const normalizedLabel = label
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
      .replace(/\s+(.)/g, (_, character: string) => character.toUpperCase());

    return `custom:${normalizedLabel}`;
  }

  function addImportantField() {
    const label = newFieldLabel.trim();

    if (label.length === 0) {
      return;
    }

    const key = getCustomFieldKey(label);
    const existingField = settings.importantFields.find(
      (field) => field.key === key || field.label.toLowerCase() === label.toLowerCase(),
    );

    if (existingField !== undefined) {
      updateImportantField(existingField.key, true);
      setNewFieldLabel('');
      return;
    }

    const customField: ImportantFieldSetting = {
      key,
      label,
      enabled: true,
      isCustom: true,
    };

    onSettingsChange({
      ...settings,
      importantFields: [...settings.importantFields, customField],
    });
    setNewFieldLabel('');
  }

  function removeCustomField(fieldKey: string) {
    onSettingsChange({
      ...settings,
      importantFields: settings.importantFields.filter((field) => field.key !== fieldKey),
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
              {settings.importantFields.map((field) => (
                <div
                  key={field.key}
                  style={{
                    alignItems: 'center',
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'space-between',
                  }}
                >
                  <label>
                    <input
                      checked={field.enabled}
                      onChange={(event) => updateImportantField(field.key, event.target.checked)}
                      type="checkbox"
                    />{' '}
                    {field.label}
                  </label>
                  {field.isCustom ? (
                    <button type="button" onClick={() => removeCustomField(field.key)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <input
                  aria-label="Add important field"
                  onChange={(event) => setNewFieldLabel(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addImportantField();
                    }
                  }}
                  placeholder="Add important field"
                  style={{ flex: 1, minWidth: 0 }}
                  type="text"
                  value={newFieldLabel}
                />
                <button type="button" onClick={addImportantField}>
                  Add Field
                </button>
              </div>
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
