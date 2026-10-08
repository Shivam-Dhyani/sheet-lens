import { create } from 'zustand';
import type { CompareSummary, Slot, FileMeta } from '../worker/types.ts';
import { getEngine } from '../worker/client.ts';

type Phase = 'idle' | 'reading' | 'comparing' | 'done' | 'error';

interface SlotState {
  fileName: string;
  size: number;
  meta?: FileMeta;
}

interface SessionState {
  mode: 'compare' | 'merge';
  phase: Phase;
  error: string | null;
  slots: Partial<Record<Slot, SlotState>>;
  summary: CompareSummary | null;
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
  reset(): Promise<void>;
}

export const useSession = create<SessionState>((set) => ({
  mode: 'compare',
  phase: 'idle',
  error: null,
  slots: {},
  summary: null,
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

  async reset() {
    await getEngine().reset();
    set({ phase: 'idle', error: null, slots: {}, summary: null, ui: { activePair: null, filter: 'changed', view: 'unified', selectedFindingId: null } });
  },
}));

function messageOf(e: unknown): string {
  const err = e as { code?: string; message?: string };
  if (err?.code === 'PASSWORD_REQUIRED') return 'This file is password-protected.';
  if (err?.code === 'UNSUPPORTED_TYPE') return 'SheetLens reads .xlsx, .xlsm, .xls and .csv files.';
  return err?.message ?? String(e);
}
