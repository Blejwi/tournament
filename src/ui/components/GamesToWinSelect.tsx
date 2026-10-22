import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import type { GamesToWin } from '@/engine';
import { Label } from '@/ui/components/ui/label';

const OPTIONS: GamesToWin[] = [2, 3, 4];

/** Games to win per match: 2, 3 or 4 (best of 3, 5 or 7). */
export function GamesToWinSelect({ value, onChange }: { value: GamesToWin; onChange: (value: GamesToWin) => void }) {
  const { t } = useTranslation();
  const id = useId();
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{t('competitions.gamesToWin')}</Label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as GamesToWin)}
        className="border-input h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs"
      >
        {OPTIONS.map((n) => (
          <option key={n} value={n}>
            {t('competitions.gamesToWinOption', { count: n, best: 2 * n - 1 })}
          </option>
        ))}
      </select>
    </div>
  );
}
