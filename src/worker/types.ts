import type {
  Counts,
  Finding,
  ColumnMatch,
  KeyInfo,
  MarkedSheet,
  ReportChange,
  MergePlan,
  Resolutions,
  ImpactRow,
  ChangeSetExtendRange,
  MergeLogRow,
  BlockedOp,
  FidelityReport,
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

/* ── Assisted merge (M6–M7) ────────────────────────────────── */

/** Plan result, or a reason the three files can't be merged (BR-M9 / .xls). */
export type MergePlanResult =
  | { ok: true; plan: MergePlan; canPatch: boolean; encrypted: boolean }
  | { ok: false; code: 'MERGE_NO_KEY' | 'MERGE_XLS'; message: string };

/** Impact preview + the exact total-formulas the extend-totals toggle changes. */
export interface MergePreview {
  resolved: boolean;
  unresolved: string[];
  appliedCount: number;
  impact: ImpactRow[];
  extendRanges: ChangeSetExtendRange[];
}

export interface MergeBuildResult {
  bytes: ArrayBuffer;
  fileName: string;
  applied: MergeLogRow[];
  blocked: BlockedOp[];
  fidelity: FidelityReport;
  impact: ImpactRow[];
}

/** The Comlink-exposed engine API (runs in the worker). */
export interface EngineApi {
  openFile(slot: Slot, buffer: ArrayBuffer, fileName: string, password?: string): Promise<FileMeta>;
  isEncrypted(buffer: ArrayBuffer): Promise<boolean>;
  compare(): Promise<CompareSummary>;
  getMarkedSheet(name: string): Promise<MarkedSheet | null>;
  buildExcelReport(): Promise<ArrayBuffer | null>;
  buildHtmlReport(): Promise<string | null>;
  planMerge(labels: [string, string]): Promise<MergePlanResult>;
  previewMerge(resolutions: Resolutions, extendTotals: boolean): Promise<MergePreview>;
  buildMerge(
    resolutions: Resolutions,
    extendTotals: boolean,
    keepPassword: boolean,
  ): Promise<MergeBuildResult>;
  reset(): Promise<void>;
}

export type {
  MarkedSheet,
  Finding,
  Counts,
  MergePlan,
  Proposal,
  Conflict,
  Resolutions,
  ConflictResolution,
  ImpactRow,
  MergeLogRow,
  BlockedOp,
  FidelityReport,
  ChangeSetExtendRange,
} from '@shivam-dhyani/sheet-diff';
