import type {
  Counts,
  Finding,
  ColumnMatch,
  KeyInfo,
  MarkedSheet,
  ReportChange,
} from '@shivam-dhyani/sheet-diff';

export type Slot = 'old' | 'new' | 'base' | 'a' | 'b';

export interface FileMeta {
  fileName: string;
  sheetNames: string[];
  encrypted: boolean;
}

export interface PairMeta {
  id: string;
  oldName?: string;
  newName?: string;
  status: 'matched' | 'renamed' | 'added' | 'removed';
  key: KeyInfo;
  columns: ColumnMatch[];
}

/** Lightweight compare summary sent to the UI (heavy arrays stay in the worker). */
export interface CompareSummary {
  counts: Counts;
  findings: Finding[];
  positionalBaseline: Record<string, number>;
  pairs: PairMeta[];
  allChanges: ReportChange[];
  overview: { forInformation: number; contrastCells: number; matchedBy: string };
  copySummary: string;
  durationMs: number;
}

/** The Comlink-exposed engine API (runs in the worker). */
export interface EngineApi {
  openFile(slot: Slot, buffer: ArrayBuffer, fileName: string, password?: string): Promise<FileMeta>;
  isEncrypted(buffer: ArrayBuffer): Promise<boolean>;
  compare(): Promise<CompareSummary>;
  getMarkedSheet(name: string): Promise<MarkedSheet | null>;
  buildExcelReport(): Promise<ArrayBuffer | null>;
  buildHtmlReport(): Promise<string | null>;
  reset(): Promise<void>;
}

export type { MarkedSheet, Finding, Counts } from '@shivam-dhyani/sheet-diff';
