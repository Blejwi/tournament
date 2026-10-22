import { z } from 'zod';
import type { Player, Table, TournamentState } from '../types';
import { isIsoDate } from '../validation';

/**
 * Zod schema of the CURRENT tournament file version. One schema per state section.
 * `satisfies z.ZodType<...>` makes TypeScript fail when the state type gains a field the
 * schema doesn't validate yet, so the file format can't silently drift from the state.
 */

/** An array whose items must not repeat a value of the given fields (e.g. ids). */
function uniqueArray<T extends z.ZodObject>(item: T, fields: (keyof z.infer<T> & string)[]) {
  return z.array(item).superRefine((items, ctx) => {
    for (const field of fields) {
      const seen = new Set<unknown>();
      items.forEach((value, index) => {
        const key = (value as Record<string, unknown>)[field];
        if (seen.has(key)) ctx.addIssue({ code: 'custom', message: `Duplicate ${field}`, path: [index, field] });
        seen.add(key);
      });
    }
  });
}

const tableSchema = z.object({
  id: z.string().min(1),
  number: z.number().int().min(1),
  name: z.string(),
  active: z.boolean(),
}) satisfies z.ZodType<Table>;

const playerSchema = z.object({
  id: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  club: z.string(),
  rating: z.number().min(0).nullable(),
  birthYear: z.number().int().nullable(),
}) satisfies z.ZodType<Player>;

export const tournamentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  date: z.string().refine(isIsoDate, 'Not a YYYY-MM-DD date'),
  venue: z.string(),
  tables: uniqueArray(tableSchema, ['id', 'number']),
  players: uniqueArray(playerSchema, ['id']),
  nextId: z.number().int().min(1),
}) satisfies z.ZodType<TournamentState>;

/**
 * The change log section. The log doesn't exist yet (#0016): files carry an empty array,
 * and any entries are accepted unchecked until #0016 gives them a schema.
 */
export const logSchema = z.array(z.unknown());

export const fileSchema = z.object({
  schemaVersion: z.number().int(),
  tournament: tournamentSchema,
  log: logSchema,
});

export type TournamentFile = z.infer<typeof fileSchema>;
