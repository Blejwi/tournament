import type { EntryPlayerView, EntryView, GameScore } from '@/engine';

/** Formats an ISO date (YYYY-MM-DD) for display in the given language. */
export function formatDate(isoDate: string, language: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  if (!year || !month || !day) return isoDate;
  return new Intl.DateTimeFormat(language, { dateStyle: 'medium', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day)),
  );
}

/** A player's name, e.g. "J. Kowalski" (short) or "Jan Kowalski". */
export function playerName(player: EntryPlayerView, short = true): string {
  return short ? `${player.firstName.slice(0, 1)}. ${player.lastName}` : `${player.firstName} ${player.lastName}`;
}

/** An entry's name, e.g. "J. Kowalski" (short) or "Jan Kowalski"; null when the slot isn't decided. */
export function entryName(entry: EntryView | null, short = true): string | null {
  if (!entry) return null;
  return entry.players.map((p) => playerName(p, short)).join(' / ');
}

/** Elapsed time as m:ss (or h:mm:ss). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const [h, m, s] = [Math.floor(total / 3600), Math.floor((total % 3600) / 60), total % 60];
  const pad = (n: number) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

/** Game scores as typed: "11-7 9-11 11-5". */
export function formatGames(games: GameScore[]): string {
  return games.map(([a, b]) => `${a}-${b}`).join(' ');
}

/** A random seed for a draw. The engine never makes randomness itself (ADR 0004). */
export function newRandomSeed(): number {
  return crypto.getRandomValues(new Uint32Array(1))[0];
}

/** Today's date as YYYY-MM-DD in local time (UI default for new tournaments). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
