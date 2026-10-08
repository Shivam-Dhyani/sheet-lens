import { describe, it, expect } from 'vitest';
import { formatValue, isAmountColumn, serialToDisplayDate } from './format.ts';

describe('format', () => {
  it('formats amount columns as Indian rupees', () => {
    expect(formatValue(123456.78, 'GST Amount (₹)')).toMatch(/₹1,23,456\.78/);
    expect(isAmountColumn('Invoice Total (₹)')).toBe(true);
  });

  it('treats percentage columns as percentages, not currency', () => {
    expect(isAmountColumn('GST %')).toBe(false);
    expect(formatValue(0.18, 'GST %')).toBe('18%');
    expect(formatValue(0.05, 'GST %')).toBe('5%');
  });

  it('renders plain numbers and text', () => {
    expect(formatValue(42, 'Qty')).toBe('42');
    expect(formatValue('INV-1001', 'Invoice No')).toBe('INV-1001');
    expect(formatValue(null, 'Qty')).toBe('—');
  });

  it('converts Excel serials to DD-MMM-YYYY', () => {
    // 46266 = 01-Sep-2026 in the fixtures.
    expect(serialToDisplayDate(46266)).toBe('01-Sep-2026');
  });
});
