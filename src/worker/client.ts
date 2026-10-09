import * as Comlink from 'comlink';
import type {
  EngineApi,
  Slot,
  FileMeta,
  CompareSummary,
  MergePlanResult,
  MergePreview,
  MergeBuildResult,
} from './types.ts';
import type { MarkedSheet, Resolutions } from '@shivam-dhyani/sheet-diff';

/**
 * One worker per session (ADR-02/ADR-10). The heavy workbook data lives in the
 * worker; the UI pulls summaries and per-sheet windows.
 */
export class EngineClient {
  private worker: Worker;
  private api: Comlink.Remote<EngineApi>;

  constructor() {
    this.worker = new Worker(new URL('./engine.worker.ts', import.meta.url), { type: 'module' });
    this.api = Comlink.wrap<EngineApi>(this.worker);
  }

  /** Transfer the buffer into the worker (zero-copy). */
  openFile(slot: Slot, buffer: ArrayBuffer, fileName: string, password?: string): Promise<FileMeta> {
    return this.api.openFile(slot, Comlink.transfer(buffer, [buffer]), fileName, password);
  }

  isEncrypted(buffer: ArrayBuffer): Promise<boolean> {
    return this.api.isEncrypted(buffer);
  }

  compare(): Promise<CompareSummary> {
    return this.api.compare();
  }

  getMarkedSheet(name: string): Promise<MarkedSheet | null> {
    return this.api.getMarkedSheet(name);
  }

  buildExcelReport(): Promise<ArrayBuffer | null> {
    return this.api.buildExcelReport();
  }

  buildHtmlReport(): Promise<string | null> {
    return this.api.buildHtmlReport();
  }

  planMerge(labels: [string, string]): Promise<MergePlanResult> {
    return this.api.planMerge(labels);
  }

  previewMerge(resolutions: Resolutions, extendTotals: boolean): Promise<MergePreview> {
    return this.api.previewMerge(resolutions, extendTotals);
  }

  buildMerge(
    resolutions: Resolutions,
    extendTotals: boolean,
    keepPassword: boolean,
  ): Promise<MergeBuildResult> {
    return this.api.buildMerge(resolutions, extendTotals, keepPassword);
  }

  reset(): Promise<void> {
    return this.api.reset();
  }

  /** Hard cancel — terminate and replace the worker (TDD §12.2). */
  terminate(): void {
    this.worker.terminate();
  }
}

let singleton: EngineClient | null = null;
export function getEngine(): EngineClient {
  if (!singleton) singleton = new EngineClient();
  return singleton;
}
