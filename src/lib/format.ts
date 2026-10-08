import type { Scalar } from '@shivam-dhyani/sheet-diff';

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const AMOUNT_RE = /₹|rs|amount|value|total|price|rate|tax|gst/i;

export function isAmountColumn(header: string): boolean {
  return !header.includes('%') && AMOUNT_RE.test(header);
}

/** Excel serial → DD-MMM-YYYY (1900 date system). */
export function serialToDisplayDate(serial: number): string {
  const ms = Date.UTC(1899, 11, 30) + Math.round(serial) * 86400000;
  const d = new Date(ms);
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${String(d.getUTCDate()).padStart(2, '0')}-${months[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
}

/** Display a scalar for a column (₹ for amount columns, whole-% for percentages). */
export function formatValue(v: Scalar, header?: string): string {
  if (v === null || v === undefined || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
  if (typeof v === 'number') {
    if (header && header.includes('%')) {
      const pct = v * 100;
      return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
    }
    if (header && isAmountColumn(header)) return inr.format(v);
    return String(v);
  }
  return v;
}
