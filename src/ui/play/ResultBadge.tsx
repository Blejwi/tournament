import { useTranslation } from 'react-i18next';
import type { MatchView } from '@/engine';
import { cn } from '@/lib/utils';
import { specialKind } from './specialResults';

/** The badge of a special result (walkover, retirement, disqualification), shown next to the winner; nothing for a played result. */
export function ResultBadge({ match, side, className }: { match: MatchView; side: 0 | 1; className?: string }) {
  const { t } = useTranslation();
  const { result } = match;
  const kind = specialKind(result);
  if (!result || !kind || result.winner !== side) return null;
  return (
    <span
      title={t(`match.special.${kind}`)}
      className={cn('shrink-0 rounded bg-slate-500 px-1 text-[9px] leading-[14px] font-bold text-white', className)}
    >
      {t(`match.specialBadge.${kind}`)}
    </span>
  );
}
