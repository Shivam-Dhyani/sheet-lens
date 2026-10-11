import type { KeepBothResolution, RowCell } from '@shivam-dhyani/sheet-diff';
import { formatValue } from '../../lib/format.ts';

/** The starting point for "keep both": Copy 1's row keeps its key, Copy 2's gets a suffix. */
export function defaultKeepBoth(key: string): KeepBothResolution {
  return { keepBoth: { aKey: key, bKey: `${key}-B` } };
}

export interface RowCompare {
  column: string;
  a: string;
  b: string;
  /** The two copies disagree on this field. */
  differs: boolean;
}

function show(cell: RowCell | undefined): string {
  if (!cell) return '—';
  if (cell.formula !== undefined) return `=${cell.formula}`;
  return formatValue(cell.value ?? null, cell.column);
}

/**
 * The two added rows lined up field by field, in Copy 1's column order followed by any
 * column only Copy 2 filled in. This is what a person needs to choose between them.
 */
export function compareRows(aCells: RowCell[], bCells: RowCell[]): RowCompare[] {
  const a = new Map(aCells.map((c) => [c.column, c]));
  const b = new Map(bCells.map((c) => [c.column, c]));
  const columns = [...a.keys(), ...[...b.keys()].filter((k) => !a.has(k))];
  return columns.map((column) => {
    const left = show(a.get(column));
    const right = show(b.get(column));
    return { column, a: left, b: right, differs: left !== right };
  });
}
