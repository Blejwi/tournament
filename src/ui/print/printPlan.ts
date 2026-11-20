import { CARD_H, CARD_W, type BracketLayout } from '@/ui/play/bracketLayout';

/**
 * What a landscape A4 page can hold of a bracket (#0027), in the layout's own pixels: the printable
 * area (297 × 210 mm minus 10 mm margins, at 96 dpi) less the room for the page's caption.
 */
export const PAGE_W = 1040;
export const PAGE_H = 630;
/**
 * The smallest scale a bracket is printed at. Card names are 14 px, so 0.76 keeps them at about 8 pt;
 * a bracket that would need less is split over several pages instead.
 */
export const MIN_SCALE = 0.76;

const GAP_X = 56;
/** Round columns that fit side by side at `MIN_SCALE`. */
const MAX_COLUMNS = Math.floor((PAGE_W / MIN_SCALE + GAP_X) / (CARD_W + GAP_X));

/** Which part of a split bracket a page shows; the caption says it. */
export type PagePart =
  | { kind: 'whole' }
  | { kind: 'top' }
  | { kind: 'bottom' }
  | { kind: 'final' }
  | { kind: 'rounds'; from: number; to: number; n: number; of: number };

/** One landscape page: the rectangle of the bracket layout it shows, and the scale it is drawn at. */
export interface BracketPage {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  part: PagePart;
}

const fit = (w: number, h: number) => Math.min(1, PAGE_W / w, PAGE_H / h);

function page(x: number, y: number, w: number, h: number, part: PagePart): BracketPage {
  return { x, y, w, h, scale: fit(w, h), part };
}

/**
 * Splits a laid-out bracket into landscape pages. One page when it fits at a readable scale.
 * Otherwise, when it is too tall (32+ entries): its top half, its bottom half, then the rounds from
 * the semi-finals on. When it is only too wide (a long losers bracket): groups of rounds side by side.
 */
export function planBracketPages(layout: BracketLayout): BracketPage[] {
  const whole = page(0, 0, layout.width, layout.height, { kind: 'whole' });
  if (whole.scale >= MIN_SCALE) return [whole];

  const columns = [...new Set(layout.cards.map((c) => c.x))].sort((a, b) => a - b);
  const tooTall = PAGE_H / layout.height < MIN_SCALE;

  if (tooTall && columns.length >= 3) {
    const semiFinals = columns[columns.length - 2];
    const earliest = layout.cards.filter((c) => c.x === columns[0]).sort((a, b) => a.y - b.y);
    const upper = earliest[Math.floor(earliest.length / 2) - 1];
    const lower = earliest[Math.floor(earliest.length / 2)];
    const middle = upper && lower ? (upper.y + CARD_H + lower.y) / 2 : layout.height / 2;
    const early = layout.cards.filter((c) => c.x <= semiFinals);
    const right = semiFinals + CARD_W + 8;
    const lastCards = layout.cards.filter((c) => c.x >= semiFinals);
    const lastTop = Math.min(...lastCards.map((c) => c.y)) - 24;
    const lastBottom = Math.max(...lastCards.map((c) => c.y + CARD_H)) + 8;
    return [
      page(0, 0, right, middle, { kind: 'top' }),
      page(0, middle, right, Math.max(...early.map((c) => c.y + CARD_H), middle) + 8 - middle, { kind: 'bottom' }),
      page(semiFinals - 8, lastTop, layout.width - semiFinals + 8, lastBottom - lastTop, { kind: 'final' }),
    ];
  }

  const count = Math.ceil(columns.length / MAX_COLUMNS);
  const perPage = Math.ceil(columns.length / count);
  return Array.from({ length: count }, (_, n) => {
    const first = columns[n * perPage];
    const lastColumn = columns[Math.min(columns.length, (n + 1) * perPage) - 1];
    const x = Math.max(0, first - 8);
    const w = n === count - 1 ? layout.width - x : lastColumn + CARD_W + 8 - x;
    return page(x, 0, w, layout.height, { kind: 'rounds', from: n * perPage + 1, to: Math.min(columns.length, (n + 1) * perPage), n: n + 1, of: count });
  });
}
