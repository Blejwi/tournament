import type { MatchId, MatchView, PlayOffView } from '@/engine';

/**
 * Where to draw a bracket stage's match cards, connector lines and labels on the canvas.
 * Pure geometry from the engine's bracket layout data (sections → rounds → matches top to bottom,
 * feeders on the slots), so every bracket format (single and double elimination, play-offs)
 * draws through the same code: each section is a labelled block of round columns.
 */

/** Match card size and the gaps between cards (world px). Must match MatchCard. */
export const CARD_W = 292;
export const CARD_H = 64;
/** Vertical centre of slot A and slot B inside a card (below the 18px header, 21px per slot). */
export const SLOT_Y: [number, number] = [28, 49];
const GAP_X = 56;
const GAP_Y = 16;
const SECTION_TITLE_H = 26;
const ROUND_TITLE_H = 20;
const SECTION_GAP = 56;

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
}

export interface PlacedCard {
  match: MatchView;
  x: number;
  y: number;
}

/** A connector from a feeder match's right edge to the slot it feeds. */
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
}

export interface BracketLayout {
  cards: PlacedCard[];
  connectors: Connector[];
  labels: PlacedLabel[];
  width: number;
  height: number;
}

export function layoutBracket(sections: LayoutSection[]): BracketLayout {
  const pos = new Map<MatchId, { x: number; y: number; section: string }>();
  const cards: PlacedCard[] = [];
  const labels: PlacedLabel[] = [];
  let cursor = 0;
  let bottom = 0;

  for (const section of sections) {
    const column = section.column ?? 0;
    const anchor = section.below ? pos.get(section.below) : undefined;
    const top = anchor ? anchor.y + CARD_H + SECTION_GAP / 2 : cursor;
    const hasRoundTitles = !!section.roundTitles?.length;
    const cardsTop = top + SECTION_TITLE_H + (hasRoundTitles ? ROUND_TITLE_H : 0);
    labels.push({ kind: 'section', x: column * (CARD_W + GAP_X), y: top, title: section.title, subtitle: section.subtitle, playOff: section.playOff });

    let sectionBottom = cardsTop;
    section.rounds.forEach((matches, r) => {
      const x = (column + r) * (CARD_W + GAP_X);
      if (section.roundTitles?.[r]) labels.push({ kind: 'round', x, y: top + SECTION_TITLE_H, title: section.roundTitles[r] });
      const taken: number[] = [];
      matches.forEach((match, i) => {
        // Centre on the feeders inside this section; otherwise stack in order.
        const feeders = match.slots.map((s) => (s.feeder ? pos.get(s.feeder.match) : undefined)).filter((p) => p?.section === section.key);
        let y = feeders.length ? feeders.reduce((sum, p) => sum + p!.y, 0) / feeders.length : cardsTop + i * (CARD_H + GAP_Y);
        for (let moved = true; moved; ) {
          moved = false;
          for (const other of taken) {
            if (Math.abs(other - y) < CARD_H + GAP_Y - 0.5) {
              y = other + CARD_H + GAP_Y;
              moved = true;
            }
          }
        }
        taken.push(y);
        pos.set(match.id, { x, y, section: section.key });
        cards.push({ match, x, y });
        sectionBottom = Math.max(sectionBottom, y + CARD_H);
      });
    });
    bottom = Math.max(bottom, sectionBottom);
    if (!anchor) cursor = sectionBottom + SECTION_GAP;
    else cursor = Math.max(cursor, sectionBottom + SECTION_GAP);
  }

  const connectors: Connector[] = [];
  for (const { match } of cards) {
    const to = pos.get(match.id)!;
    match.slots.forEach((slot, side) => {
      const feeder = slot.feeder;
      const from = feeder ? pos.get(feeder.match) : undefined;
      if (!feeder || !from || from.section !== to.section) return;
      const [x1, y1] = [from.x + CARD_W, from.y + CARD_H / 2];
      const [x2, y2] = [to.x, to.y + SLOT_Y[side]];
      const xm = x2 - GAP_X / 2;
      const feederCard = cards.find((c) => c.match.id === feeder.match)!;
      connectors.push({
        from: feeder.match,
        to: match.id,
        side: side as 0 | 1,
        loser: feeder.take === 'loser',
        active: feederCard.match.result !== null || feederCard.match.decidedByBye,
        path: `M${x1} ${y1} H${xm} V${y2} H${x2}`,
      });
    });
  }

  const width = Math.max(CARD_W, ...cards.map((c) => c.x + CARD_W), ...labels.map((l) => l.x + 240));
  return { cards, connectors, labels, width, height: Math.max(bottom, CARD_H) };
}
