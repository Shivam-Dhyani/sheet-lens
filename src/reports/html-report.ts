import type { ReportModel, MarkedSheet, Scalar } from '@shivam-dhyani/sheet-diff';
import { RowState } from '@shivam-dhyani/sheet-diff';
import { formatValue, serialToDisplayDate } from '../lib/format.ts';

function esc(s: unknown): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function show(v: Scalar, header: string): string {
  if (typeof v === 'number' && /date/i.test(header)) return serialToDisplayDate(v);
  return formatValue(v, header);
}

const STATUS: Record<number, string> = {
  [RowState.Added]: 'added',
  [RowState.Removed]: 'removed',
  [RowState.Changed]: 'changed',
  [RowState.Moved]: 'moved',
};

function overviewRows(m: ReportModel): string {
  const c = m.overview.counts;
  const items: [string, number][] = [
    ['Needs your attention (High)', c.needsAttention],
    ['Review (Medium)', c.toReview],
    ['For information', m.overview.forInformation],
    ['Rows added', c.rowsAdded],
    ['Rows removed', c.rowsRemoved],
    ['Cells edited by hand', c.cellsEditedByHand],
    ['Formulas overwritten', c.formulasOverwritten],
  ];
  return items.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${v}</td></tr>`).join('');
}

function allChangesRows(m: ReportModel): string {
  return m.allChanges
    .map(
      (ch) => `<tr data-risk="${esc(ch.risk)}" data-text="${esc(
        `${ch.where} ${ch.key} ${ch.column} ${ch.whatChanged} ${ch.meaning}`.toLowerCase(),
      )}">
      <td>${ch.index}</td>
      <td><span class="risk ${esc(ch.risk)}">${esc(ch.risk)}</span></td>
      <td>${esc(ch.where)}</td>
      <td>${esc(ch.key)}</td>
      <td>${esc(ch.column)}</td>
      <td>${esc(ch.whatChanged)}</td>
      <td>${esc(show(ch.old, ch.column))}</td>
      <td>${esc(show(ch.new, ch.column))}</td>
      <td>${esc(ch.meaning)}</td>
    </tr>`,
    )
    .join('');
}

function markedSheet(ms: MarkedSheet): string {
  const header = `<tr><th>Status</th>${ms.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr>`;
  const rows = ms.rows
    .map((row) => {
      const label = STATUS[row.status] ?? '';
      const cells = row.cells
        .map((cell, i) => {
          const h = ms.columns[i] ?? '';
          const cls = cell.high ? 'high' : cell.changed ? 'changed' : cell.recalculated ? 'recalc' : '';
          const old =
            cell.changed && cell.oldValue !== undefined
              ? `<span class="was">was ${esc(show(cell.oldValue, h))}</span>`
              : '';
          return `<td class="${cls}">${esc(show(cell.value, h))}${old}</td>`;
        })
        .join('');
      return `<tr class="row-${label}"><td>${label ? `<span class="pill ${label}">${label}</span>` : ''}</td>${cells}</tr>`;
    })
    .join('');
  return `<details open><summary>${esc(ms.name)} (marked)</summary>
    <table class="marked"><thead>${header}</thead><tbody>${rows}</tbody></table></details>`;
}

/**
 * A single self-contained HTML report (FR-REP-02): no external requests, strict
 * CSP, filter/search/expand, print styles. All text is escaped.
 */
export function renderHtmlReport(m: ReportModel): string {
  const style = `
    :root{--ink:#17191e;--soft:#4a4f57;--line:#e2e2dc;--accent:#0e6b66;
      --high:#fbe0cf;--highink:#7a2805;--med:#fcebc0;--medink:#5c3f00;--add:#dce9fb;--addink:#133a6b}
    *{box-sizing:border-box}body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);margin:0;padding:24px;background:#f7f7f4}
    h1{margin:0 0 4px}.sub{color:var(--soft);margin:0 0 16px}
    table{border-collapse:collapse;width:100%;background:#fff;font-size:13px}
    th,td{border:1px solid var(--line);padding:6px 8px;text-align:left;vertical-align:top}
    thead th{position:sticky;top:0;background:#fbfbf9}
    .meta td,.meta th{border:0;padding:2px 8px}
    .risk{font-weight:700;font-size:11px;padding:1px 6px;border-radius:4px}
    .risk.high{background:var(--high);color:var(--highink)}.risk.medium{background:var(--med);color:var(--medink)}.risk.info{background:#ececea}
    td.high{background:var(--high)}td.changed{background:var(--med)}td.recalc{background:var(--add)}
    .was{display:block;font-size:11px;color:#6b6b6b;text-decoration:line-through}
    .pill{font-size:11px;font-weight:700;padding:1px 6px;border-radius:4px}
    .pill.added{background:var(--add);color:var(--addink)}.pill.removed{background:#eee;color:#6b6b6b}.pill.changed{background:var(--med);color:var(--medink)}
    tr.row-removed td{color:#6b6b6b;text-decoration:line-through}
    .controls{margin:12px 0;display:flex;gap:8px;flex-wrap:wrap}
    input,select{font:inherit;padding:6px 8px;border:1px solid var(--line);border-radius:6px}
    details{margin:12px 0;background:#fff;border:1px solid var(--line);border-radius:8px;padding:8px}
    summary{font-weight:600;cursor:pointer}
    @media print{body{padding:0;background:#fff}.controls{display:none}@page{size:A4 landscape;margin:12mm}
      thead{display:table-header-group}details{page-break-inside:avoid}details+details,h2{page-break-before:always}}`;

  const script = `
    (function(){
      var q=document.getElementById('q'),r=document.getElementById('risk');
      function apply(){var t=(q.value||'').toLowerCase(),rv=r.value;
        document.querySelectorAll('#allchanges tbody tr').forEach(function(row){
          var okR=rv==='all'||row.getAttribute('data-risk')===rv;
          var okT=!t||row.getAttribute('data-text').indexOf(t)>=0;
          row.style.display=(okR&&okT)?'':'none';});}
      q.addEventListener('input',apply);r.addEventListener('change',apply);
    })();`;

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:">
<title>SheetLens report — ${esc(m.meta.newFile)} vs ${esc(m.meta.oldFile)}</title>
<style>${style}</style>
</head><body>
<h1>SheetLens report</h1>
<p class="sub">Generated in the browser — your files were not uploaded anywhere.</p>
<table class="meta">
  <tr><th>Old file</th><td>${esc(m.meta.oldFile)}</td></tr>
  <tr><th>New file</th><td>${esc(m.meta.newFile)}</td></tr>
  <tr><th>Rows matched by</th><td>${esc(m.meta.matchedBy)}</td></tr>
  <tr><th>Generated</th><td>${esc(m.meta.generated)}</td></tr>
</table>
<h2>At a glance</h2>
<table class="meta">${overviewRows(m)}
  <tr><th>Contrast</th><td>A basic cell-by-cell compare would flag ${m.overview.contrastCells} cells.</td></tr>
</table>
<h2>All changes — most important first</h2>
<div class="controls">
  <input id="q" type="search" placeholder="Search changes…" aria-label="Search changes">
  <select id="risk" aria-label="Filter by risk"><option value="all">All risks</option>
    <option value="high">High</option><option value="medium">Medium</option><option value="info">Info</option></select>
</div>
<table id="allchanges"><thead><tr><th>#</th><th>Risk</th><th>Where</th><th>Invoice / Row</th><th>Column</th><th>What changed</th><th>Old</th><th>New</th><th>What it means</th></tr></thead>
<tbody>${allChangesRows(m)}</tbody></table>
<h2>Sheets (marked)</h2>
${m.markedSheets.map(markedSheet).join('')}
<script>${script}</script>
</body></html>`;
}
