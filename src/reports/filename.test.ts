import { describe, it, expect } from 'vitest';
import { reportFileName, mergedFileName } from './filename.ts';

describe('reportFileName', () => {
  it('builds SheetLens_{new}_vs_{old}_{date}.{ext}', () => {
    expect(reportFileName('Sales_FINAL.xlsx', 'Sales_v1.xlsx', 'xlsx', new Date('2026-10-09T00:00:00Z'))).toBe(
      'SheetLens_Sales_FINAL_vs_Sales_v1_2026-10-09.xlsx',
    );
  });
});

describe('mergedFileName', () => {
  const now = new Date('2026-10-09T00:00:00Z');
  it('keeps the original stem and dates it (FR-MRG-11)', () => {
    expect(mergedFileName('Sales_Register_Sep2026_ORIGINAL.xlsx', 'xlsx', now)).toBe(
      'Sales_Register_Sep2026_ORIGINAL_MERGED_2026-10-09.xlsx',
    );
  });
  it('keeps the original file type', () => {
    expect(mergedFileName('book.xlsm', 'xlsm', now)).toBe('book_MERGED_2026-10-09.xlsm');
    expect(mergedFileName('data.csv', 'csv', now)).toBe('data_MERGED_2026-10-09.csv');
  });
});
