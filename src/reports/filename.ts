/** Report file name: SheetLens_{new}_vs_{old}_{yyyy-mm-dd}.{ext} (FR-REP-04). */
export function reportFileName(newFile: string, oldFile: string, ext: 'xlsx' | 'html', now = new Date()): string {
  const strip = (s: string): string => s.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
  const date = now.toISOString().slice(0, 10);
  return `SheetLens_${strip(newFile)}_vs_${strip(oldFile)}_${date}.${ext}`;
}

/** Merged output name: {OriginalName}_MERGED_{yyyy-mm-dd}.{ext} (FR-MRG-11). */
export function mergedFileName(
  originalName: string,
  format: 'xlsx' | 'xlsm' | 'xls' | 'csv',
  now = new Date(),
): string {
  const stem = originalName.replace(/\.[^.]+$/, '');
  const ext = format === 'csv' ? 'csv' : format === 'xlsm' ? 'xlsm' : 'xlsx';
  const date = now.toISOString().slice(0, 10);
  return `${stem}_MERGED_${date}.${ext}`;
}
