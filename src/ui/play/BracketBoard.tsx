import type { ReactNode } from 'react';
import type { MatchId, MatchView } from '@/engine';
import { cn } from '@/lib/utils';
import { CARD_H, CARD_W, layoutBracket, type LayoutSection } from './bracketLayout';
import { MatchCard } from './MatchCard';

/**
 * A bracket on the canvas: labelled sections of round columns, with connector lines from each
 * match to the slot its winner (solid) or loser (dashed) goes to. Works for any bracket format:
 * the caller turns the stage's sections into `LayoutSection`s.
 */
export function BracketBoard(props: {
  sections: LayoutSection[];
  selectedMatch: MatchId | null;
  onSelectMatch: (id: MatchId, el: HTMLElement) => void;
  /** Draws a card differently (e.g. draw editing); falls back to the match card when it returns null. */
  renderCard?: (match: MatchView) => ReactNode | null;
}) {
  const layout = layoutBracket(props.sections);
  return (
    <div className="relative" style={{ width: layout.width, height: layout.height }}>
      <svg className="pointer-events-none absolute inset-0" width={layout.width} height={layout.height} aria-hidden>
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
      {layout.labels.map((label, i) => (
        <div key={`label-${i}`} className="absolute flex items-baseline gap-2 whitespace-nowrap" style={{ left: label.x, top: label.y }}>
          <span
            className={cn(
              'font-bold tracking-wide uppercase',
              label.kind === 'section' ? 'text-sm text-indigo-700' : 'text-[10px] text-slate-500',
            )}
          >
            {label.title}
          </span>
          {label.subtitle && <span className="text-xs text-slate-400">{label.subtitle}</span>}
        </div>
      ))}
      {layout.cards.map(({ match, x, y }) => (
        <div key={match.id} className="absolute" style={{ left: x, top: y, width: CARD_W, height: CARD_H }}>
          {props.renderCard?.(match) ?? (
            <MatchCard match={match} selected={props.selectedMatch === match.id} onSelect={(el) => props.onSelectMatch(match.id, el)} />
          )}
        </div>
      ))}
    </div>
  );
}
