import type { TournamentState } from './types';

/** Allocates a new id with the given prefix, e.g. "table-3". Ids are never reused. */
export function allocateId(state: TournamentState, prefix: string): [string, TournamentState] {
  return [`${prefix}-${state.nextId}`, { ...state, nextId: state.nextId + 1 }];
}
