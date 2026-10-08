import * as Comlink from 'comlink';
import {
  readWorkbook,
  isEncrypted,
  compareWorkbooks,
  buildReportModel,
  buildCopySummary,
  type WorkbookIR,
  type CompareResult,
  type ReportModel,
} from '@shivam-dhyani/sheet-diff';
import type { EngineApi, Slot, FileMeta, CompareSummary, PairMeta } from './types.ts';

const wbs: Partial<Record<Slot, WorkbookIR>> = {};
let result: CompareResult | null = null;
let report: ReportModel | null = null;

const api: EngineApi = {
  async openFile(slot, buffer, fileName, password): Promise<FileMeta> {
    const bytes = new Uint8Array(buffer);
    const wb = await readWorkbook(bytes, {
      fileName,
      keepSourceBytes: slot === 'base' || slot === 'old',
      ...(password ? { password } : {}),
    });
    wbs[slot] = wb;
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
    // ExcelJS rendering lands in the reports increment (M5).
    return null;
  },

  async buildHtmlReport() {
    return null;
  },

  async reset() {
    for (const k of Object.keys(wbs) as Slot[]) delete wbs[k];
    result = null;
    report = null;
  },
};

Comlink.expose(api);
