import type { CompetitionId, TournamentId } from '@/engine';

/**
 * The display screen's cycle choice: which competitions the operator took out of the cycle.
 * A preference of this browser, kept under its own key, outside the tournament file and the change log.
 */
const key = (id: TournamentId) => `tm:display:${id}`;

/** The excluded competition ids; empty when nothing is stored or the stored value is unusable. */
export function loadExcluded(id: TournamentId, store: Storage = window.localStorage): CompetitionId[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(key(id)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveExcluded(id: TournamentId, excluded: readonly CompetitionId[], store: Storage = window.localStorage): void {
  try {
    store.setItem(key(id), JSON.stringify(excluded));
  } catch {
    // Storage full or blocked: the choice just won't survive a reload.
  }
}
