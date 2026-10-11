import { describe, it, expect } from 'vitest';
import { compareRows, defaultKeepBoth } from './addAdd.ts';

describe('defaultKeepBoth', () => {
  it('keeps Copy 1\'s key and suffixes Copy 2\'s', () => {
    expect(defaultKeepBoth('INV-1031')).toEqual({ keepBoth: { aKey: 'INV-1031', bKey: 'INV-1031-B' } });
  });
});

describe('compareRows', () => {
  it('lines the two rows up and marks the fields they disagree on', () => {
    const rows = compareRows(
      [
        { column: 'Invoice No', value: 'INV-4' },
        { column: 'Customer', value: 'Delta (Ravi)' },
        { column: 'Qty', value: 5 },
      ],
      [
        { column: 'Invoice No', value: 'INV-4' },
        { column: 'Customer', value: 'Delta (Priya)' },
        { column: 'Qty', value: 5 },
      ],
    );
    expect(rows.map((r) => [r.column, r.differs])).toEqual([
      ['Invoice No', false],
      ['Customer', true],
      ['Qty', false],
    ]);
    expect(rows[1]).toMatchObject({ a: 'Delta (Ravi)', b: 'Delta (Priya)' });
  });

  it('shows a column only one copy filled in, and keeps Copy 1\'s order first', () => {
    const rows = compareRows(
      [{ column: 'B', value: 1 }],
      [
        { column: 'A', value: 2 },
        { column: 'B', value: 1 },
      ],
    );
    expect(rows.map((r) => r.column)).toEqual(['B', 'A']);
    expect(rows[1]).toEqual({ column: 'A', a: '—', b: '2', differs: true });
  });

  it('shows a formula as =formula, and treats a different formula as a difference', () => {
    const [row] = compareRows([{ column: 'Amount', formula: 'C5*D5' }], [{ column: 'Amount', formula: 'C5*D5*2' }]);
    expect(row).toEqual({ column: 'Amount', a: '=C5*D5', b: '=C5*D5*2', differs: true });
  });
});
