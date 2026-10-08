/** Report file name: SheetLens_{new}_vs_{old}_{yyyy-mm-dd}.{ext} (FR-REP-04). */
export function reportFileName(newFile: string, oldFile: string, ext: 'xlsx' | 'html', now = new Date()): string {
  const strip = (s: string): string => s.replace(/\.[^.]+$/, '').replace(/[^\w.-]+/g, '_');
  const date = now.toISOString().slice(0, 10);
  return `SheetLens_${strip(newFile)}_vs_${strip(oldFile)}_${date}.${ext}`;
}
