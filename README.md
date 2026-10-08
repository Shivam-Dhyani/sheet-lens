# SheetLens — Compare Excel files

> See every hidden change in your spreadsheets. Compare two Excel files in
> seconds — **your files never leave this device**.

SheetLens is a browser-only web app that compares two versions of a spreadsheet
and, in Phase 1, assists a safe three-way merge. All processing happens on the
device (no backend, no uploads, no accounts); it is installable and works
offline after the first visit.

It is powered by the open-source engine
[`@shivam-dhyani/sheet-diff`](https://github.com/Shivam-Dhyani/sheet-diff),
hosted in a Web Worker so the UI thread stays free.

## Status

| Component | State |
|---|---|
| Engine `@shivam-dhyani/sheet-diff` (read → compare → checks → CLI) | ✅ built ([repo](https://github.com/Shivam-Dhyani/sheet-diff)) |
| Web app (this repo) | 🚧 next increment — scaffold + planning in place |

This repo currently holds the product/technical docs, the project conventions
and the planned structure. The app itself (Vite + React 19 + React Router v7,
the engine worker client, intake/setup/results/merge screens, reports, the PWA
and the privacy panel) is the next build increment — see
[`docs/TDD.md`](docs/TDD.md) §12 and the milestones in §17 (M4–M8).

## Architecture (planned, TDD §2)

```
Main thread (React UI)  ──Comlink RPC──▶  Engine Worker (@shivam-dhyani/sheet-diff)
  routes / Zustand store                    read · compare · checks · merge · patch · reports
  virtualized DiffGrid                     ◀── row windows on demand
  privacy panel (network log)
IndexedDB (settings, templates only)  ·  Service worker (offline cache)
```

Static files only, deployed to Cloudflare Pages. No API, no analytics; a strict
CSP (`connect-src 'self'`) enforces the privacy promise.

## Planned structure (TDD §5.2)

```
src/
  main.tsx  routes.tsx
  worker/engine.worker.ts  worker/client.ts
  reports/  store/  db/
  features/ landing · intake · setup · results · merge · privacy · settings
  ui/  lib/
public/ (_headers, fonts, samples, icons)
e2e/ (Playwright)
```

## Development conventions

- Phase 1 only (see [`docs/PRD.md`](docs/PRD.md) / [`docs/TDD.md`](docs/TDD.md); [P2] items are out of scope).
- TypeScript strict; accessibility (WCAG 2.2 AA); colour is never the only signal.
- Append a short entry to `logs/YYYY-MM-DD.md` for each meaningful change (ADR-15).

## License

MIT © Shivam Dhyani
