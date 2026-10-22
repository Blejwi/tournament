import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { Pencil, Trash2 } from 'lucide-react';
import { getTables, type EngineError, type TableView } from '@/engine';
import { useApp, useQuery } from '@/app/useApp';
import { errorMessage } from '@/i18n';
import { Button } from '@/ui/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/ui/components/ui/dialog';
import { Switch } from '@/ui/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/ui/components/ui/table';
import { ConfirmDialog } from '@/ui/components/ConfirmDialog';
import { FormError, FormField } from '@/ui/components/FormField';
import { errorField } from '@/ui/formErrors';

export function TablesScreen() {
  const { t } = useTranslation();
  const tables = useQuery(getTables) ?? [];
  const dispatch = useApp((s) => s.dispatch);
  const [editing, setEditing] = useState<TableView | null>(null);

  return (
    <section className="grid gap-4">
      <h2 className="sr-only">{t('tables.heading')}</h2>
      <AddTableForm nextNumber={Math.max(0, ...tables.map((x) => x.number)) + 1} />
      {tables.length === 0 ? (
        <p className="text-muted-foreground">{t('tables.empty')}</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-24">{t('tables.number')}</TableHead>
              <TableHead>{t('tables.name')}</TableHead>
              <TableHead className="w-40">{t('tables.status')}</TableHead>
              <TableHead className="w-28 text-right">{t('common.actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {tables.map((table) => (
              <TableRow key={table.id} className={table.active ? undefined : 'text-muted-foreground'}>
                <TableCell className="font-medium tabular-nums">{table.number}</TableCell>
                <TableCell>{table.name}</TableCell>
                <TableCell>
                  <label className="flex items-center gap-2">
                    <Switch
                      aria-label={t('tables.active')}
                      checked={table.active}
                      onCheckedChange={(active) => dispatch({ type: 'setTableActive', table: table.id, active })}
                    />
                    {table.active ? t('tables.active') : t('tables.inactive')}
                  </label>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" aria-label={t('common.edit')} title={t('common.edit')} onClick={() => setEditing(table)}>
                    <Pencil />
                  </Button>
                  <ConfirmDialog
                    trigger={
                      <Button variant="ghost" size="icon" aria-label={t('common.remove')} title={t('common.remove')}>
                        <Trash2 />
                      </Button>
                    }
                    title={t('tables.removeTitle', { number: table.number })}
                    description={t('tables.removeBody')}
                    confirmLabel={t('common.remove')}
                    onConfirm={() => dispatch({ type: 'removeTable', table: table.id })}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {editing && <EditTableDialog table={editing} onClose={() => setEditing(null)} />}
    </section>
  );
}

function AddTableForm({ nextNumber }: { nextNumber: number }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<EngineError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const failure = dispatch({ type: 'addTable', number: number === '' ? nextNumber : Number(number), name });
    setError(failure);
    if (!failure) {
      setNumber('');
      setName('');
    }
  }

  return (
    <form onSubmit={submit} noValidate className="grid gap-2">
      <div className="flex flex-wrap items-end gap-3">
        <FormField
          className="w-28"
          label={t('tables.number')}
          type="number"
          min={1}
          placeholder={String(nextNumber)}
          value={number}
          onChange={(e) => setNumber(e.target.value)}
          invalid={errorField(error) === 'number'}
        />
        <FormField className="min-w-48 flex-1" label={t('tables.name')} optional value={name} onChange={(e) => setName(e.target.value)} />
        <Button type="submit">{t('tables.add')}</Button>
      </div>
      <FormError message={error && errorMessage(t, error)} />
    </form>
  );
}

function EditTableDialog({ table, onClose }: { table: TableView; onClose: () => void }) {
  const { t } = useTranslation();
  const dispatch = useApp((s) => s.dispatch);
  const [number, setNumber] = useState(String(table.number));
  const [name, setName] = useState(table.name);
  const [error, setError] = useState<EngineError | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const failure = dispatch({ type: 'updateTable', table: table.id, number: Number(number), name });
    if (failure) setError(failure);
    else onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={t('common.close')} aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{t('tables.edit')}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="grid gap-4">
          <FormField
            label={t('tables.number')}
            type="number"
            min={1}
            value={number}
            onChange={(e) => setNumber(e.target.value)}
            invalid={errorField(error) === 'number'}
          />
          <FormField label={t('tables.name')} optional value={name} onChange={(e) => setName(e.target.value)} />
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
