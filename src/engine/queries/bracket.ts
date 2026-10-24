import { findPlayOff, parentPlayOff, playOffRanges } from '../stages/playOffs';
import type {
  BracketSection,
  CompetitionId,
  DoubleEliminationStage,
  DrawState,
  MatchId,
  PlaceRange,
  SingleEliminationStage,
  Stage,
  StageId,
} from '../types';
import type { MatchView } from './matches';

/**
 * Bracket layout data (spec: "sections, rounds, order, feeders"). A bracket stage is a list of
 * sections (the main tree, the 3rd-place match; later the winners and losers brackets, the 2nd
 * final, place play-offs), each a list of rounds whose matches run top to bottom. Feeders are on
 * each slot (`SlotView.feeder`), so the UI can draw connector lines and pending slot labels.
 */
export interface BracketSectionView {
  section: BracketSection;
  /** For a `playOff` section: the shared place range it splits (e.g. 9–12); null for every other section. */
  playOff: PlaceRange | null;
  rounds: BracketRoundView[];
}

/** A place play-off a bracket stage can have (#0012): one per shared place range, e.g. 9–12. */
export interface PlayOffView {
  range: PlaceRange;
  /** The play-off whose halves include this range (9–12 for 9–10); null for a range of the main draw. */
  parent: PlaceRange | null;
  /** Switched on right now; a switched-off play-off that has matches shows them as disabled. */
  enabled: boolean;
  /** Its matches exist (it was switched on at least once), so it has a `playOff` section. */
  created: boolean;
}

/**
 * The place play-offs a bracket stage can have right now, best range first (a play-off before its
 * halves); none before the draw. The halves of a play-off are listed while it is on.
 */
export function playOffViews(stage: Stage): PlayOffView[] {
  return playOffRanges(stage).map((range) => {
    const playOff = findPlayOff(stage, range);
    const parent = parentPlayOff(stage, range);
    return { range: { ...range }, parent: parent ? { ...parent } : null, enabled: playOff?.enabled ?? false, created: playOff !== undefined };
  });
}

export interface BracketRoundView {
  round: number;
  /** Top to bottom. */
  matches: MatchView[];
}

export interface SingleEliminationStageView {
  type: 'singleElimination';
  id: StageId;
  competition: CompetitionId;
  index: number;
  drawState: DrawState;
  thirdPlace: boolean;
  /** Bracket positions (8, 16, 32 or 64); 0 before the draw. */
  size: number;
  sections: BracketSectionView[];
  playOffs: PlayOffView[];
}

/** The sections of a bracket stage, in the order their matches first appear in the stage. */
export function bracketSections(stage: Stage, view: (match: MatchId) => MatchView): BracketSectionView[] {
  // One block per section; every play-off range is a section of its own.
  const sections = new Map<string, { section: BracketSection; playOff: PlaceRange | null; rounds: Map<number, MatchView[]> }>();
  for (const match of stage.matches) {
    if (match.location.kind !== 'bracket') continue;
    const key = match.playOff ? `${match.location.section}:${match.playOff.from}-${match.playOff.to}` : match.location.section;
    const found = sections.get(key) ?? {
      section: match.location.section,
      playOff: match.playOff ? { ...match.playOff } : null,
      rounds: new Map<number, MatchView[]>(),
    };
    sections.set(key, found);
    found.rounds.set(match.round, [...(found.rounds.get(match.round) ?? []), view(match.id)]);
  }
  return [...sections.values()].map(({ section, playOff, rounds }) => ({
    section,
    playOff,
    rounds: [...rounds]
      .sort(([a], [b]) => a - b)
      .map(([round, matches]) => ({ round, matches: matches.sort((a, b) => a.order - b.order) })),
  }));
}

export interface DoubleEliminationStageView {
  type: 'doubleElimination';
  id: StageId;
  competition: CompetitionId;
  index: number;
  drawState: DrawState;
  /** Bracket positions (8, 16, 32 or 64); 0 before the draw. */
  size: number;
  /** `winners`, `losers` (round r = losers round LRr) and `secondFinal`, once drawn. */
  sections: BracketSectionView[];
  playOffs: PlayOffView[];
}

/** A stage drawn as a bracket. */
export type BracketStageView = SingleEliminationStageView | DoubleEliminationStageView;

export function doubleEliminationView(
  stage: DoubleEliminationStage,
  competition: CompetitionId,
  index: number,
  view: (match: MatchId) => MatchView,
): DoubleEliminationStageView {
  const sections = bracketSections(stage, view);
  const firstRound = sections.find((s) => s.section === 'winners')?.rounds[0]?.matches.length ?? 0;
  return { type: 'doubleElimination', id: stage.id, competition, index, drawState: stage.drawState, size: firstRound * 2, sections, playOffs: playOffViews(stage) };
}

export function singleEliminationView(
  stage: SingleEliminationStage,
  competition: CompetitionId,
  index: number,
  view: (match: MatchId) => MatchView,
): SingleEliminationStageView {
  const sections = bracketSections(stage, view);
  const firstRound = sections.find((s) => s.section === 'main')?.rounds[0]?.matches.length ?? 0;
  return {
    type: 'singleElimination',
    id: stage.id,
    competition,
    index,
    drawState: stage.drawState,
    thirdPlace: stage.thirdPlace,
    size: firstRound * 2,
    sections,
    playOffs: playOffViews(stage),
  };
}
