# Running SheetLens locally & publishing the `sheet-diff` package

This guide covers two things you haven't done before:

1. **Using your own package** (`@shivam-dhyani/sheet-diff`) from the app and from other code.
2. **Publishing that package** so it can be installed by anyone — including the
   server that deploys the web app.

Everything below was run against the real repos on 2026-10-11, except the
steps that need your accounts (npm login/publish, Cloudflare). Those are marked
**[needs you]**.

---

## 0. The short answer

**Do both — in this order. It is not either/or.**

| Step | What | Why this order |
|------|------|----------------|
| 1 | **Run locally**, with the app pointing at your local package folder | Fast loop. Change the package, see it in the app instantly. Nothing is public yet, so mistakes cost nothing. |
| 2 | **Publish the package to npm** | A deployed app can only install packages from a registry. Your laptop's folder doesn't exist on the build server. |
| 3 | **Switch the app to the published version**, then **deploy the app** (Cloudflare Pages) | The deployed app now installs `@shivam-dhyani/sheet-diff` from npm like any other library. |

Why not "publish first, then use it"? Because every package tweak would need
a publish → install round-trip, and **npm never lets you reuse a version
number**. You'd burn versions fixing small things you'd have caught locally.

Why not "local only"? Because the app can't be deployed that way (see §6).

**Where does a package get deployed?** Not Vercel/Cloudflare — those host
*websites*. Packages go to a **package registry**. For JavaScript that is the
**npm registry** (npmjs.com), which is free for public packages.

```
sheet-diff (package)  ──publish──▶  npm registry  ──install──▶  sheet-lens (app)  ──deploy──▶  Cloudflare Pages
```

---

## 1. How the pieces fit together

You have two separate git repos:

| Repo | What it is | Ships to |
|------|-----------|----------|
| `sheet-diff` | The engine: compare / merge / patch / report model, plus a CLI. Pure TypeScript, no UI. | **npm** (as `@shivam-dhyani/sheet-diff`) |
| `sheet-lens` | The web app (React + Vite). Runs the engine inside a Web Worker in the browser. | **Cloudflare Pages** (static site) |

The app depends on the engine. Today `sheet-lens/package.json` says:

```json
"@shivam-dhyani/sheet-diff": "file:../sheet-diff"
```

That means "use the folder next to me" — it only works when both repos sit
side by side on your machine. Section 5 replaces it with a normal version
number once the package is on npm.

---

## 2. Scenario A — run everything locally (do this first)

### 2.1 Prerequisites

- **Node.js ≥ 20** (22 works; the package declares `engines: node >= 20`)
- **pnpm 10** — `corepack enable` (ships with Node), or `npm install -g pnpm@10`
- **git**

### 2.2 Put the repos side by side

The folder names matter because of `../sheet-diff`:

```
sheetlens/            <- any parent folder you like
├── sheet-diff/       <- engine
└── sheet-lens/       <- app
```

```sh
mkdir sheetlens && cd sheetlens
git clone https://github.com/Shivam-Dhyani/sheet-diff.git
git clone https://github.com/Shivam-Dhyani/sheet-lens.git

# Until the work is merged to main, use the development branch in both:
git -C sheet-diff checkout claude/sheet-lens-project-setup-ywegac
git -C sheet-lens checkout claude/sheet-lens-project-setup-ywegac
```

### 2.3 First run

**Build the engine first.** The package's entry points live in `dist/`
(which is git-ignored), so a fresh clone has nothing to import until you build.

```sh
cd sheet-diff
pnpm install
pnpm build          # tsup -> dist/ (ESM + CJS + .d.ts + CLI)
pnpm test           # optional: unit + golden tests

cd ../sheet-lens
pnpm install
pnpm dev            # http://localhost:5173
```

Open the URL, click **Try with sample files** in either Compare or Merge mode.

### 2.4 Day-to-day loop when you're changing the package

> ⚠️ **Gotcha (verified):** with `file:../sheet-diff`, pnpm *copies* the package
> into the app's `node_modules` at install time. I rebuilt the engine and the
> app's copy stayed on the old file. So with `file:`, every engine change needs
> `pnpm build` **and** `pnpm install` in the app. Easy to forget, confusing to debug.

For active development use a **live link** instead. In `sheet-lens/package.json`:

```diff
-  "@shivam-dhyani/sheet-diff": "file:../sheet-diff",
+  "@shivam-dhyani/sheet-diff": "link:../sheet-diff",
```

```sh
cd sheet-lens && pnpm install
```

`node_modules/@shivam-dhyani/sheet-diff` is now a symlink to your engine folder
(verified: typecheck and production build both pass against it). Then run two terminals:

```sh
# terminal 1 — rebuilds dist/ whenever you edit the engine
cd sheet-diff && pnpm dev          # tsup --watch

# terminal 2 — the app
cd sheet-lens && pnpm dev
```

Refresh the browser if an engine change doesn't hot-reload (the engine runs
inside a Web Worker, which can need a reload).

**Don't commit the `link:` change.** Revert it before committing
(`git checkout package.json pnpm-lock.yaml`) — or just remember §5 replaces it anyway.

### 2.5 Production-like run (and offline check)

The dev server has no service worker. To test what users get — including the
offline/PWA behaviour and the strict CSP headers — run the production build:

```sh
cd sheet-lens
pnpm build
pnpm preview --port 4173            # http://localhost:4173
```

To check offline: load the page once, open DevTools → Application → Service
Workers, tick **Offline**, reload. Comparing the sample files should still work.

### 2.6 Tests

```sh
# engine
cd sheet-diff && pnpm lint && pnpm typecheck && pnpm test

# app (unit)
cd sheet-lens && pnpm lint && pnpm typecheck && pnpm test

# app (end-to-end, real browser)
pnpm exec playwright install chromium     # once per machine
pnpm build                                # e2e serves the production build
pnpm e2e
```

> I changed `playwright.config.ts` while writing this guide. It used to
> hard-code the cloud container's Chromium path, which would fail on your
> machine. It now uses your Playwright-installed Chromium automatically, or any
> browser you point `PLAYWRIGHT_CHROMIUM_PATH` at. The 6 e2e tests still pass.

---

## 3. Using the package on its own (library + CLI)

You don't need the web app to use the engine. It runs in Node ≥ 20 and in a
browser Web Worker, ships ESM + CommonJS + TypeScript types, and never sends
data anywhere. (The snippets below were executed against the real build.)

### Install

```sh
# After publishing (§4):
npm install @shivam-dhyani/sheet-diff

# Before publishing, from another local project — pick one:
pnpm add link:/absolute/path/to/sheet-diff          # live link
pnpm add /absolute/path/to/sheet-diff               # snapshot copy
cd sheet-diff && pnpm pack                          # makes shivam-dhyani-sheet-diff-0.1.0.tgz
pnpm add ./shivam-dhyani-sheet-diff-0.1.0.tgz       # exactly what npm would ship
```

### Compare two files

```ts
import { readFile } from 'node:fs/promises';
import { readWorkbook, compareWorkbooks, buildCopySummary } from '@shivam-dhyani/sheet-diff';

const load = async (path: string) =>
  readWorkbook(new Uint8Array(await readFile(path)), { fileName: path });

const oldWb = await load('Sales_v1.xlsx');
const newWb = await load('Sales_FINAL.xlsx');

const result = compareWorkbooks(oldWb, newWb);
console.log(result.counts.realChanges, 'real changes,', result.counts.needsAttention, 'need attention');
console.log(buildCopySummary(result));
for (const f of result.findings) console.log(`[${f.rule}] ${f.severity}: ${f.message}`);
```

### Report data for your own renderer

```ts
import { buildReportModel } from '@shivam-dhyani/sheet-diff';
const report = buildReportModel(result, oldWb, newWb); // overview, allChanges, markedSheets
```

### Three-way merge → patched `.xlsx`

```ts
import {
  readWorkbook, planMerge, resolveMerge, buildMergeLog, applyMergePatch,
} from '@shivam-dhyani/sheet-diff';

// Only the Original needs keepSourceBytes: the output is a patched copy of it.
const base = await readWorkbook(bytesOfOriginal, { fileName: 'Original.xlsx', keepSourceBytes: true });
const a = await readWorkbook(bytesOfRavi,  { fileName: 'Ravi.xlsx' });
const b = await readWorkbook(bytesOfPriya, { fileName: 'Priya.xlsx' });

const labels: [string, string] = ['Ravi', 'Priya'];
const plan = planMerge(base, a, b, { labels });   // plan.proposals (auto) + plan.conflicts (you decide)

// Every conflict needs an answer: 'A' | 'B' | 'base' | 'both' | 'delete' | 'keepEdits' | { typed: value }
const resolutions = {
  conflicts: Object.fromEntries(plan.conflicts.map((c) => [c.id, c.type === 'DELETE_EDIT' ? 'delete' : 'A'])),
};

const changeSet = resolveMerge(base, plan, resolutions, { extendTotals: true });
const out = await applyMergePatch(base, changeSet, {
  sourceLabels: labels,
  log: buildMergeLog(plan, resolutions, labels),
});
// out.bytes  -> write to disk as the merged .xlsx
// out.applied / out.blocked / out.fidelity -> what was done, what needs manual action
```

### Command line

```sh
# Before publishing — straight from the build:
node sheet-diff/dist/cli.cjs old.xlsx new.xlsx
node sheet-diff/dist/cli.cjs old.xlsx new.xlsx --json --key "Invoice No"
node sheet-diff/dist/cli.cjs merge original.xlsx ravi.xlsx priya.xlsx --json

# After publishing:
npx @shivam-dhyani/sheet-diff old.xlsx new.xlsx
```

---

## 4. Scenario B — publish the package to npm

### 4.1 Where, and why npm

| Option | Verdict |
|--------|---------|
| **npm registry** (npmjs.com) | ✅ **Use this.** Free for public packages, the default for `npm`/`pnpm`/`yarn`, no auth needed to install. |
| GitHub Packages | ❌ Consumers must authenticate even for public packages — your Cloudflare build would need a token. Extra friction for no gain. |
| Install straight from GitHub (`github:Shivam-Dhyani/sheet-diff`) | ❌ `dist/` is git-ignored, so installs would get no built code unless you add a build-on-install step. |
| Merge both repos into one pnpm workspace | ⚠️ Valid later (no publishing needed), but it gives up the point of an independent open-source engine. |

### 4.2 One-time setup **[needs you]**

1. Create an account at <https://www.npmjs.com/signup>.
2. **Enable two-factor authentication** (npm requires it, or a granular access
   token, to publish).
3. **Make your scope exist.** The package is named `@shivam-dhyani/sheet-diff`,
   and a scope must belong to you: your npm *username* must be exactly
   `shivam-dhyani`, **or** create a free npm *organisation* with that name.
   Check <https://www.npmjs.com/~shivam-dhyani> (user) or
   <https://www.npmjs.com/org/shivam-dhyani> (org).
   - If that name is taken by someone else, you'd need a different scope. That means renaming
     the package **and** every `@shivam-dhyani/sheet-diff` import in the app —
     so sort this out *before* publishing.
4. Log in on your machine:

   ```sh
   npm login
   npm whoami          # should print your username
   ```

### 4.3 Pre-flight checklist

Run from `sheet-diff/`:

```sh
pnpm lint && pnpm typecheck && pnpm test && pnpm build
pnpm pack --dry-run          # lists exactly what will be uploaded
npm view @shivam-dhyani/sheet-diff   # 404 = the name is free (it was on 2026-10-11)
```

`pnpm pack --dry-run` should list only `dist/*`, `README.md`, `LICENSE`,
`package.json` (15 files). Source, tests and fixtures are correctly left out by
the `"files"` whitelist.

**Pre-publish checklist** (found while writing this guide; ✅ = already fixed):

- [x] ✅ **README out of date** — fixed. The tagline and "pre-1.0" bullet no longer
      say merge is coming "soon", and the API table now lists the merge, patch and
      report functions. Its CLI merge example used a name the CLI silently ignores
      (`=Ravi`); it now uses `Copy1`/`Copy2`/`delete`, which is what the CLI accepts.
- [x] ✅ **CLI contrast number disagreed with the app** — fixed. The CLI printed
      92 (all sheets summed) where the app and PRD say **89** (primary data sheet).
      Both now call one shared `contrastCells()` helper, with a regression test that
      runs the real CLI.
- [x] ✅ **`ADD_ADD` merge conflicts did nothing** — fixed. Both copies adding the same
      key used to be planned as a conflict but never written, whatever the user chose. The
      engine, CLI (`KEY=Copy1|Copy2|both:NEWKEY`) and merge screen now keep either copy's row,
      or both under different keys.
- [ ] **The reader skips formula cells that have no cached value** (SheetJS drops them unless
      `sheetStubs` is on). Excel always saves cached values, but the merged files SheetLens
      writes (Excel recalculates them on open), and files from tools like openpyxl, do not —
      so re-opening those in SheetLens shows the formulas as empty. Worth fixing or documenting
      before users start comparing merged output against its Original.
- [ ] **`npm audit` reports 2 high-severity issues for anyone who installs the
      package** (I ran it on a clean install of the tarball). Both are in `xlsx`
      (SheetJS CE 0.18.5): *Prototype Pollution* (GHSA-4r6h-8v6p-xvw6) and a *ReDoS*
      (GHSA-5pgg-2g8v-p4x9), with "no fix available" **on npm** — SheetJS ships the
      patched releases only from their own CDN. Your choice before publishing:
      1. **Publish as-is and say so in the README** — the engine only parses files the
         user chose to open, locally; the engine's `docs/IMPLEMENTATION_NOTES.md`
         already explains the pinning. Lowest effort, but some users' CI will flag it.
      2. **Depend on SheetJS's CDN tarball** instead. Fixes the audit, but installs
         then need access to `cdn.sheetjs.com`, which some corporate networks block.
      Either is defensible; just make it a deliberate decision, not a surprise.
- [ ] **Password-protected files** are reported as "unsupported" until the optional
      decryptor lands. The README already says "when the optional decryptor is
      installed" — fine, just be aware.
- [ ] **Merge the work to `main`.** `pnpm publish` refuses to run from a branch
      other than `main`/`master` or with uncommitted changes (a good safety net).
      The engine work currently lives on `claude/sheet-lens-project-setup-ywegac`;
      open a PR and merge it first.

### 4.4 Dry run — test the exact tarball first

This is the cheapest way to catch packaging mistakes. It does what a stranger's
`npm install` will do, without publishing anything:

```sh
cd sheet-diff
pnpm pack                                   # -> shivam-dhyani-sheet-diff-0.1.0.tgz

mkdir /tmp/consumer-test && cd /tmp/consumer-test
npm init -y
npm install /path/to/shivam-dhyani-sheet-diff-0.1.0.tgz

node --input-type=module -e "import('@shivam-dhyani/sheet-diff').then(m => console.log(typeof m.compareWorkbooks))"   # function
node -e "console.log(Object.keys(require('@shivam-dhyani/sheet-diff')).length)"                                       # CommonJS works too
npx sheet-diff --help                                                                                                 # the CLI binary works
```

(I ran this: ESM import, CJS require and `npx sheet-diff` all worked.)

### 4.5 Publish **[needs you]**

```sh
cd sheet-diff          # on a clean, up-to-date `main`
pnpm publish --access public
```

- `--access public` is **required the first time** for a scoped package;
  without it npm assumes private (a paid feature) and fails with `E402`.
- `prepublishOnly` automatically runs `pnpm build`, so `dist/` is never stale.
- npm will ask for your 2FA code (or pass `--otp=123456`).

### 4.6 Verify

```sh
npm view @shivam-dhyani/sheet-diff            # shows version 0.1.0
```

Then repeat the §4.4 consumer test but with `npm install @shivam-dhyani/sheet-diff`
(no tarball) in a fresh folder. Your package page is
`https://www.npmjs.com/package/@shivam-dhyani/sheet-diff`.

### 4.7 Releasing new versions

Versions follow semver, with the usual `0.x` convention that the API may still
change. The app should always depend on a *range*, and note the `0.x` quirk:

| Dependency in the app | Accepts | So… |
|---|---|---|
| `^0.1.0` | `0.1.x` only (**not** `0.2.0`) | For `0.x`, a caret locks the minor version. When you release `0.2.0`, bump the app to `^0.2.0` deliberately. |
| `^1.2.0` (after 1.0) | any `1.x` ≥ 1.2.0 | Normal semver. |

```sh
# on a clean main, after merging the change:
npm version patch        # 0.1.0 -> 0.1.1  (bug fix)   | `minor` for features / 0.x breaking changes
git push --follow-tags   # npm version made a commit + a v0.1.1 tag
pnpm publish --access public
```

### 4.8 Optional: publish automatically from GitHub **[not set up]**

Once you're comfortable, you can publish from CI whenever you push a version
tag, with a verified "built from this repo" badge (provenance — needs a public
repo). Add `NPM_TOKEN` (an npm *granular access token* with publish rights) to
the repo's secrets, then `.github/workflows/publish.yml`:

```yaml
name: Publish
on:
  push:
    tags: ['v*']
permissions:
  contents: read
  id-token: write          # needed for provenance
jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm, registry-url: 'https://registry.npmjs.org' }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
      - run: pnpm publish --access public --provenance --no-git-checks
        env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' }
```

I haven't created this file; do the first release by hand (§4.5) so you see
every step once.

### 4.9 Things you can't undo

- **A published version number is permanent.** You can never publish `0.1.0`
  again, even after unpublishing it. A bad release gets a fixed `0.1.1`, plus
  `npm deprecate @shivam-dhyani/sheet-diff@0.1.0 "use 0.1.1"`.
- Unpublishing is heavily restricted (and doesn't free the version). Don't plan on it.
- Everything in the tarball is public. The `"files"` whitelist keeps secrets,
  fixtures and source out — still, glance at `pnpm pack --dry-run` every time.

---

## 5. Switch the app to the published package

After §4.6 succeeds, in `sheet-lens/package.json`:

```diff
-  "@shivam-dhyani/sheet-diff": "file:../sheet-diff",
+  "@shivam-dhyani/sheet-diff": "^0.1.0",
```

```sh
cd sheet-lens
pnpm install                 # now pulls from npm; updates pnpm-lock.yaml
pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm e2e
git add package.json pnpm-lock.yaml && git commit -m "chore: use published @shivam-dhyani/sheet-diff"
```

Also update the "Workflow" note in `sheet-lens/CLAUDE.md` ("production uses the published `0.x`"), which then becomes true.

From now on, local engine development means temporarily switching back to
`link:../sheet-diff` (§2.4), then releasing and bumping the range in the app.

---

## 6. Deploy the app (Cloudflare Pages) **[needs you]**

This is the "normal project" deployment you already know. The reason §4 has to
come first: Cloudflare builds from the `sheet-lens` GitHub repo **only**. There
is no `../sheet-diff` folder on its build machine, so `file:` and `link:` both
fail with "no such directory". The registry version installs fine.

In the Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**:

| Setting | Value |
|---|---|
| Repository | `Shivam-Dhyani/sheet-lens` |
| Production branch | `main` |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Environment variable | `NODE_VERSION` = `22` (or `20`) |

`public/_headers` (already in the repo) is picked up automatically and applies
the strict Content-Security-Policy (`connect-src 'self'` — the app can't call
anything but its own origin). After the first deploy, open the privacy page and
run the sample comparison to confirm "0 requests carrying file data" on the live URL.

Cloudflare detects pnpm from `pnpm-lock.yaml`. Dashboard wording changes over
time — if a setting has moved, check Cloudflare's current Pages docs.

---

## 7. Which approach? Side by side

| | A. Local link only | B. Publish first, then use | **Recommended: A → B → deploy** |
|---|---|---|---|
| Iteration speed | ⭐ instant | slow (publish per change) | ⭐ instant while developing |
| Risk of burning version numbers | none | high | low (publish only when stable) |
| App deployable? | ❌ no | ✅ yes | ✅ yes |
| Others can use the package? | ❌ no | ✅ yes | ✅ yes |
| Works offline / no accounts | ✅ | ❌ needs npm account | ✅ until you publish |

**Recommendation:** run it locally now (§2) and get comfortable. When you're
happy — fix the §4.3 checklist, test the tarball (§4.4), publish `0.1.0`
(§4.5), switch the app (§5), deploy (§6). Treat the package like a product with
its own releases: publish deliberately, develop against the live link.

---

## 8. Troubleshooting

| Symptom | Cause / fix |
|---|---|
| App can't find `@shivam-dhyani/sheet-diff` / "Failed to resolve entry" | Engine not built. `cd sheet-diff && pnpm build` (`dist/` is git-ignored), then reinstall in the app. |
| Engine change doesn't show up in the app | You're on `file:` (a snapshot). Use `link:` (§2.4), or rebuild **and** `pnpm install` in the app. |
| `pnpm install` in the app: `ENOENT ... ../sheet-diff` | The repos aren't side by side, or you're on Cloudflare/CI with `file:`/`link:`. Fix the layout, or publish and use a version (§5). |
| `npm publish` → `E402 Payment Required` | Missing `--access public` on a scoped package. |
| `npm publish` → `E403` / "scope not found" | Your npm username/org isn't `shivam-dhyani` (§4.2 step 3). |
| `npm publish` → `EOTP` | 2FA code needed: `--otp=<code>`. |
| `npm publish` → "You cannot publish over the previously published versions" | That version exists. Bump it (`npm version patch`). |
| `pnpm publish` → "Branch is not on the publish branch" / "unclean working tree" | Merge to `main` and commit everything — or, knowingly, `--no-git-checks`. |
| `pnpm e2e` → browser not found | `pnpm exec playwright install chromium`, or set `PLAYWRIGHT_CHROMIUM_PATH`. |
| `pnpm e2e` → connection refused | e2e serves the production build: run `pnpm build` first. |
| Port 5173 / 4173 already in use | Stop the other process or pass `--port`. (`pnpm e2e` needs 4173.) |
| Offline mode doesn't work in `pnpm dev` | Expected. The service worker only exists in the production build (§2.5). |
| Windows | Everything above works in PowerShell except the `mkdir`/`cd` one-liners — run them separately. Git Bash or WSL also work. |
