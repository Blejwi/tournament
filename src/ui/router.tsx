import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/ui/AppShell';
import { PlayersScreen } from '@/ui/screens/PlayersScreen';
import { TablesScreen } from '@/ui/screens/TablesScreen';
import { TournamentLayout } from '@/ui/screens/TournamentLayout';
import { TournamentListScreen } from '@/ui/screens/TournamentListScreen';

export const router = createBrowserRouter([
  {
    element: <AppShell />,
    children: [
      { index: true, element: <TournamentListScreen /> },
      {
        path: 'tournaments/:tournamentId',
        element: <TournamentLayout />,
        children: [
          { index: true, element: <Navigate to="tables" replace /> },
          { path: 'tables', element: <TablesScreen /> },
          { path: 'players', element: <PlayersScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
