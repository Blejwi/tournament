import type { BracketSection, CompetitionId, DoubleEliminationStage, DrawState, MatchId, SingleEliminationStage, Stage, StageId } from '../types';
import type { MatchView } from './matches';

/**
 * Bracket layout data (spec: "sections, rounds, order, feeders"). A bracket stage is a list of
 * sections (the main tree, the 3rd-place match; later the winners and losers brackets, the 2nd
 * final, place play-offs), each a list of rounds whose matches run top to bottom. Feeders are on
 * each slot (`SlotView.feeder`), so the UI can draw connector lines and pending slot labels.
 */
export interface BracketSectionView {
  section: BracketSection;
  rounds: BracketRoundView[];
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
}

/** The sections of a bracket stage, in the order their matches first appear in the stage. */
export function bracketSections(stage: Stage, view: (match: MatchId) => MatchView): BracketSectionView[] {
  const sections = new Map<BracketSection, Map<number, MatchView[]>>();
  for (const match of stage.matches) {
    if (match.location.kind !== 'bracket') continue;
    const rounds = sections.get(match.location.section) ?? new Map<number, MatchView[]>();
    sections.set(match.location.section, rounds);
    rounds.set(match.round, [...(rounds.get(match.round) ?? []), view(match.id)]);
  }
  return [...sections].map(([section, rounds]) => ({
    section,
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
  return { type: 'doubleElimination', id: stage.id, competition, index, drawState: stage.drawState, size: firstRound * 2, sections };
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
  };
}
