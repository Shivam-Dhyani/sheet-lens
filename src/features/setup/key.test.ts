import { describe, it, expect } from 'vitest';
import { needsSetup, keyCandidates, comparablePairs } from './key.ts';
import type { CompareSummary, PairMeta } from '../../worker/types.ts';

function pair(over: Partial<PairMeta> = {}): PairMeta {
  return {
    id: 'Sheet1',
    oldName: 'Sheet1',
    newName: 'Sheet1',
    status: 'matched',
    key: { columns: ['Invoice No'], mode: 'key', confidence: 'high', duplicates: 0 },
    columns: [
      { oldName: 'Invoice No', newName: 'Invoice No', status: 'matched' },
      { oldName: 'Qty', newName: 'Qty', status: 'matched' },
      { newName: 'Added', status: 'added' },
    ],
    ...over,
  };
}

function summary(pairs: PairMeta[]): CompareSummary {
  return {
    counts: {
      needsAttention: 0,
      toReview: 0,
      rowsAdded: 0,
      rowsRemoved: 0,
      cellsEditedByHand: 0,
      formulasOverwritten: 0,
      realChanges: 0,
      recalculated: 0,
    },
    findings: [],
    positionalBaseline: {},
    pairs,
    allChanges: [],
    overview: { forInformation: 0, contrastCells: 0, matchedBy: '' },
    copySummary: '',
    durationMs: 0,
  };
}

describe('needsSetup', () => {
  it('is false when every comparable pair has a confident key', () => {
    expect(needsSetup(summary([pair()]))).toBe(false);
  });
  it('is true when a pair fell back to order-based matching', () => {
    expect(needsSetup(summary([pair({ key: { columns: [], mode: 'order', confidence: 'low', duplicates: 0 } })]))).toBe(
      true,
    );
  });
  it('is true when a key is low confidence', () => {
    expect(
      needsSetup(summary([pair({ key: { columns: ['Date'], mode: 'composite', confidence: 'low', duplicates: 2 } })])),
    ).toBe(true);
  });
  it('ignores added/removed sheets', () => {
    const added = pair({ id: 'New', status: 'added', key: { columns: [], mode: 'order', confidence: 'low', duplicates: 0 } });
    expect(needsSetup(summary([pair(), added]))).toBe(false);
    expect(comparablePairs(summary([pair(), added]))).toHaveLength(1);
  });
});

describe('keyCandidates', () => {
  it('lists only columns present in both files', () => {
    expect(keyCandidates(pair())).toEqual(['Invoice No', 'Qty']);
  });
});
