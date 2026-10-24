import type { MatchId, MatchView, PlayOffView } from '@/engine';

/**
 * Where to draw a bracket stage's match cards, connector lines and labels on the canvas.
 * Pure geometry from the engine's bracket layout data (sections → rounds → matches top to bottom,
 * feeders on the slots), so every bracket format (single and double elimination, play-offs)
 * draws through the same code: each section is a labelled block of round columns. Place
 * play-offs form trees (a play-off, then a play-off per half) laid out as one block each.
 */

/** Match card size and the gaps between cards (world px). Must match MatchCard. */
export const CARD_W = 292;
export const CARD_H = 64;
/** Vertical centre of slot A and slot B inside a card (below the 18px header, 21px per slot). */
export const SLOT_Y: [number, number] = [28, 49];
const GAP_X = 56;
const GAP_Y = 16;
const SECTION_TITLE_H = 26;
/** A play-off's label: title and switch, then the hint on a second line, no wider than its column. */
const TREE_TITLE_H = 40;
const ROUND_TITLE_H = 20;
const SECTION_GAP = 56;
/** How far a loser's line runs from a winner's line out of the same card, so the two never share a stroke. */
const LOSER_OFFSET = 8;

export interface LayoutSection {
  key: string;
  title: string;
  subtitle?: string;
  /** Rounds left to right, each top to bottom. */
  rounds: MatchView[][];
  /** A place play-off block: its on/off switch is drawn next to the title. */
  playOff?: PlayOffView;
  /** Headings over the round columns. */
  roundTitles?: string[];
  /** First column of the section (default 0), e.g. a 3rd-place match under the final. */
  column?: number;
  /** Put the section just below this match (already laid out) instead of below the previous section. */
  below?: MatchId;
  /** Start level with this section (already laid out) instead of below the previous one, e.g. a losers bracket left of the winners bracket. */
  beside?: string;
  /** Put the section's first card level with this match (already laid out), e.g. the 2nd final left of a mirrored losers final. */
  level?: MatchId;
  /**
   * Also centre on, and draw lines from, feeders in this section when they sit in the next column,
   * e.g. a mirrored losers bracket's LR1 fed by the winners round 1 beside it.
   */
  linkFrom?: string;
  /** Rounds run right to left from `column` (a mirrored losers bracket); columns may be negative. */
  flow?: 'left';
  /**
   * A block of a play-off tree (one round, one column): laid out with the rest of its tree, its
   * cards centred on their feeders, with connectors between the blocks. `column` is relative to the
   * tree's top play-off and may be negative (a losers' half drawn to its left).
   */
  tree?: { key: string; column: number; parent?: string };
}

export interface PlacedCard {
  match: MatchView;
  x: number;
  y: number;
}

/** A connector from a feeder match's edge to the slot it feeds. */
export interface Connector {
  from: MatchId;
  to: MatchId;
  side: 0 | 1;
  /** The loser goes on (e.g. into a 3rd-place match or a losers bracket). */
  loser: boolean;
  /** The feeder has finished, so the line carries a known player. */
  active: boolean;
  path: string;
}

export interface PlacedLabel {
  kind: 'section' | 'round';
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  playOff?: PlayOffView;
  /** The hint goes on a second line and the label stays within its column (play-off trees). */
  compact?: boolean;
}

export interface BracketLayout {
  cards: PlacedCard[];
  connectors: Connector[];
  labels: PlacedLabel[];
  width: number;
  height: number;
}

type Placed = Map<MatchId, { x: number; y: number; group: string; linkFrom?: string }>;

/** Whether `from` feeds `to` with a line: the same section or tree, or a linked section in the next column. */
const linked = (from: { x: number; group: string }, to: { x: number; group: string; linkFrom?: string }) =>
  from.group === to.group || (from.group === to.linkFrom && Math.abs(Math.abs(from.x - to.x) - (CARD_W + GAP_X)) < 0.5);

export function layoutBracket(sections: LayoutSection[]): BracketLayout {
  const pos: Placed = new Map();
  const cards: PlacedCard[] = [];
  const labels: PlacedLabel[] = [];
  let cursor = 0;
  let bottom = 0;
  const laidTrees = new Set<string>();
  const sectionTops = new Map<string, number>();

  for (const section of sections) {
    if (section.tree) {
      if (laidTrees.has(section.tree.key)) continue;
      laidTrees.add(section.tree.key);
      const treeBottom = layoutTree(
        sections.filter((s) => s.tree?.key === section.tree!.key),
        cursor,
        { pos, cards, labels },
      );
      bottom = Math.max(bottom, treeBottom);
      cursor = treeBottom + SECTION_GAP;
      continue;
    }
    const column = section.column ?? 0;
    const step = section.flow === 'left' ? -1 : 1;
    const anchor = section.below ? pos.get(section.below) : undefined;
    const levelWith = section.level ? pos.get(section.level) : undefined;
    const besideTop = levelWith
      ? levelWith.y - SECTION_TITLE_H - (section.roundTitles?.length ? ROUND_TITLE_H : 0)
      : section.beside
        ? sectionTops.get(section.beside)
        : undefined;
    const top = anchor ? anchor.y + CARD_H + SECTION_GAP / 2 : (besideTop ?? cursor);
    sectionTops.set(section.key, top);
    // The title sits over the section's leftmost column.
    const titleColumn = step < 0 ? column - Math.max(0, section.rounds.length - 1) : column;
    const hasRoundTitles = !!section.roundTitles?.length;
    const cardsTop = top + SECTION_TITLE_H + (hasRoundTitles ? ROUND_TITLE_H : 0);
    labels.push({
      kind: 'section',
      x: titleColumn * (CARD_W + GAP_X),
      y: top,
      title: section.title,
      subtitle: section.subtitle,
      playOff: section.playOff,
    });

    let sectionBottom = cardsTop;
    section.rounds.forEach((matches, r) => {
      const x = (column + step * r) * (CARD_W + GAP_X);
      if (section.roundTitles?.[r])
        labels.push({
          kind: 'round',
          x,
          y: top + SECTION_TITLE_H,
          title: section.roundTitles[r],
        });
      const taken: number[] = [];
      matches.forEach((match, i) => {
        // Centre on the feeders inside this section (or a linked one next to it); otherwise stack in order.
        const here = { x, group: section.key, linkFrom: section.linkFrom };
        const feeders = match.slots.map((s) => (s.feeder ? pos.get(s.feeder.match) : undefined)).filter((p) => p && linked(p, here));
        let y = feeders.length ? feeders.reduce((sum, p) => sum + p!.y, 0) / feeders.length : cardsTop + i * (CARD_H + GAP_Y);
        for (let moved = true; moved;) {
          moved = false;
          for (const other of taken) {
            if (Math.abs(other - y) < CARD_H + GAP_Y - 0.5) {
              y = other + CARD_H + GAP_Y;
              moved = true;
            }
          }
        }
        taken.push(y);
        pos.set(match.id, { x, y, group: section.key, linkFrom: section.linkFrom });
        cards.push({ match, x, y });
        sectionBottom = Math.max(sectionBottom, y + CARD_H);
      });
    });
    bottom = Math.max(bottom, sectionBottom);
    if (!anchor && besideTop === undefined) cursor = sectionBottom + SECTION_GAP;
    else cursor = Math.max(cursor, sectionBottom + SECTION_GAP);
  }

  // Mirrored sections sit left of column 0: move everything right so the board starts at 0.
  const minX = Math.min(0, ...cards.map((c) => c.x), ...labels.map((l) => l.x));
  if (minX < 0) {
    for (const c of cards) c.x -= minX;
    for (const l of labels) l.x -= minX;
    for (const p of pos.values()) p.x -= minX;
  }

  const connectors: Connector[] = [];
  for (const { match } of cards) {
    const to = pos.get(match.id)!;
    match.slots.forEach((slot, side) => {
      const feeder = slot.feeder;
      const from = feeder ? pos.get(feeder.match) : undefined;
      if (!feeder || !from || !linked(from, to)) return;
      const loser = feeder.take === 'loser';
      const offset = loser ? LOSER_OFFSET : 0;
      const y1 = from.y + CARD_H / 2 + offset;
      const y2 = to.y + SLOT_Y[side];
      // Drawn to the left of its feeders (a losers' half, a mirrored losers bracket): the line leaves the feeder's left edge.
      const leftward = to.x < from.x;
      const [x1, x2] = leftward ? [from.x, to.x + CARD_W] : [from.x + CARD_W, to.x];
      const xm = leftward ? x2 + GAP_X / 2 - offset : x2 - GAP_X / 2 + offset;
      const feederCard = cards.find((c) => c.match.id === feeder.match)!;
      connectors.push({
        from: feeder.match,
        to: match.id,
        side: side as 0 | 1,
        loser,
        active: feederCard.match.result !== null || feederCard.match.decidedByBye,
        path: `M${x1} ${y1} H${xm} V${y2} H${x2}`,
      });
    });
  }

  const width = Math.max(CARD_W, ...cards.map((c) => c.x + CARD_W), ...labels.map((l) => l.x + (l.compact ? CARD_W : 240)));
  return { cards, connectors, labels, width, height: Math.max(bottom, CARD_H) };
}

/**
 * One play-off tree from `top` down, parents before their halves: each block in its column, its
 * cards centred on their feeders, pushed down past whatever its column already holds. A block
 * without matches yet (just the title and switch) sits level with the middle of its parent.
 * Returns the tree's bottom edge.
 */
function layoutTree(sections: LayoutSection[], top: number, out: { pos: Placed; cards: PlacedCard[]; labels: PlacedLabel[] }): number {
  const group = sections[0].tree!.key;
  const minColumn = Math.min(...sections.map((s) => s.tree!.column));
  const taken = new Map<number, [number, number][]>();
  const middles = new Map<string, number>();
  let bottom = top;

  for (const section of sections) {
    const column = section.tree!.column - minColumn;
    const x = column * (CARD_W + GAP_X);
    const matches = section.rounds.flat();

    // Where the cards want to be, relative to the label's top when they have no feeders here.
    const ys: number[] = [];
    matches.forEach((match, i) => {
      const feeders = match.slots.map((s) => (s.feeder ? out.pos.get(s.feeder.match) : undefined)).filter((p) => p?.group === group);
      const wanted = feeders.length ? feeders.reduce((sum, p) => sum + p!.y, 0) / feeders.length : NaN;
      ys.push(i === 0 ? wanted : Math.max(Number.isNaN(wanted) ? -Infinity : wanted, ys[i - 1] + CARD_H + GAP_Y));
    });
    const parentMiddle = section.tree!.parent ? middles.get(section.tree!.parent) : undefined;
    let labelTop = ys.length && !Number.isNaN(ys[0]) ? ys[0] - TREE_TITLE_H : (parentMiddle ?? top);
    labelTop = Math.max(top, labelTop);
    const cardYs = ys.map((y, i) => (Number.isNaN(y) || Number.isNaN(ys[0]) ? labelTop + TREE_TITLE_H + i * (CARD_H + GAP_Y) : y));
    let offset = 0;
    if (cardYs.length && cardYs[0] < labelTop + TREE_TITLE_H) offset = labelTop + TREE_TITLE_H - cardYs[0];
    const height = () => (cardYs.length ? cardYs[cardYs.length - 1] + offset + CARD_H : labelTop + TREE_TITLE_H);

    // Push the block down past the blocks already in its column.
    const intervals = taken.get(column) ?? [];
    for (let moved = true; moved;) {
      moved = false;
      for (const [a, b] of intervals) {
        if (labelTop < b + SECTION_GAP / 2 && height() + SECTION_GAP / 2 > a) {
          const delta = b + SECTION_GAP / 2 - labelTop;
          labelTop += delta;
          offset += delta;
          moved = true;
        }
      }
    }
    const blockBottom = height();
    intervals.push([labelTop, blockBottom]);
    taken.set(column, intervals);

    out.labels.push({
      kind: 'section',
      x,
      y: labelTop,
      title: section.title,
      subtitle: section.subtitle,
      playOff: section.playOff,
      compact: true,
    });
    matches.forEach((match, i) => {
      const y = cardYs[i] + offset;
      out.pos.set(match.id, { x, y, group });
      out.cards.push({ match, x, y });
    });
    middles.set(section.key, cardYs.length ? (cardYs[0] + offset + blockBottom) / 2 - TREE_TITLE_H / 2 : labelTop);
    bottom = Math.max(bottom, blockBottom);
  }
  return bottom;
}
