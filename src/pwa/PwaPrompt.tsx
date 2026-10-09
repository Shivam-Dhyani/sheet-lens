import { useRegisterSW } from 'virtual:pwa-register/react';

/**
 * Offline + update UX (FR-PRV-03). The service worker precaches the app and the
 * engine, so after the first visit SheetLens works with no network. When a new
 * version is deployed we ask before reloading rather than swapping under the
 * user mid-compare.
 */
export function PwaPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  if (!offlineReady && !needRefresh) return null;

  const dismiss = (): void => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  return (
    <div className="toast" role="status" aria-live="polite">
      {needRefresh ? (
        <>
          <span>A new version of SheetLens is ready.</span>
          <button className="btn" onClick={() => void updateServiceWorker(true)}>
            Reload
          </button>
          <button className="btn secondary" onClick={dismiss}>
            Later
          </button>
        </>
      ) : (
        <>
          <span>Ready to work offline — your files stay on this device.</span>
          <button className="btn secondary" onClick={dismiss}>
            Dismiss
          </button>
        </>
      )}
    </div>
  );
}
