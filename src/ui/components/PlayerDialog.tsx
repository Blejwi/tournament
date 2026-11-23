import { useRef, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { type CompetitionView, type EngineError, type PlayerView } from '@/engine';
import { useApp } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { FormError, FormField } from '@/ui/components/FormField';
import { errorField, optionalNumber } from '@/ui/formErrors';

/**
 * Registers new players into `competition` (player and entry in one step), or edits `player` (the change shows in every competition).
 * Adding keeps the dialog open for the next player; editing closes it after Save.
 */
export function PlayerDialog({ competition, player, onClose }: { competition: CompetitionView; player: PlayerView | null; onClose: () => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [firstName, setFirstName] = useState(player?.firstName ?? '');
  const [lastName, setLastName] = useState(player?.lastName ?? '');
  const [club, setClub] = useState(player?.club ?? '');
  const [rating, setRating] = useState(player?.rating?.toString() ?? '');
  const [birthYear, setBirthYear] = useState(player?.birthYear?.toString() ?? '');
  const [error, setError] = useState<EngineError | null>(null);
  const [added, setAdded] = useState<{ name: string; count: number } | null>(null);
  const firstNameInput = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const fields = {
      firstName,
      lastName,
      club,
      rating: optionalNumber(rating),
      birthYear: optionalNumber(birthYear),
    };
    if (player) {
      const failure = dispatch({ type: 'updatePlayer', player: player.id, ...fields });
      if (failure) setError(failure);
      else onClose();
      return;
    }
    const failure = dispatch({ type: 'registerPlayer', competition: competition.id, ...fields });
    if (failure) {
      setError(failure);
      return;
    }
    setAdded({ name: `${firstName.trim()} ${lastName.trim()}`, count: (added?.count ?? 0) + 1 });
    setFirstName('');
    setLastName('');
    setClub('');
    setRating('');
    setBirthYear('');
    setError(null);
    firstNameInput.current?.focus();
  }

  const invalid = errorField(error);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{player ? t('players.edit') : t('players.addTo', { competition: competition.name })}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          {added && (
            <p role="status" className="text-muted-foreground text-sm">
              {t('players.added', { name: added.name, count: added.count })}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField ref={firstNameInput} label={t('players.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} invalid={invalid === 'firstName'} />
            <FormField label={t('players.lastName')} value={lastName} onChange={(e) => setLastName(e.target.value)} invalid={invalid === 'lastName'} />
          </div>
          <FormField label={t('players.club')} optional value={club} onChange={(e) => setClub(e.target.value)} />
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('players.rating')} optional type="number" min={0} value={rating} onChange={(e) => setRating(e.target.value)} invalid={invalid === 'rating'} />
            <FormField label={t('players.birthYear')} optional type="number" min={1900} max={2100} value={birthYear} onChange={(e) => setBirthYear(e.target.value)} invalid={invalid === 'birthYear'} />
          </div>
          <FormError message={error && errorMessage(t, error)} />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {player ? t('common.cancel') : t('common.done')}
            </Button>
            <Button type="submit">{player ? t('common.save') : t('players.add')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
