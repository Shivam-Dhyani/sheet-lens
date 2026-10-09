import { create } from 'zustand';
import type { CompareSummary, Slot, FileMeta, MergePreview, MergeBuildResult } from '../worker/types.ts';
import type { MergePlan, Resolutions, ConflictResolution } from '@shivam-dhyani/sheet-diff';
import { getEngine } from '../worker/client.ts';

type Phase = 'idle' | 'reading' | 'comparing' | 'done' | 'error';
type MergePhase = 'idle' | 'planning' | 'ready' | 'building' | 'done' | 'error';

interface SlotState {
  fileName: string;
  size: number;
  meta?: FileMeta;
}

interface MergeState {
  labels: [string, string];
  plan: MergePlan | null;
  planError: { code: string; message: string } | null;
  canPatch: boolean;
  encrypted: boolean;
  resolutions: Resolutions;
  extendTotals: boolean;
  keepPassword: boolean;
  preview: MergePreview | null;
  result: MergeBuildResult | null;
  phase: MergePhase;
  error: string | null;
}

const freshMerge = (): MergeState => ({
  labels: ['Copy 1', 'Copy 2'],
  plan: null,
  planError: null,
  canPatch: false,
  encrypted: false,
  resolutions: { conflicts: {}, untickedProposals: [], acknowledgeRelated: {} },
  extendTotals: true,
  keepPassword: true,
  preview: null,
  result: null,
  phase: 'idle',
  error: null,
});

interface SessionState {
  mode: 'compare' | 'merge';
  phase: Phase;
  error: string | null;
  slots: Partial<Record<Slot, SlotState>>;
  summary: CompareSummary | null;
  merge: MergeState;
  ui: {
    activePair: string | null;
    filter: 'changed' | 'all';
    view: 'unified' | 'side';
    selectedFindingId: string | null;
  };
  setMode(mode: 'compare' | 'merge'): void;
  openFile(slot: Slot, file: File): Promise<void>;
  runCompare(): Promise<void>;
  selectFinding(id: string | null): void;
  setActivePair(id: string): void;
  setFilter(f: 'changed' | 'all'): void;
  // merge
  setMergeLabel(which: 0 | 1, name: string): void;
  planMerge(): Promise<void>;
  resolveConflict(id: string, resolution: ConflictResolution): void;
  toggleProposal(id: string, selected: boolean): void;
  acknowledgeRelated(id: string, ack: boolean): void;
  setExtendTotals(on: boolean): void;
  setKeepPassword(on: boolean): void;
  buildMerge(): Promise<void>;
  reset(): Promise<void>;
}

export const useSession = create<SessionState>((set, get) => ({
  mode: 'compare',
  phase: 'idle',
  error: null,
  slots: {},
  summary: null,
  merge: freshMerge(),
  ui: { activePair: null, filter: 'changed', view: 'unified', selectedFindingId: null },

  setMode: (mode) => set({ mode }),

  async openFile(slot, file) {
    const buffer = await file.arrayBuffer();
    set((s) => ({
      phase: 'reading',
      error: null,
      slots: { ...s.slots, [slot]: { fileName: file.name, size: file.size } },
    }));
    try {
      const meta = await getEngine().openFile(slot, buffer, file.name);
      set((s) => ({
        phase: 'idle',
        slots: { ...s.slots, [slot]: { fileName: file.name, size: file.size, meta } },
      }));
    } catch (e) {
      set({ phase: 'error', error: messageOf(e) });
    }
  },

  async runCompare() {
    set({ phase: 'comparing', error: null });
    try {
      const summary = await getEngine().compare();
      const firstMatched = summary.pairs.find((p) => p.status === 'matched' || p.status === 'renamed');
      set((s) => ({
        phase: 'done',
        summary,
        ui: { ...s.ui, activePair: firstMatched?.id ?? summary.pairs[0]?.id ?? null },
      }));
    } catch (e) {
      set({ phase: 'error', error: messageOf(e) });
    }
  },

  selectFinding: (id) => set((s) => ({ ui: { ...s.ui, selectedFindingId: id } })),
  setActivePair: (id) => set((s) => ({ ui: { ...s.ui, activePair: id } })),
  setFilter: (filter) => set((s) => ({ ui: { ...s.ui, filter } })),

  /* ── merge ───────────────────────────────────────────────── */

  setMergeLabel: (which, name) =>
    set((s) => {
      const labels: [string, string] = [...s.merge.labels];
      labels[which] = name;
      return { merge: { ...s.merge, labels } };
    }),

  async planMerge() {
    set((s) => ({ merge: { ...s.merge, phase: 'planning', error: null, planError: null } }));
    try {
      const res = await getEngine().planMerge(get().merge.labels);
      if (!res.ok) {
        set((s) => ({ merge: { ...s.merge, phase: 'error', planError: { code: res.code, message: res.message } } }));
        return;
      }
      set((s) => ({
        merge: {
          ...s.merge,
          phase: 'ready',
          plan: res.plan,
          canPatch: res.canPatch,
          encrypted: res.encrypted,
          resolutions: { conflicts: {}, untickedProposals: [], acknowledgeRelated: {} },
          preview: null,
          result: null,
        },
      }));
      await refreshPreview(set, get);
    } catch (e) {
      set((s) => ({ merge: { ...s.merge, phase: 'error', error: messageOf(e) } }));
    }
  },

  resolveConflict: (id, resolution) => {
    set((s) => ({
      merge: {
        ...s.merge,
        result: null,
        resolutions: { ...s.merge.resolutions, conflicts: { ...s.merge.resolutions.conflicts, [id]: resolution } },
      },
    }));
    void refreshPreview(set, get);
  },

  toggleProposal: (id, selected) => {
    set((s) => {
      const current = new Set(s.merge.resolutions.untickedProposals ?? []);
      if (selected) current.delete(id);
      else current.add(id);
      return {
        merge: {
          ...s.merge,
          result: null,
          resolutions: { ...s.merge.resolutions, untickedProposals: [...current] },
        },
      };
    });
    void refreshPreview(set, get);
  },

  acknowledgeRelated: (id, ack) => {
    set((s) => ({
      merge: {
        ...s.merge,
        resolutions: {
          ...s.merge.resolutions,
          acknowledgeRelated: { ...s.merge.resolutions.acknowledgeRelated, [id]: ack },
        },
      },
    }));
    void refreshPreview(set, get);
  },

  setExtendTotals: (on) => {
    set((s) => ({ merge: { ...s.merge, extendTotals: on, result: null } }));
    void refreshPreview(set, get);
  },

  setKeepPassword: (on) => set((s) => ({ merge: { ...s.merge, keepPassword: on } })),

  async buildMerge() {
    const m = get().merge;
    set((s) => ({ merge: { ...s.merge, phase: 'building', error: null } }));
    try {
      const result = await getEngine().buildMerge(m.resolutions, m.extendTotals, m.keepPassword);
      set((s) => ({ merge: { ...s.merge, phase: 'done', result } }));
    } catch (e) {
      set((s) => ({ merge: { ...s.merge, phase: 'error', error: messageOf(e) } }));
    }
  },

  async reset() {
    await getEngine().reset();
    set({
      phase: 'idle',
      error: null,
      slots: {},
      summary: null,
      merge: freshMerge(),
      ui: { activePair: null, filter: 'changed', view: 'unified', selectedFindingId: null },
    });
  },
}));

/** Recompute the impact preview from the current resolutions (no-op until planned). */
async function refreshPreview(
  set: (fn: (s: SessionState) => Partial<SessionState>) => void,
  get: () => SessionState,
): Promise<void> {
  if (!get().merge.plan) return;
  const { resolutions, extendTotals } = get().merge;
  try {
    const preview = await getEngine().previewMerge(resolutions, extendTotals);
    set((s) => ({ merge: { ...s.merge, preview } }));
  } catch {
    // A transient resolve error (e.g. mid-edit) just leaves the last preview.
  }
}

function messageOf(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'PASSWORD_REQUIRED') return 'This file is password-protected.';
  if (err?.code === 'UNSUPPORTED_TYPE') return 'SheetLens reads .xlsx, .xlsm, .xls and .csv files.';
  return err?.message ?? String(e);
}
