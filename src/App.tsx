import { Link, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { PasswordDialog } from './features/intake/PasswordDialog.tsx';
import { PwaPrompt } from './pwa/PwaPrompt.tsx';

export function App() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = (): void => setOnline(true);
    const off = (): void => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <Link to="/" className="brand" aria-label="SheetLens home">
          <span className="brand-mark" aria-hidden="true">◧</span> SheetLens
        </Link>
        <nav className="app-nav">
          <span className="offline-badge" title="Works offline · Nothing uploaded">
            {online ? '● Online' : '○ Offline'} · Nothing uploaded
          </span>
          <Link to="/privacy">How do I know?</Link>
        </nav>
      </header>
      <Outlet />
      <footer className="app-footer">
        <small>SheetLens — Compare Excel files instantly, privately. Your files never leave this device.</small>
      </footer>
      <PasswordDialog />
      <PwaPrompt />
    </div>
  );
}
