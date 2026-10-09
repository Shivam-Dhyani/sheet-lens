# CLAUDE.md — SheetLens web app

Browser-only app that compares two spreadsheets and assists a safe three-way
merge, powered by the `@shivam-dhyani/sheet-diff` engine in a Web Worker. See
`docs/PRD.md` and `docs/TDD.md`.

## Ground rules
1. **Phase 1 only.** [P2] items (version timeline, "changed by", backend,
   accounts, formatting diff, …) are out of scope.
2. **No file data ever leaves the device** (G-3 / FR-PRV). No third-party
   scripts, fonts or analytics; strict CSP (`connect-src 'self'`).
3. **Never invent a library API** — verify installed versions; record
   deviations in `docs/IMPLEMENTATION_NOTES.md`.
4. TypeScript strict; WCAG 2.2 AA; colour is never the only signal; respect
   `prefers-reduced-motion`.
5. Heavy data lives only in the worker; the UI pulls row windows (ADR-10).

## Stack (TDD §4)
Vite + React 19 + React Router v7, Zustand, @tanstack/react-virtual, CSS
Modules + tokens, Dexie (settings/templates only), vite-plugin-pwa, Comlink,
Vitest + Testing Library + Playwright + @axe-core/playwright. ExcelJS (lazy,
report export). Deploy: Cloudflare Pages (`public/_headers` for CSP).

## Build order (TDD §17)
- Engine (`@shivam-dhyani/sheet-diff`) — ✅ done (compare, merge, patch, report
  model), separate repo. Linked here via `file:../sheet-diff` in dev.
- M4 app shell — ✅ worker client (Comlink), landing + intake, compare results
  (headline, cards, findings, detail, tabs, DiffGrid with changed/all filter +
  mobile cards), privacy panel, copy-summary, **setup screen** (low-confidence
  key re-pick + recompare, `src/features/setup`), **password dialog**
  (FR-IN-04/05, `src/features/intake`), and **PWA offline/update prompts**
  (`src/pwa`). Covered by Playwright US-01/US-02 + setup e2es. Remaining:
  side-by-side grid view + full virtualization, settings + templates (Dexie).
- M5 reports — ✅ Excel + HTML report renderers (`src/reports`), consuming the
  engine's report model in the worker (lazy ExcelJS). Overview COUNTIFs verified
  to recalc to the engine counts in LibreOffice; downloads covered by the e2e.
- M6–M7 merge UI + patch download — ✅ three-file intake, conflict resolution
  (CELL / RELATED_EDITS / DELETE_EDIT / ADD_ADD), auto-change proposals,
  extend-totals opt-in, before/after impact preview, fidelity checklist, and the
  patched `{Original}_MERGED_{date}` download (`src/features/merge`, worker
  `planMerge`/`previewMerge`/`buildMerge`). Covered by a Playwright US-02 e2e.
- Remaining polish: side-by-side grid + full virtualization,
  settings/templates (Dexie), CSS Modules refactor.

Note: a single `src/styles/app.css` + tokens is used for now instead of
per-component CSS Modules — refactor to CSS Modules is a later pass.

## Workflow
- Append to `logs/YYYY-MM-DD.md` for each meaningful change (ADR-15).
  Date the file by **IST** (Asia/Kolkata): `TZ=Asia/Kolkata date '+%Y-%m-%d'`.
- During development the app links the engine via a workspace link; production
  uses the published `0.x`.
