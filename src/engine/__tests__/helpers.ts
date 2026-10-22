import { createTournament, type EngineError, type Result, type TournamentState } from '@/engine';

/** Returns the value of a successful result, or fails the test with the engine error. */
export function unwrap<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`Expected success, got engine error: ${JSON.stringify(result.error)}`);
  return result.value;
}

/** Returns the error of a failed result, or fails the test. */
export function errorOf<T>(result: Result<T>): EngineError {
  if (result.ok) throw new Error('Expected an engine error, but the command succeeded');
  return result.error;
}

export function newTournament(): TournamentState {
  return unwrap(createTournament({ id: 'spring', name: 'Spring Open', date: '2026-05-01', venue: 'City Hall' }));
}
