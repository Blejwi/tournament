import { useId } from 'react';
import { useHref, useParams } from 'react-router';
import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import { getTournamentProgress } from '@/engine';
import { useQuery } from '@/app/useApp';
import { cn } from '@/lib/utils';

/**
 * Opens the printout (#0027) in a new tab. Disabled, with a hint naming the competitions still in
 * play, until every competition is finished.
 */
export function PrintButton(props: { className?: string; showHint?: boolean }) {
  const { t } = useTranslation();
  const { tournamentId } = useParams();
  const href = useHref(`/tournaments/${tournamentId}/print`);
  const progress = useQuery(getTournamentProgress);
  const hintId = useId();
  const inPlay = (progress?.competitions ?? []).filter((c) => !c.finished).map((c) => c.name);
  const enabled = progress?.finished === true;
  const hint = t(inPlay.length > 0 ? 'print.unavailable' : 'print.unavailableEmpty', { names: inPlay.join(', ') });
  const className = cn(
    'flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ring-1',
    enabled ? 'text-slate-600 ring-slate-200 hover:bg-slate-100' : 'cursor-not-allowed text-slate-400 ring-slate-200',
    props.className,
  );
  return (
    <span className="inline-flex flex-col items-start gap-1" title={enabled ? t('print.buttonTitle') : hint}>
      {enabled ? (
        <button type="button" className={className} onClick={() => window.open(href, '_blank')}>
          <Printer className="size-3.5" aria-hidden />
          {t('print.button')}
        </button>
      ) : (
        <button type="button" disabled aria-describedby={hintId} className={className}>
          <Printer className="size-3.5" aria-hidden />
          {t('print.button')}
        </button>
      )}
      <span id={hintId} className={props.showHint && !enabled ? 'text-muted-foreground text-xs' : 'sr-only'}>
        {enabled ? '' : hint}
      </span>
    </span>
  );
}
