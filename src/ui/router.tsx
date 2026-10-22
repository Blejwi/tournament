import { createBrowserRouter, Navigate } from 'react-router';
import { AppShell } from '@/ui/AppShell';
import { CompetitionScreen } from '@/ui/screens/CompetitionScreen';
import { CompetitionsScreen } from '@/ui/screens/CompetitionsScreen';
import { PlayersScreen } from '@/ui/screens/PlayersScreen';
import { PlayScreen } from '@/ui/screens/PlayScreen';
import { TablesScreen } from '@/ui/screens/TablesScreen';
import { TournamentLayout, type TournamentRouteHandle } from '@/ui/screens/TournamentLayout';
import { TournamentListScreen } from '@/ui/screens/TournamentListScreen';

const fullBleed: TournamentRouteHandle = { fullBleed: true };

export const router = createBrowserRouter([
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
          { path: 'players', element: <PlayersScreen /> },
        ],
      },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);
