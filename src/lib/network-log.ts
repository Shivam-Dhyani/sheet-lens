/**
 * Privacy network log (FR-PRV-02): list resource requests since the user added
 * files, proving nothing was uploaded. Uses the Performance Resource Timing
 * API; a marker timestamp is recorded when files are first added.
 */
let marker = 0;

export function markFilesAdded(): void {
  marker = performance.now();
}

export interface NetEntry {
  name: string;
  initiatorType: string;
  transferSize: number;
}

export function requestsSinceMarker(): NetEntry[] {
  if (marker === 0) return [];
  try {
    const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
    return entries
      .filter((e) => e.startTime >= marker)
      .map((e) => ({
        name: e.name,
        initiatorType: e.initiatorType,
        transferSize: e.transferSize || 0,
      }));
  } catch {
    return [];
  }
}
