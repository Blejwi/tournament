import { z } from 'zod';
import type {
  Competition,
  DoubleEliminationStage,
  Entry,
  Group,
  LogEntry,
  LoggedDrawPlace,
  SpecialResult,
  LoggedMatch,
  LoggedTable,
  GroupsStage,
  Match,
  MatchResult,
  PlaceRange,
  PlayOff,
  Player,
  SingleEliminationStage,
  SlotSource,
  Stage,
  Table,
  TieResolution,
  TournamentState,
} from '../types';
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

const id = z.string().min(1);
const timestamp = z.number().int().nullable();
const points = z.number().int().min(0);
const minutes = z.number().int().min(1);
const slotIndex = z.union([z.literal(0), z.literal(1)]);

const entrySchema = z.object({
  id,
  players: z.array(id).min(1),
  seed: z.number().int().min(1).nullable(),
  withdrawnAt: timestamp,
}) satisfies z.ZodType<Entry>;

const slotSourceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('entry'), entry: id }),
  z.object({ kind: z.literal('groupPlace'), stage: id, group: id, place: z.number().int().min(1) }),
  z.object({ kind: z.literal('matchResult'), match: id, take: z.enum(['winner', 'loser']) }),
  z.object({ kind: z.literal('bye') }),
]) satisfies z.ZodType<SlotSource>;

const specialResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('walkover'), winner: slotIndex }),
  z.object({ kind: z.literal('retirement'), winner: slotIndex, games: z.array(z.tuple([points, points])) }),
  z.object({ kind: z.literal('disqualification'), winner: slotIndex }),
]) satisfies z.ZodType<SpecialResult>;

const matchResultSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('games'), games: z.array(z.tuple([points, points])) }),
  z.object({ kind: z.literal('gamesOnly'), games: z.tuple([points, points]) }),
  ...specialResultSchema.options,
]) satisfies z.ZodType<MatchResult>;

const placeRangeSchema = z
  .object({ from: z.number().int().min(1), to: z.number().int().min(1) })
  .refine((r) => r.from <= r.to, 'A place range must not end before it starts') satisfies z.ZodType<PlaceRange>;

const matchSchema = z.object({
  id,
  location: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('group'), group: id }),
    z.object({ kind: z.literal('bracket'), section: z.enum(['main', 'thirdPlace', 'winners', 'losers', 'secondFinal', 'playOff']) }),
  ]),
  round: z.number().int().min(1),
  order: z.number().int().min(1),
  slots: z.tuple([slotSourceSchema, slotSourceSchema]),
  table: id.nullable(),
  assignedAt: timestamp,
  result: matchResultSchema.nullable(),
  finishedAt: timestamp,
  places: z.object({ winner: placeRangeSchema.nullable(), loser: placeRangeSchema.nullable() }).optional(),
  playOff: placeRangeSchema.optional(),
}) satisfies z.ZodType<Match>;

const tieResolutionSchema = z.object({
  entries: z
    .array(id)
    .min(2)
    .refine((entries) => new Set(entries).size === entries.length, 'Duplicate entry'),
  method: z.enum(['decision', 'lot']),
}) satisfies z.ZodType<TieResolution>;

const groupSchema = z.object({
  id,
  name: z.string().min(1),
  entries: z.array(slotSourceSchema),
  tieResolutions: z.array(tieResolutionSchema),
}) satisfies z.ZodType<Group>;

const groupsStageSchema = z.object({
  id,
  type: z.literal('groups'),
  drawState: z.enum(['notDrawn', 'drawn', 'confirmed']),
  grouping: z.discriminatedUnion('by', [
    z.object({ by: z.literal('count'), groups: z.number().int().min(1) }),
    z.object({ by: z.literal('size'), size: z.number().int().min(2) }),
  ]),
  groups: uniqueArray(groupSchema, ['id', 'name']),
  carryOver: z.boolean(),
  matches: uniqueArray(matchSchema, ['id']),
}) satisfies z.ZodType<GroupsStage>;

const playOffSchema = z.object({ range: placeRangeSchema, enabled: z.boolean() }) satisfies z.ZodType<PlayOff>;

const singleEliminationStageSchema = z.object({
  id,
  type: z.literal('singleElimination'),
  drawState: z.enum(['notDrawn', 'drawn', 'confirmed']),
  thirdPlace: z.boolean(),
  playOffs: z.array(playOffSchema),
  matches: uniqueArray(matchSchema, ['id']),
}) satisfies z.ZodType<SingleEliminationStage>;

const doubleEliminationStageSchema = z.object({
  id,
  type: z.literal('doubleElimination'),
  drawState: z.enum(['notDrawn', 'drawn', 'confirmed']),
  playOffs: z.array(playOffSchema),
  matches: uniqueArray(matchSchema, ['id']),
}) satisfies z.ZodType<DoubleEliminationStage>;

/** One option per stage type. */
const stageSchema = z.discriminatedUnion('type', [
  groupsStageSchema,
  singleEliminationStageSchema,
  doubleEliminationStageSchema,
]) satisfies z.ZodType<Stage>;

const competitionSchema = z.object({
  id,
  name: z.string().min(1),
  gamesToWin: z.union([z.literal(2), z.literal(3), z.literal(4)]),
  entries: uniqueArray(entrySchema, ['id']),
  stages: z.array(stageSchema),
}) satisfies z.ZodType<Competition>;

export const tournamentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  date: z.string().refine(isIsoDate, 'Not a YYYY-MM-DD date'),
  venue: z.string(),
  tables: uniqueArray(tableSchema, ['id', 'number']),
  players: uniqueArray(playerSchema, ['id']),
  competitions: uniqueArray(competitionSchema, ['id']),
  expectedDurations: z.object({ 2: minutes, 3: minutes, 4: minutes }),
  nextId: z.number().int().min(1),
}) satisfies z.ZodType<Omit<TournamentState, 'log'>>;

const loggedMatchSchema = z.object({
  competition: id,
  stage: id,
  match: id,
  players: z.tuple([z.array(id), z.array(id)]),
}) satisfies z.ZodType<LoggedMatch>;

const loggedTableSchema = z.object({ table: id, number: z.number().int().min(1) }) satisfies z.ZodType<LoggedTable>;

const at = z.number().int();

const loggedDrawPlaceSchema = z.object({
  group: z.string().nullable(),
  position: z.number().int().min(1),
  players: z.array(id),
}) satisfies z.ZodType<LoggedDrawPlace>;

/** One option per change-log entry type (see `LogEntry`). */
const logEntrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('matchAssigned'), at, match: loggedMatchSchema, table: loggedTableSchema }),
  z.object({ type: z.literal('matchUnassigned'), at, match: loggedMatchSchema, table: loggedTableSchema }),
  z.object({
    type: z.literal('resultRecorded'),
    at,
    match: loggedMatchSchema,
    result: matchResultSchema,
    table: loggedTableSchema.nullable(),
  }),
  z.object({ type: z.literal('drawSlotsSwapped'), at, competition: id, stage: id, a: loggedDrawPlaceSchema, b: loggedDrawPlaceSchema }),
  z.object({ type: z.literal('drawPlayerMoved'), at, competition: id, stage: id, from: loggedDrawPlaceSchema, to: loggedDrawPlaceSchema }),
  z.object({
    type: z.literal('specialResultRecorded'),
    at,
    match: loggedMatchSchema,
    result: specialResultSchema,
    table: loggedTableSchema.nullable(),
  }),
  z.object({ type: z.literal('playerWithdrew'), at, competition: id, players: z.array(id) }),
  z.object({
    type: z.literal('resultCorrected'),
    at,
    match: loggedMatchSchema,
    before: matchResultSchema,
    after: matchResultSchema,
    reset: z.array(loggedMatchSchema),
  }),
  z.object({ type: z.literal('playOffSet'), at, competition: id, stage: id, range: placeRangeSchema, enabled: z.boolean() }),
]) satisfies z.ZodType<LogEntry>;

/** The change log section (the state's `log`, kept out of `tournament` in the file), oldest first. */
export const logSchema = z.array(logEntrySchema);

export const fileSchema = z.object({
  schemaVersion: z.number().int(),
  tournament: tournamentSchema,
  log: logSchema,
});

export type TournamentFile = z.infer<typeof fileSchema>;
