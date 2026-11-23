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

const splitKey = (id: TournamentId) => `tm:display-split:${id}`;

/** The competitions the operator turned page splitting on for; the others are shown whole on one screen. */
export function loadSplit(id: TournamentId, store: Storage = window.localStorage): CompetitionId[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(splitKey(id)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSplit(id: TournamentId, split: readonly CompetitionId[], store: Storage = window.localStorage): void {
  try {
    store.setItem(splitKey(id), JSON.stringify(split));
  } catch {
    // Storage full or blocked: the choice just won't survive a reload.
  }
}

const hideFinishedKey = (id: TournamentId) => `tm:display-hide-finished:${id}`;

/** The competitions whose finished parts (groups, early rounds) the split display leaves out; by default everything shows. */
export function loadHideFinished(id: TournamentId, store: Storage = window.localStorage): CompetitionId[] {
  try {
    const parsed: unknown = JSON.parse(store.getItem(hideFinishedKey(id)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function saveHideFinished(id: TournamentId, hide: readonly CompetitionId[], store: Storage = window.localStorage): void {
  try {
    store.setItem(hideFinishedKey(id), JSON.stringify(hide));
  } catch {
    // Storage full or blocked: the choice just won't survive a reload.
  }
}
