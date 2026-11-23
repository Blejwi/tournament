import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import type { MatchId, MatchView, PlaceRange } from '@/engine';
import { cn } from '@/lib/utils';
import { CARD_H, CARD_W, COMPACT_CARD_W, layoutBracket, type LayoutSection } from './bracketLayout';
import { Switch } from '@/ui/components/ui/switch';
import { formatPlace } from '@/ui/matchLabels';
import { useDisplayMode } from './displayMode';
import { MatchCard } from './MatchCard';

/**
 * A bracket on the canvas: labelled sections of round columns, with connector lines from each
 * match to the slot its winner (solid) or loser (dashed) goes to. Works for any bracket format:
 * the caller turns the stage's sections into `LayoutSection`s.
 */
export function BracketBoard(props: {
  sections: LayoutSection[];
  selectedMatch: MatchId | null;
  /** Omitted on the read-only display screen: the cards are not clickable. */
  onSelectMatch?: (id: MatchId, el: HTMLElement) => void;
  /** Draws a card differently (e.g. draw editing); falls back to the match card when it returns null. */
  renderCard?: (match: MatchView) => ReactNode | null;
  /** Switches a place play-off on or off (its block shows a switch). */
  onTogglePlayOff?: (range: PlaceRange, enabled: boolean) => void;
  /** Draws it for paper (#0027): print cards, no section titles (the page caption carries them) and no dimmed play-offs. */
  print?: boolean;
  /**
   * Draws only this rectangle of the layout (printing a part of a big bracket). Nothing outside it is rendered:
   * the browser would otherwise shrink the whole printout to fit content that is merely clipped.
   */
  crop?: { x: number; y: number; w: number; h: number };
}) {
  const { t } = useTranslation();
  const cardW = useDisplayMode() ? COMPACT_CARD_W : CARD_W;
  const layout = layoutBracket(props.sections, cardW);
  const { crop } = props;
  const inCrop = (x: number, y: number, w: number, h: number) => !crop || (x < crop.x + crop.w && x + w > crop.x && y < crop.y + crop.h && y + h > crop.y);
  const [dx, dy] = crop ? [crop.x, crop.y] : [0, 0];
  const [width, height] = crop ? [crop.w, crop.h] : [layout.width, layout.height];
  const labels = (props.print ? layout.labels.filter((l) => l.kind === 'round' || l.compact) : layout.labels).filter((l) => inCrop(l.x, l.y, l.compact ? cardW : 120, 20));
  const cards = layout.cards.filter((c) => inCrop(c.x, c.y, cardW, CARD_H));
  return (
    <div className="relative" style={{ width, height }}>
      <svg className="pointer-events-none absolute inset-0" width={width} height={height} viewBox={`${dx} ${dy} ${width} ${height}`} aria-hidden>
        {layout.connectors.map((c) => (
          <path
            key={`${c.from}-${c.to}-${c.side}`}
            d={c.path}
            fill="none"
            className={c.active ? 'stroke-indigo-400' : 'stroke-slate-300'}
            strokeWidth={c.active ? 2 : 1.5}
            strokeDasharray={c.loser ? '4 3' : undefined}
          />
        ))}
      </svg>
      {labels.map((label, i) => (
        <div
          key={`label-${i}`}
          className={cn('absolute flex items-baseline gap-x-2 whitespace-nowrap', label.compact && 'flex-wrap')}
          style={{ left: label.x - dx, top: label.y - dy, width: label.compact ? cardW : undefined }}
        >
          <span
            className={cn(
              'font-bold tracking-wide uppercase',
              !props.print && label.playOff && !label.playOff.enabled && 'opacity-40',
              label.kind === 'section' ? 'text-sm text-indigo-700' : props.print ? 'text-[12px] text-slate-600' : 'text-[10px] text-slate-500',
            )}
          >
            {label.title}
          </span>
          {label.subtitle && !label.compact && <span className="text-xs text-slate-400">{label.subtitle}</span>}
          {label.playOff && props.onTogglePlayOff && (
            <Switch
              checked={label.playOff.enabled}
              aria-label={t('bracket.playOffToggle', { range: formatPlace(label.playOff.range) })}
              onCheckedChange={(enabled) => props.onTogglePlayOff!(label.playOff!.range, enabled)}
              className="h-4 w-7 self-center"
            />
          )}
          {label.subtitle && label.compact && <span className="basis-full truncate text-xs leading-5 text-slate-400">{label.subtitle}</span>}
        </div>
      ))}
      {cards.map(({ match, x, y }) => (
        <div key={match.id} className="absolute" style={{ left: x - dx, top: y - dy, width: cardW, height: CARD_H }}>
          {props.renderCard?.(match) ?? (
            <MatchCard match={match} selected={props.selectedMatch === match.id} print={props.print} onSelect={props.onSelectMatch && ((el) => props.onSelectMatch!(match.id, el))} />
          )}
        </div>
      ))}
    </div>
  );
}
