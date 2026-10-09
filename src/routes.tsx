import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App.tsx';
import { LandingPage } from './features/landing/LandingPage.tsx';
import { ComparePage } from './features/results/ComparePage.tsx';
import { MergePage } from './features/merge/MergePage.tsx';
import { SetupPage } from './features/setup/SetupPage.tsx';
import { PrivacyPage } from './features/privacy/PrivacyPage.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'setup', element: <SetupPage /> },
      { path: 'merge', element: <MergePage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
