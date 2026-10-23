import { useTranslation } from 'react-i18next';
import type { MatchView } from '@/engine';
import { cn } from '@/lib/utils';

/** The badge of a special result (walkover, retirement, disqualification), shown next to the winner; nothing for a played result. */
export function ResultBadge({ match, side, className }: { match: MatchView; side: 0 | 1; className?: string }) {
  const { t } = useTranslation();
  const { result } = match;
  if (!result || result.winner !== side || result.kind === 'games' || result.kind === 'gamesOnly') return null;
  return (
    <span
      title={t(`match.special.${result.kind}`)}
      className={cn('shrink-0 rounded bg-slate-500 px-1 text-[9px] leading-[14px] font-bold text-white', className)}
    >
      {t(`match.specialBadge.${result.kind}`)}
    </span>
  );
}
