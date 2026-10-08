import { useMemo } from 'react';
import { requestsSinceMarker } from '../../lib/network-log.ts';

export function PrivacyPage() {
  const requests = useMemo(() => requestsSinceMarker(), []);
  const external = requests.filter((r) => {
    try {
      return new URL(r.name).origin !== window.location.origin;
    } catch {
      return false;
    }
  });

  return (
    <main className="page">
      <h2>How do I know my files aren&rsquo;t uploaded?</h2>
      <p>
        SheetLens reads your files with the browser&rsquo;s File API and compares them on this
        device. Nothing is sent to a server — there is no server. A strict Content-Security-Policy
        blocks any third-party request.
      </p>
      <h3>Network requests since you added files</h3>
      <div className="net-log">
        {external.length === 0 ? (
          <span className="net-ok">0 requests carrying file data since you added files.</span>
        ) : (
          <ul>
            {external.map((r, i) => (
              <li key={i}>
                {r.initiatorType}: {r.name} ({r.transferSize} bytes)
              </li>
            ))}
          </ul>
        )}
        {requests.length > 0 && (
          <p style={{ color: 'var(--ink-soft)' }}>
            ({requests.length} same-origin asset request{requests.length === 1 ? '' : 's'} — the app
            itself.)
          </p>
        )}
      </div>
      <h3>Prefer to be sure?</h3>
      <p>Turn on airplane mode, reload this page, and compare your files. It still works offline.</p>
    </main>
  );
}
