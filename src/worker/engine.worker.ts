import * as Comlink from 'comlink';
import {
  readWorkbook,
  isEncrypted,
  compareWorkbooks,
  buildReportModel,
  buildCopySummary,
  planMerge,
  resolveMerge,
  previewImpact,
  computeExtendRanges,
  buildMergeLog,
  applyMergePatch,
  isSheetDiffError,
  type WorkbookIR,
  type CompareResult,
  type ReportModel,
  type MergePlan,
} from '@shivam-dhyani/sheet-diff';
import type {
  EngineApi,
  Slot,
  FileMeta,
  CompareSummary,
  PairMeta,
  MergePlanResult,
  MergePreview,
  MergeBuildResult,
} from './types.ts';
import { mergedFileName } from '../reports/filename.ts';

const wbs: Partial<Record<Slot, WorkbookIR>> = {};
const passwords: Partial<Record<Slot, string>> = {};
let result: CompareResult | null = null;
let report: ReportModel | null = null;
let mergePlan: MergePlan | null = null;
let mergeLabels: [string, string] = ['Copy 1', 'Copy 2'];

const api: EngineApi = {
  async openFile(slot, buffer, fileName, password): Promise<FileMeta> {
    const bytes = new Uint8Array(buffer);
    const wb = await readWorkbook(bytes, {
      fileName,
      keepSourceBytes: slot === 'base' || slot === 'old',
      ...(password ? { password } : {}),
    });
    wbs[slot] = wb;
    if (password) passwords[slot] = password;
    else delete passwords[slot];
    return { fileName, sheetNames: wb.sheets.map((s) => s.name), encrypted: false };
  },

  async isEncrypted(buffer): Promise<boolean> {
    return isEncrypted(new Uint8Array(buffer));
  },

  async compare(): Promise<CompareSummary> {
    const oldWb = wbs.old;
    const newWb = wbs.new;
    if (!oldWb || !newWb) throw new Error('Both files must be loaded before comparing.');
    result = compareWorkbooks(oldWb, newWb);
    report = buildReportModel(result, oldWb, newWb);

    const pairs: PairMeta[] = result.pairs.map((p) => ({
      id: p.id,
      ...(p.oldName !== undefined ? { oldName: p.oldName } : {}),
      ...(p.newName !== undefined ? { newName: p.newName } : {}),
      status: p.status,
      key: p.key,
      columns: p.columns,
    }));

    return {
      counts: result.counts,
      findings: result.findings,
      positionalBaseline: result.positionalBaseline,
      pairs,
      allChanges: report.allChanges,
      overview: {
        forInformation: report.overview.forInformation,
        contrastCells: report.overview.contrastCells,
        matchedBy: report.meta.matchedBy,
      },
      copySummary: buildCopySummary(result),
      durationMs: result.durationMs,
    };
  },

  async getMarkedSheet(name) {
    if (!report) return null;
    return report.markedSheets.find((m) => m.name === name) ?? null;
  },

  async buildExcelReport() {
    if (!report) return null;
    const { renderExcelReport } = await import('../reports/excel-report.ts');
    const buffer = await renderExcelReport(report);
    return Comlink.transfer(buffer, [buffer]);
  },

  async buildHtmlReport() {
    if (!report) return null;
    const { renderHtmlReport } = await import('../reports/html-report.ts');
    return renderHtmlReport(report);
  },

  async planMerge(labels): Promise<MergePlanResult> {
    const base = wbs.base;
    const a = wbs.a;
    const b = wbs.b;
    if (!base || !a || !b) throw new Error('Open the Original and both copies before planning a merge.');
    mergeLabels = labels;
    if (base.format === 'xls') {
      return { ok: false, code: 'MERGE_XLS', message: 'To merge, open the original in Excel and save it as .xlsx.' };
    }
    try {
      mergePlan = planMerge(base, a, b, { labels });
    } catch (e) {
      if (isSheetDiffError(e) && e.code === 'MERGE_NO_KEY') {
        mergePlan = null;
        return { ok: false, code: 'MERGE_NO_KEY', message: e.message };
      }
      throw e;
    }
    return {
      ok: true,
      plan: mergePlan,
      canPatch: base.format !== 'csv',
      encrypted: Boolean(passwords.base),
    };
  },

  async previewMerge(resolutions, extendTotals): Promise<MergePreview> {
    const base = wbs.base;
    if (!base || !mergePlan) throw new Error('Plan the merge first.');
    const unresolved = mergePlan.conflicts
      .filter((c) => resolutions.conflicts[c.id] === undefined)
      .map((c) => c.id);
    if (unresolved.length > 0) {
      return { resolved: false, unresolved, appliedCount: 0, impact: [], extendRanges: [] };
    }
    const changeSet = resolveMerge(base, mergePlan, resolutions, { extendTotals });
    const extendRanges = extendTotals ? changeSet.extendRanges : computeExtendRanges(base, changeSet);
    const impact = previewImpact(base, changeSet);
    const appliedCount =
      changeSet.cellEdits.length + changeSet.rowInserts.length + changeSet.rowDeletes.length;
    return { resolved: true, unresolved: [], appliedCount, impact, extendRanges };
  },

  async buildMerge(resolutions, extendTotals, keepPassword): Promise<MergeBuildResult> {
    const base = wbs.base;
    if (!base || !mergePlan) throw new Error('Plan the merge first.');
    const changeSet = resolveMerge(base, mergePlan, resolutions, { extendTotals });
    const log = buildMergeLog(mergePlan, resolutions, mergeLabels);
    const impact = previewImpact(base, changeSet);
    const patch = await applyMergePatch(base, changeSet, {
      sourceLabels: mergeLabels,
      now: new Date(),
      log,
      ...(keepPassword && passwords.base ? { password: passwords.base } : {}),
    });
    const bytes = patch.bytes.buffer.slice(
      patch.bytes.byteOffset,
      patch.bytes.byteOffset + patch.bytes.byteLength,
    ) as ArrayBuffer;
    return Comlink.transfer(
      {
        bytes,
        fileName: mergedFileName(base.fileName, base.format),
        applied: patch.applied,
        blocked: patch.blocked,
        fidelity: patch.fidelity,
        impact,
      },
      [bytes],
    );
  },

  async reset() {
    for (const k of Object.keys(wbs) as Slot[]) delete wbs[k];
    for (const k of Object.keys(passwords) as Slot[]) delete passwords[k];
    result = null;
    report = null;
    mergePlan = null;
    mergeLabels = ['Copy 1', 'Copy 2'];
  },
};

Comlink.expose(api);
