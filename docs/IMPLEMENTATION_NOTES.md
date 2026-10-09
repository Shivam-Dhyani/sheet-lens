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

## Comlink error marshalling (worker boundary)

Comlink serialises a thrown error to `{ message, name, stack }` only — custom
fields such as `SheetDiffError.code` do not survive the worker boundary. So
`openFile` and `planMerge` return a **discriminated result** (`{ ok, code }`)
instead of throwing, which keeps the engine's error codes intact for the UI
(password prompt vs. unsupported-encryption steps, no-key vs. .xls merge).

## officecrypto-tool (decryption, spike S1)

The optional `officecrypto-tool` dependency is still absent (it failed pnpm's
build constraints — see the engine's notes). The password dialog (FR-IN-04/05)
is fully wired to the engine's real error codes: with the module absent an
encrypted file surfaces `ENCRYPTION_UNSUPPORTED`, so the dialog shows the
"save an unprotected copy" steps. The decrypt happy-path (type the password →
compare proceeds) activates once the module is installed and confirmed
browser-viable (spike S1); no app code changes are needed for it.

## vite-plugin-pwa (`virtual:pwa-register/react`)

`workbox-window` is a transitive dependency of vite-plugin-pwa that pnpm's
strict layout does not hoist, so the React register virtual module fails to
build until it is added explicitly. It is declared as a direct devDependency
(`workbox-window@7.4.1`, matching the plugin's `^7.3.0` range). `registerType`
is `prompt`: the app asks before reloading to a new version rather than
swapping the service worker mid-compare.
