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

/** Which part of a split bracket a page shows; the caption says it. */
export type PagePart =
  | { kind: 'whole' }
  | { kind: 'top' }
  | { kind: 'bottom' }
  | { kind: 'final' }
  | { kind: 'rounds'; from: number; to: number; n: number; of: number };

/** One page: the rectangle of the bracket layout it shows, and the scale it is drawn at. */
export interface BracketPage {
  x: number;
  y: number;
  w: number;
  h: number;
  scale: number;
  part: PagePart;
}

/** What a page holds. The defaults are the printout's (landscape A4); the display passes its own (#0030). */
export interface PagePlanOptions {
  /** The space a page has, in the pixels it is drawn in (before scaling). */
  pageW: number;
  pageH: number;
  /** A page is never drawn smaller than this; a bracket that would need less is split. */
  minScale: number;
  /** The width of a card in the layout. */
  cardW: number;
  /** A page is never drawn larger than this (the printout keeps 1, the display scales content up). */
  maxScale: number;
  /** Only this rectangle of the layout is planned (the display leaves finished rounds out); default: all of it. */
  region?: { x: number; y: number; w: number; h: number };
}

export const PRINT_PAGE: PagePlanOptions = { pageW: PAGE_W, pageH: PAGE_H, minScale: MIN_SCALE, cardW: CARD_W, maxScale: 1 };

/**
 * Splits a laid-out bracket into pages. One page when it fits at a readable scale.
 * Otherwise, when it is too tall (32+ entries): its top half, its bottom half, then the rounds from
 * the semi-finals on. When it is only too wide (a long losers bracket): groups of rounds side by side.
 */
export function planBracketPages(layout: BracketLayout, options: PagePlanOptions = PRINT_PAGE): BracketPage[] {
  const { pageW, pageH, minScale, cardW, maxScale } = options;
  const region = options.region ?? { x: 0, y: 0, w: layout.width, h: layout.height };
  const fit = (w: number, h: number) => Math.min(maxScale, pageW / w, pageH / h);
  const page = (x: number, y: number, w: number, h: number, part: PagePart): BracketPage => ({ x, y, w, h, scale: fit(w, h), part });
  /** Round columns that fit side by side at the minimum scale. */
  const maxColumns = Math.max(1, Math.floor((pageW / minScale + GAP_X) / (cardW + GAP_X)));

  const whole = page(region.x, region.y, region.w, region.h, { kind: 'whole' });
  if (whole.scale >= minScale) return [whole];

  const cards = layout.cards.filter((c) => c.x >= region.x - 1 && c.y >= region.y - 1);
  const columns = [...new Set(cards.map((c) => c.x))].sort((a, b) => a - b);
  const tooTall = pageH / region.h < minScale;

  if (tooTall && columns.length >= 3) {
    const semiFinals = columns[columns.length - 2];
    const earliest = cards.filter((c) => c.x === columns[0]).sort((a, b) => a.y - b.y);
    const upper = earliest[Math.floor(earliest.length / 2) - 1];
    const lower = earliest[Math.floor(earliest.length / 2)];
    const middle = upper && lower ? (upper.y + CARD_H + lower.y) / 2 : region.y + region.h / 2;
    const early = cards.filter((c) => c.x <= semiFinals);
    const right = semiFinals + cardW + 8;
    const lastCards = cards.filter((c) => c.x >= semiFinals);
    const lastTop = Math.min(...lastCards.map((c) => c.y)) - 24;
    const lastBottom = Math.max(...lastCards.map((c) => c.y + CARD_H)) + 8;
    return [
      page(region.x, region.y, right - region.x, middle - region.y, { kind: 'top' }),
      page(region.x, middle, right - region.x, Math.max(...early.map((c) => c.y + CARD_H), middle) + 8 - middle, { kind: 'bottom' }),
      page(semiFinals - 8, lastTop, region.x + region.w - semiFinals + 8, lastBottom - lastTop, { kind: 'final' }),
    ];
  }

  const count = Math.ceil(columns.length / maxColumns);
  const perPage = Math.ceil(columns.length / count);
  return Array.from({ length: count }, (_, n) => {
    const first = columns[n * perPage];
    const lastColumn = columns[Math.min(columns.length, (n + 1) * perPage) - 1];
    const x = Math.max(region.x, first - 8);
    const w = n === count - 1 ? region.x + region.w - x : lastColumn + cardW + 8 - x;
    return page(x, region.y, w, region.h, { kind: 'rounds', from: n * perPage + 1, to: Math.min(columns.length, (n + 1) * perPage), n: n + 1, of: count });
  });
}
