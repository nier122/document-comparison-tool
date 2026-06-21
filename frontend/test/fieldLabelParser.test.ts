import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFieldLabelAtStart } from '../src/services/fieldLabelParser.ts';

const aliases = [
  'PO',
  'Invoice',
  'Reference',
  'Customer',
  'Part',
].map((alias) => ({ alias, field: alias }));

const cases = [
  ['PO No. 22884995', 'PO No.', '22884995'],
  ['Invoice No. INV-1001', 'Invoice No.', 'INV-1001'],
  ['Reference No. RFQ-55', 'Reference No.', 'RFQ-55'],
  ['Customer ID C001', 'Customer ID', 'C001'],
  ['Part No. ABC-123', 'Part No.', 'ABC-123'],
] as const;

cases.forEach(([rawText, expectedLabel, expectedValue]) => {
  test(`captures the full label in "${rawText}"`, () => {
    const result = parseFieldLabelAtStart(rawText, aliases);

    assert.equal(result?.labelText, expectedLabel);
    assert.equal(result?.valueText, expectedValue);
  });
});

test('supports other common label suffixes', () => {
  const suffixCases = [
    ['Customer Number C001', 'Customer Number', 'C001'],
    ['Customer # C001', 'Customer #', 'C001'],
    ['Customer Ref. C001', 'Customer Ref.', 'C001'],
    ['Part Code ABC-123', 'Part Code', 'ABC-123'],
    ['Document Type Invoice', 'Document Type', 'Invoice'],
  ] as const;
  const suffixAliases = [
    ...aliases,
    { alias: 'Document', field: 'Document' },
  ];

  suffixCases.forEach(([rawText, expectedLabel, expectedValue]) => {
    const result = parseFieldLabelAtStart(rawText, suffixAliases);

    assert.equal(result?.labelText, expectedLabel);
    assert.equal(result?.valueText, expectedValue);
  });
});
