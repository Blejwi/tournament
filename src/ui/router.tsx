import { createBrowserRouter, Navigate } from 'react-router';
import { DisplayScreen } from '@/ui/display/DisplayScreen';
import { PrintScreen } from '@/ui/print/PrintScreen';
import { AppShell } from '@/ui/AppShell';
import { CompetitionScreen } from '@/ui/screens/CompetitionScreen';
import { CompetitionsScreen } from '@/ui/screens/CompetitionsScreen';
import { PlayScreen } from '@/ui/screens/PlayScreen';
import { TablesScreen } from '@/ui/screens/TablesScreen';
import { TournamentLayout, type TournamentRouteHandle } from '@/ui/screens/TournamentLayout';
import { TournamentListScreen } from '@/ui/screens/TournamentListScreen';

const fullBleed: TournamentRouteHandle = { fullBleed: true };

export const router = createBrowserRouter([
  // The players' display: outside the operator layout (no header, tabs or panels).
  { path: 'tournaments/:tournamentId/display', element: <DisplayScreen /> },
  // The printout of a finished tournament (#0027): also outside the operator layout.
  { path: 'tournaments/:tournamentId/print', element: <PrintScreen /> },
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TournamentListScreen /> },
      {
        path: 'tournaments/:tournamentId',
        element: <TournamentLayout />,
        children: [
          { index: true, element: <Navigate to="play" replace /> },
          { path: 'play/:competitionId?', element: <PlayScreen />, handle: fullBleed },
          { path: 'competitions', element: <CompetitionsScreen /> },
          { path: 'competitions/:competitionId', element: <CompetitionScreen /> },
          { path: 'tables', element: <TablesScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
], {
  // Vite's `base` (e.g. /tournament/ on GitHub Pages); route paths stay root-relative.
  basename: import.meta.env.BASE_URL.replace(/\/$/, '') || '/',
});
