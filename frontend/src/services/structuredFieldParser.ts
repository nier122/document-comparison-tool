export type PositionedCell = {
  text: string;
  x: number;
  width: number;
};

export type TableColumn<T> = {
  field: T;
  x: number;
};

export type TableFieldValue<T, TCell extends PositionedCell> = {
  field: T;
  value: string;
  cells: TCell[];
};

export function parseStructuredFieldText<T>(
  rawText: string,
  aliases: FieldLabelAlias<T>[],
) {
  const parsed = parseFieldLabelAtStart(rawText, aliases);

  if (
    parsed === undefined ||
    parsed.valueText.length === 0 ||
    isFieldLabelSuffix(parsed.valueText)
  ) {
    return undefined;
  }

  return parsed;
}

export function findFirstRealFieldValue<T>(
  values: T[],
  getText: (value: T) => string,
  isValidValue: (text: string) => boolean,
  isLabelSuffix: (text: string) => boolean,
) {
  return values.find((value) => {
    const text = normalizeCellText(getText(value));

    return !isLabelSuffix(text) && isValidValue(text);
  });
}

export function selectFieldValueFromText(
  text: string,
  isValidValue: (value: string) => boolean,
) {
  const normalizedText = normalizeCellText(text);
  const candidates = [
    ...normalizedText.split(/\s*\|\s*/),
    ...normalizedText.split(/\s+/),
  ]
    .map(normalizeCellText)
    .filter(Boolean);

  return candidates.find(
    (candidate) =>
      !isFieldLabelSuffix(candidate) && isValidValue(candidate),
  );
}

export function detectTableHeaderColumns<T, TCell extends PositionedCell>(
  cells: TCell[],
  resolveField: (label: string) => T | undefined,
): TableColumn<T>[] {
  const columns: TableColumn<T>[] = [];
  let cellIndex = 0;

  while (cellIndex < cells.length) {
    const cell = cells[cellIndex];
    const nextCell = cells[cellIndex + 1];
    const combinedLabel =
      nextCell === undefined
        ? ''
        : normalizeCellText(`${cell.text} ${nextCell.text}`);
    const combinedField =
      nextCell === undefined ? undefined : resolveField(combinedLabel);
    const singleField = resolveField(normalizeCellText(cell.text));
    const field = combinedField ?? singleField;

    if (field === undefined) {
      cellIndex += 1;
      continue;
    }

    const headerCells =
      combinedField === undefined || nextCell === undefined
        ? [cell]
        : [cell, nextCell];
    const left = Math.min(...headerCells.map((headerCell) => headerCell.x));
    const right = Math.max(
      ...headerCells.map((headerCell) => headerCell.x + headerCell.width),
    );

    columns.push({
      field,
      x: (left + right) / 2,
    });
    cellIndex += headerCells.length;
  }

  return columns.sort((columnA, columnB) => columnA.x - columnB.x);
}

function normalizeCellText(text: string) {
  return text.normalize('NFKC').replace(/\s+/g, ' ').trim();
}

export function mapTableRowToColumns<T, TCell extends PositionedCell>(
  columns: TableColumn<T>[],
  rowCells: TCell[],
): TableFieldValue<T, TCell>[] {
  const sortedColumns = [...columns].sort(
    (columnA, columnB) => columnA.x - columnB.x,
  );

  return sortedColumns
    .map((column, columnIndex) => {
      const leftBoundary =
        columnIndex === 0
          ? Number.NEGATIVE_INFINITY
          : (sortedColumns[columnIndex - 1].x + column.x) / 2;
      const rightBoundary =
        columnIndex === sortedColumns.length - 1
          ? Number.POSITIVE_INFINITY
          : (column.x + sortedColumns[columnIndex + 1].x) / 2;
      const cells = rowCells
        .filter((cell) => {
          const centerX = cell.x + cell.width / 2;

          return centerX >= leftBoundary && centerX < rightBoundary;
        })
        .sort((cellA, cellB) => cellA.x - cellB.x);

      return {
        field: column.field,
        value: normalizeCellText(cells.map((cell) => cell.text).join(' ')),
        cells,
      };
    })
    .filter((fieldValue) => fieldValue.value.length > 0);
}
import {
  isFieldLabelSuffix,
  parseFieldLabelAtStart,
} from './fieldLabelParser.ts';
import type { FieldLabelAlias } from './fieldLabelParser.ts';
