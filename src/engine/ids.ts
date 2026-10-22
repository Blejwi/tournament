import type { TournamentState } from './types';

/** Allocates a new id with the given prefix, e.g. "table-3". Ids are never reused. */
export function allocateId(state: TournamentState, prefix: string): [string, TournamentState] {
  return [`${prefix}-${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}

/** Allocates many ids in one go (e.g. a draw's matches); `commit` writes the counter back to the state. */
export interface IdSource {
  next(prefix: string): string;
  commit(state: TournamentState): TournamentState;
}

export function idSource(state: TournamentState): IdSource {
  let nextId = state.nextId;
  return {
    next: (prefix) => `${prefix}-${nextId++}`,
    commit: (s) => ({ ...s, nextId }),
  };
}
