import { useEffect, useState } from 'react';
import type { TournamentId, TournamentState } from '@/engine';
import { appStorage } from '@/app/useApp';

/**
 * The tournament for the read-only display: loaded through the storage interface (so it is validated
 * and migrated like any opened tournament) and reloaded whenever another window saves it.
 * Never writes, and never touches the operator store. `null` means the tournament doesn't exist (any more).
 */
export function useDisplayTournament(id: TournamentId): TournamentState | null {
  const [state, setState] = useState(() => appStorage.loadTournament(id));
  useEffect(() => {
    const reload = () => setState(appStorage.loadTournament(id));
    reload();
    return appStorage.subscribe(id, reload);
  }, [id]);
  return state;
}
