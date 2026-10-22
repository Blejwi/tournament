import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, UserPlus } from 'lucide-react';
import { getPlayers, type EngineError, type PlayerView } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/ui/table';
import { FormError, FormField } from '@/ui/components/FormField';
import { errorField, optionalNumber } from '@/ui/formErrors';

/** `null` = registering a new player; otherwise the player being edited. */
type Editing = { player: PlayerView | null } | null;

export function PlayersScreen() {
  const { t } = useTranslation();
  const players = useQuery(getPlayers) ?? [];
  const [editing, setEditing] = useState<Editing>(null);

  return (
    <section className="grid gap-4">
      <h2 className="sr-only">{t('players.heading')}</h2>
      <div>
        <Button onClick={() => setEditing({ player: null })}>
          <UserPlus />
          {t('players.add')}
        </Button>
      </div>
      {players.length === 0 ? (
        <p className="text-muted-foreground">{t('players.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('players.lastName')}</TableHead>
              <TableHead>{t('players.firstName')}</TableHead>
              <TableHead>{t('players.club')}</TableHead>
              <TableHead className="text-right">{t('players.rating')}</TableHead>
              <TableHead className="text-right">{t('players.birthYear')}</TableHead>
              <TableHead className="w-20 text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {players.map((player) => (
              <TableRow key={player.id}>
                <TableCell className="font-medium">{player.lastName}</TableCell>
                <TableCell>{player.firstName}</TableCell>
                <TableCell>{player.club}</TableCell>
                <TableCell className="text-right tabular-nums">{player.rating ?? ''}</TableCell>
                <TableCell className="text-right tabular-nums">{player.birthYear ?? ''}</TableCell>
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.edit')}
                    title={t('common.edit')}
                    onClick={() => setEditing({ player })}
                  >
                    <Pencil />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing && <PlayerDialog player={editing.player} onClose={() => setEditing(null)} />}
    </section>
  );
}

function PlayerDialog({ player, onClose }: { player: PlayerView | null; onClose: () => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [firstName, setFirstName] = useState(player?.firstName ?? '');
  const [lastName, setLastName] = useState(player?.lastName ?? '');
  const [club, setClub] = useState(player?.club ?? '');
  const [rating, setRating] = useState(player?.rating?.toString() ?? '');
  const [birthYear, setBirthYear] = useState(player?.birthYear?.toString() ?? '');
  const [error, setError] = useState<EngineError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const fields = {
      firstName,
      lastName,
      club,
      rating: optionalNumber(rating),
      birthYear: optionalNumber(birthYear),
    };
    const failure = player
      ? dispatch({ type: 'updatePlayer', player: player.id, ...fields })
      : dispatch({ type: 'addPlayer', ...fields });
    if (failure) setError(failure);
    else onClose();
  }

  const invalid = errorField(error);
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{player ? t('players.edit') : t('players.add')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label={t('players.firstName')} value={firstName} onChange={(e) => setFirstName(e.target.value)} invalid={invalid === 'firstName'} />
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
              {t('common.cancel')}
            </Button>
            <Button type="submit">{t('common.save')}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
