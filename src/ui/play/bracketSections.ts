import type { TFunction } from 'i18next';
import type { BracketStageView, PlaceRange } from '@/engine';
import { doubleEliminationRoundTitle, formatPlace, roundTitle } from '@/ui/matchLabels';
import type { PlayOffLayout } from '@/ui/usePlayOffLayout';
import type { LayoutSection } from './bracketLayout';

/** Groups in a roughly square grid. */
export const groupColumns = (count: number) => Math.min(count, Math.max(1, Math.ceil(Math.sqrt(count))));

/** The labelled sections of a bracket stage, as the layout wants them. */
export function bracketLayoutSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  return [...bracketMainSections(t, stage, layout), ...playOffSections(t, stage, layout)];
}

/**
 * One block per place play-off the stage can have: its matches once created, otherwise just the
 * title and switch. A play-off and the play-offs of its halves form a tree: the winners' half to
 * the right, the losers' half to the left (or under the winners' with the `below` layout); deeper
 * halves keep to their side.
 */
function playOffSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  const keyOf = (r: PlaceRange) => `playOff-${r.from}-${r.to}`;
  type Side = 'top' | 'left' | 'right';
  const placed = new Map<string, { tree: string; column: number; side: Side }>();
  return stage.playOffs.map((playOff) => {
    const key = keyOf(playOff.range);
    const parent = playOff.parent ? placed.get(keyOf(playOff.parent)) : undefined;
    const winnersHalf = playOff.parent?.from === playOff.range.from;
    const side: Side = !parent ? 'top' : parent.side !== 'top' ? parent.side : layout === 'left' && !winnersHalf ? 'left' : 'right';
    const at = { tree: parent?.tree ?? key, column: parent ? parent.column + (side === 'left' ? -1 : 1) : 0, side };
    placed.set(key, at);

    const range = formatPlace(playOff.range);
    const created = stage.sections.find((s) => s.playOff?.from === playOff.range.from && s.playOff.to === playOff.range.to);
    const { from, to } = playOff.range;
    const half = (to - from + 1) / 2;
    const halves = { winners: formatPlace({ from, to: from + half - 1 }), losers: formatPlace({ from: from + half, to }) };
    return {
      key,
      title: t('bracket.sections.playOff', { range }),
      subtitle: playOff.enabled
        ? t(half === 1 ? 'bracket.sectionHints.playOffOnPair' : 'bracket.sectionHints.playOffOn', halves)
        : t('bracket.sectionHints.playOffOff', { range }),
      rounds: created?.rounds.map((r) => r.matches) ?? [],
      playOff,
      tree: { key: at.tree, column: at.column, parent: playOff.parent ? keyOf(playOff.parent) : undefined },
    };
  });
}

/**
 * The format's own sections (not the play-offs). In double elimination the `left` layout mirrors
 * the losers bracket: it runs leftwards from beside the winners bracket, the 2nd final left of its final.
 */
function bracketMainSections(t: TFunction, stage: BracketStageView, layout: PlayOffLayout): LayoutSection[] {
  const sections = stage.sections.filter((s) => s.section !== 'playOff');
  if (stage.type === 'doubleElimination') {
    const losers = stage.sections.find((x) => x.section === 'losers');
    const losersRounds = losers?.rounds.length ?? 0;
    const mirrored = layout === 'left' && losersRounds > 0;
    return sections.map((section): LayoutSection => {
      const base = { key: section.section, rounds: section.rounds.map((r) => r.matches) };
      switch (section.section) {
        case 'winners':
          return {
            ...base,
            title: t('bracket.sections.winners'),
            subtitle: t('bracket.size', { size: stage.size }),
            roundTitles: section.rounds.map((r) => doubleEliminationRoundTitle(t, 'winners', r.round, section.rounds.length)),
          };
        case 'losers':
          return {
            ...base,
            title: t('bracket.sections.losers'),
            subtitle: t('bracket.sectionHints.losers'),
            roundTitles: section.rounds.map((r) => doubleEliminationRoundTitle(t, 'losers', r.round, section.rounds.length)),
            ...(mirrored ? { column: -1, flow: 'left' as const, beside: 'winners', linkFrom: 'winners' } : {}),
          };
        default:
          return {
            ...base,
            title: t('bracket.sections.secondFinal'),
            subtitle: t('bracket.sectionHints.secondFinal'),
            ...(mirrored
              ? { column: -losersRounds - 1, level: losers?.rounds.at(-1)?.matches[0]?.id }
              : { column: Math.max(0, losersRounds - 1) }),
          };
      }
    });
  }
  const main = stage.sections.find((s) => s.section === 'main');
  const final = main?.rounds.at(-1)?.matches[0];
  return sections.map((section) =>
    section.section === 'main'
      ? {
          key: section.section,
          title: t('bracket.sections.main'),
          subtitle: t('bracket.size', { size: stage.size }),
          rounds: section.rounds.map((r) => r.matches),
          roundTitles: section.rounds.map((r) => roundTitle(t, r.matches.length)),
        }
      : {
          key: section.section,
          title: t('bracket.sections.thirdPlace'),
          rounds: section.rounds.map((r) => r.matches),
          column: (main?.rounds.length ?? 1) - 1,
          below: final?.id,
        },
  );

}
