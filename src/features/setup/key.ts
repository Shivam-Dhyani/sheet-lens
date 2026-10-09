import type { CompareSummary, PairMeta } from '../../worker/types.ts';

/** Pairs that take part in the comparison (not added/removed sheets). */
export function comparablePairs(summary: CompareSummary): PairMeta[] {
  return summary.pairs.filter((p) => p.status === 'matched' || p.status === 'renamed');
}

/**
 * Auto mode (FR-SET-06): results show immediately when detection is confident.
 * Setup opens only when a comparable pair fell back to order-based matching or a
 * low-confidence key — exactly the cases where a wrong match would mislead.
 */
export function needsSetup(summary: CompareSummary): boolean {
  return comparablePairs(summary).some((p) => p.key.mode === 'order' || p.key.confidence === 'low');
}

/** The candidate key columns for a pair (columns present in both files). */
export function keyCandidates(pair: PairMeta): string[] {
  const names: string[] = [];
  for (const c of pair.columns) {
    if (c.status === 'matched' || c.status === 'renamed') {
      const name = c.newName ?? c.oldName;
      if (name) names.push(name);
    }
  }
  return names;
}

/** A plain-language reason for the detected key (FR-SET-03). */
export function keyReason(pair: PairMeta): string {
  const { mode, columns, confidence, duplicates } = pair.key;
  const dup = duplicates > 0 ? ` ${duplicates} duplicate value(s) are matched in order of appearance.` : '';
  if (mode === 'order') {
    return 'No column is unique in every row, so rows are matched by their position. Pick a key column for more reliable results.';
  }
  if (mode === 'composite') {
    return `Matched on a combination of ${columns.join(' + ')} (${confidence} confidence).${dup}`;
  }
  return `Matched on ${columns.join(' + ')} (${confidence} confidence).${dup}`;
}
