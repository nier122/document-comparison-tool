import assert from 'node:assert/strict';
import test from 'node:test';
import { parseFieldLabelAtStart } from '../src/services/fieldLabelParser.ts';
import {
  detectTableHeaderColumns,
  findFirstRealFieldValue,
  mapTableRowToColumns,
  parseStructuredFieldText,
} from '../src/services/structuredFieldParser.ts';
import { isFieldLabelSuffix } from '../src/services/fieldLabelParser.ts';

const aliases = [
  'PO',
  'Purchase Order',
  'Invoice',
  'Reference',
  'Customer',
  'Part',
].map((alias) => ({ alias, field: alias }));

const cases = [
  ['PO No. 22884995', 'PO No.', '22884995'],
  ['PO No.: 22884996', 'PO No.', '22884996'],
  ['PO Number 22884996', 'PO Number', '22884996'],
  ['Purchase Order No. 22884996', 'Purchase Order No.', '22884996'],
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

test('skips a split No. token and selects the real PO value', () => {
  const value = findFirstRealFieldValue(
    ['No.', '22884996'],
    (candidate) => candidate,
    (candidate) => /^[A-Z0-9][A-Z0-9./-]*$/i.test(candidate),
    isFieldLabelSuffix,
  );

  assert.equal(value, '22884996');
});

test('structured PO parser returns only the real value for every supported form', () => {
  const poAliases = [
    'po',
    'po no',
    'po number',
    'purchase order',
    'purchase order no',
    'purchase order number',
  ].map((alias) => ({ alias, field: 'PO Number' }));
  const examples = [
    'PO No. 22884996',
    'PO No.: 22884996',
    'PO Number 22884996',
    'Purchase Order No. 22884996',
  ];

  examples.forEach((rawText) => {
    const parsed = parseStructuredFieldText(rawText, poAliases);

    assert.equal(parsed?.field, 'PO Number');
    assert.equal(parsed?.valueText, '22884996');
    assert.notEqual(parsed?.valueText, 'No.');
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

test('maps each table header only to its own value cell', () => {
  const fields = mapTableRowToColumns(
    [
      { field: 'Quantity', x: 100 },
      { field: 'Item Description', x: 300 },
    ],
    [
      { text: '20', x: 85, width: 30 },
      {
        text: 'Navigating the Digital World training material',
        x: 220,
        width: 260,
      },
    ],
  );

  assert.deepEqual(
    fields.map(({ field, value }) => ({ field, value })),
    [
      { field: 'Quantity', value: '20' },
      {
        field: 'Item Description',
        value: 'Navigating the Digital World training material',
      },
    ],
  );
});

test('detects split multi-token headers without mixing adjacent headers', () => {
  const knownHeaders = new Map([
    ['quantity', 'Quantity'],
    ['item description', 'Item Description'],
  ]);
  const columns = detectTableHeaderColumns(
    [
      { text: 'Quantity', x: 70, width: 60 },
      { text: 'Item', x: 220, width: 40 },
      { text: 'Description', x: 265, width: 90 },
    ],
    (label) => knownHeaders.get(label.toLowerCase()),
  );

  assert.deepEqual(
    columns.map((column) => column.field),
    ['Quantity', 'Item Description'],
  );
});

test('joins wrapped cells only within the same table column', () => {
  const fields = mapTableRowToColumns(
    [
      { field: 'Quantity', x: 100 },
      { field: 'Item Description', x: 300 },
    ],
    [
      { text: '20', x: 85, width: 30 },
      { text: 'Navigating the Digital', x: 220, width: 180 },
      { text: 'World training material', x: 225, width: 170 },
    ],
  );

  assert.equal(fields[0].value, '20');
  assert.equal(
    fields[1].value,
    'Navigating the Digital World training material',
  );
});
