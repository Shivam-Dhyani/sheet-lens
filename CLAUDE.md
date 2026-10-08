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
- Engine (`@shivam-dhyani/sheet-diff`) — ✅ done, separate repo.
- M4 app shell: landing (prerendered), intake + password, worker client, setup,
  results (headline, cards, findings, detail, tabs, DiffGrid both views, mobile
  cards), settings, templates, privacy panel, PWA.
- M5 reports (Excel/HTML/copy summary) · M6–M7 merge UI + patch writer.

## Workflow
- Append to `logs/YYYY-MM-DD.md` for each meaningful change (ADR-15).
- During development the app links the engine via a workspace link; production
  uses the published `0.x`.
