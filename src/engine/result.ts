import type { EngineError } from './errors';

/** What every engine command returns: the new value, or a typed error. */
export type Result<T> = { ok: true; value: T } | { ok: false; error: EngineError };

export const ok = <T>(value: T): Result<T> => ({ ok: true, value });
export const fail = <T = never>(error: EngineError): Result<T> => ({ ok: false, error });
