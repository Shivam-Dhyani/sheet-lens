# Implementation notes — library-API deviations

Per CLAUDE.md ground rule 3: record where an installed library's real API or
behaviour differs from what the PRD/TDD assumes.

## ExcelJS 4.4.0 (report export, `src/reports/excel-report.ts`)

- **Workbook output type.** `workbook.xlsx.writeBuffer()` resolves to a Node
  `Buffer` under Node and to an `ArrayBuffer`-backed buffer in the browser
  build. We normalise to a standalone `ArrayBuffer` (slice at the byte offset)
  so it transfers cleanly across the Comlink worker boundary.
- **Formula injection.** A plain JS string assigned to a cell is written as a
  shared/inline string (`t="s"`/`t="inlineStr"`), never as a `<f>` formula, so
  Excel does **not** evaluate text that begins with `= + - @`. Only the
  `{ formula, result }` objects we build ourselves become formulas, and those
  are assembled from trusted constants (the Overview COUNTIFs). We therefore do
  not apostrophe-prefix cell text (which would corrupt the displayed value); we
  only strip control characters from free text. (The apostrophe guard still
  matters for the engine's CSV export path, which is a different writer.)
- **Overview counts.** Written as `COUNTIF` formulas over the `All Changes`
  table (`B` = Risk, `F` = What changed), matching
  `reference_report_prototype.xlsx`, with the engine's exact count cached as the
  formula `result`. The What-changed patterns (`"Row added"`, `"Row removed"`,
  `"Value edited"`, `"Formula replaced*"`) are coupled to the engine's finding
  titles; verified to recalculate to the engine totals in LibreOffice headless
  (High=4, Medium=9, Info=3, rows +2/−1, edited=4, formulas overwritten=1 on the
  Sales Register fixture).
- **Indian number format.** `"₹"#,##,##0.00` (lakh/crore grouping) for amount
  columns and `0.##%` for percentage columns, so values stay numeric and
  sortable in Excel rather than being written as pre-formatted strings.

## HTML report (`src/reports/html-report.ts`)

- Self-contained single file with a strict CSP `<meta>`
  (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline';
  img-src data:`): no external scripts, fonts or network requests (G-3 / FR-PRV).
  All interpolated text is HTML-escaped.
