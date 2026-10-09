import { useMemo, useState } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { useSession } from '../../store/session.ts';
import { getEngine } from '../../worker/client.ts';
import { reportFileName } from '../../reports/filename.ts';
import { downloadBlob } from '../../reports/download.ts';
import { DiffGrid } from './DiffGrid.tsx';
import type { Finding, ReportChange } from '@shivam-dhyani/sheet-diff';

export function ComparePage() {
  const { summary, slots, ui, selectFinding, setActivePair, setFilter } = useSession();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState<'xlsx' | 'html' | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const changeByFinding = useMemo(() => {
    const m = new Map<string, ReportChange>();
    if (summary) for (const c of summary.allChanges) m.set(`${c.rule}|${c.key}|${c.column}`, c);
    return m;
  }, [summary]);

  if (!summary) return <Navigate to="/" replace />;

  const { counts, findings, overview, pairs } = summary;
  const matched = pairs.filter((p) => p.status === 'matched' || p.status === 'renamed');
  const activePair = pairs.find((p) => p.id === ui.activePair) ?? matched[0];
  const selected = findings.find((f) => f.id === ui.selectedFindingId) ?? null;

  const newName = slots.new?.fileName ?? 'new.xlsx';
  const oldName = slots.old?.fileName ?? 'old.xlsx';

  const copy = async (): Promise<void> => {
    await navigator.clipboard.writeText(summary.copySummary);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const downloadExcel = async (): Promise<void> => {
    setBusy('xlsx');
    setExportError(null);
    try {
      const buf = await getEngine().buildExcelReport();
      if (!buf) throw new Error('No comparison to export.');
      const blob = new Blob([buf], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      downloadBlob(blob, reportFileName(newName, oldName, 'xlsx'));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const downloadHtml = async (): Promise<void> => {
    setBusy('html');
    setExportError(null);
    try {
      const html = await getEngine().buildHtmlReport();
      if (!html) throw new Error('No comparison to export.');
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      downloadBlob(blob, reportFileName(newName, oldName, 'html'));
    } catch (e) {
      setExportError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="page">
      <div className="headline">
        <h2 data-testid="headline">
          {counts.realChanges === 0
            ? 'No differences — these files contain the same data.'
            : `${counts.realChanges} real change${counts.realChanges === 1 ? '' : 's'} found — ${counts.needsAttention} need your attention.`}
        </h2>
        {counts.realChanges > 0 && (
          <div className="contrast">
            A basic cell-by-cell compare would flag {overview.contrastCells} cells. · Matched by{' '}
            {overview.matchedBy} · <Link to="/setup">Change how rows are matched</Link>
          </div>
        )}
        <div className="actions" style={{ justifyContent: 'flex-start' }}>
          <button className="btn secondary" onClick={copy}>
            {copied ? 'Copied ✓' : 'Copy summary'}
          </button>
          <button
            className="btn secondary"
            onClick={downloadExcel}
            disabled={busy !== null}
            data-testid="download-excel"
          >
            {busy === 'xlsx' ? 'Preparing…' : 'Download Excel report'}
          </button>
          <button
            className="btn secondary"
            onClick={downloadHtml}
            disabled={busy !== null}
            data-testid="download-html"
          >
            {busy === 'html' ? 'Preparing…' : 'Download HTML report'}
          </button>
        </div>
        {exportError && (
          <div className="contrast" role="alert" style={{ color: 'var(--danger, #7a2805)' }}>
            {exportError}
          </div>
        )}
      </div>

      <div className="cards">
        <Card n={counts.needsAttention} label="Needs attention" attention />
        <Card n={counts.toReview} label="To review" />
        <Card n={counts.rowsAdded} label="Rows added" />
        <Card n={counts.rowsRemoved} label="Rows removed" />
        <Card n={counts.cellsEditedByHand} label="Cells edited by hand" />
        <Card n={counts.formulasOverwritten} label="Formulas overwritten" />
      </div>

      <div className="results-grid">
        <div className="findings" role="listbox" aria-label="Findings">
          <h3>Needs attention first</h3>
          {findings.length === 0 && <div className="finding">No findings.</div>}
          {findings.map((f) => (
            <button
              key={f.id}
              className="finding"
              role="option"
              aria-selected={f.id === ui.selectedFindingId}
              onClick={() => selectFinding(f.id)}
            >
              <div>
                <span className={`sev ${f.severity}`}>{f.severity.toUpperCase()}</span>
                <span className="title">{f.title}</span>
              </div>
              <div className="msg">{f.message}</div>
            </button>
          ))}
        </div>

        <div>
          {selected ? (
            <DetailPanel finding={selected} change={lookup(changeByFinding, selected)} />
          ) : (
            <div className="detail">Select a finding to see its old value, new value and what it means.</div>
          )}

          <div style={{ marginTop: 'var(--gap)' }}>
            <div className="tabs" role="tablist" aria-label="Sheets">
              {matched.map((p) => (
                <button
                  key={p.id}
                  className="tab"
                  role="tab"
                  aria-selected={p.id === activePair?.id}
                  onClick={() => setActivePair(p.id)}
                >
                  {p.newName ?? p.oldName}
                </button>
              ))}
              {pairs
                .filter((p) => p.status === 'added' || p.status === 'removed')
                .map((p) => (
                  <span key={p.id} className="tab" aria-disabled>
                    {p.newName ?? p.oldName} ({p.status})
                  </span>
                ))}
            </div>

            <div className="actions" style={{ justifyContent: 'flex-start', margin: '0 0 8px' }}>
              <label>
                <input
                  type="radio"
                  name="filter"
                  checked={ui.filter === 'changed'}
                  onChange={() => setFilter('changed')}
                />{' '}
                Changed rows only
              </label>
              <label>
                <input
                  type="radio"
                  name="filter"
                  checked={ui.filter === 'all'}
                  onChange={() => setFilter('all')}
                />{' '}
                All rows
              </label>
            </div>

            {activePair?.newName && <DiffGrid sheetName={activePair.newName} filter={ui.filter} />}
          </div>
        </div>
      </div>
    </main>
  );
}

function lookup(map: Map<string, ReportChange>, f: Finding): ReportChange | undefined {
  return map.get(`${f.rule}|${f.key ?? '—'}|${f.column ?? '—'}`);
}

function Card({ n, label, attention }: { n: number; label: string; attention?: boolean }) {
  return (
    <div className={`card${attention ? ' attention' : ''}`}>
      <div className="n">{n}</div>
      <div className="label">{label}</div>
    </div>
  );
}

function DetailPanel({ finding, change }: { finding: Finding; change?: ReportChange }) {
  return (
    <div className="detail">
      <h3>
        <span className={`sev ${finding.severity}`}>{finding.severity.toUpperCase()}</span> {finding.title}
      </h3>
      {change && (change.old !== null || change.new !== null) && (
        <p>
          {finding.key && <strong>{finding.key}</strong>} {finding.column && `· ${finding.column}`}
          <br />
          <span className="old">{String(change.old ?? '—')}</span> →{' '}
          <span className="new">{String(change.new ?? '—')}</span>
        </p>
      )}
      <p>{finding.message}</p>
    </div>
  );
}
