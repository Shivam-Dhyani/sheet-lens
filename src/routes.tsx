import { createBrowserRouter, Navigate } from 'react-router-dom';
import { App } from './App.tsx';
import { LandingPage } from './features/landing/LandingPage.tsx';
import { ComparePage } from './features/results/ComparePage.tsx';
import { PrivacyPage } from './features/privacy/PrivacyPage.tsx';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <LandingPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'privacy', element: <PrivacyPage /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
