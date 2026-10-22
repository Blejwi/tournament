import { describe, expect, it } from 'vitest';
import { getBackupReminder } from '@/engine';
import { newTournament } from './helpers';

const state = newTournament();
const at = (time: string) => `2026-05-01T${time}:00.000Z`;

describe('backup reminder', () => {
  it('stays quiet when nothing has changed', () => {
    expect(getBackupReminder(state, { now: at('12:00'), lastChangeAt: null, unsavedSince: null })).toEqual({
      live: false,
      due: false,
    });
  });

  it('appears during a live tournament once changes have gone 30 minutes without a backup', () => {
    const activity = { lastChangeAt: at('10:29'), unsavedSince: at('10:00') };
    expect(getBackupReminder(state, { now: at('10:29'), ...activity })).toEqual({ live: true, due: false });
    expect(getBackupReminder(state, { now: at('10:30'), ...activity })).toEqual({ live: true, due: true });
  });

  it('stays quiet when the tournament is not live (no change in the last 30 minutes)', () => {
    const reminder = getBackupReminder(state, { now: at('11:00'), lastChangeAt: at('10:30'), unsavedSince: at('10:00') });
    expect(reminder).toEqual({ live: false, due: false });
  });

  it('stays quiet when every change is in a downloaded backup', () => {
    const reminder = getBackupReminder(state, { now: at('11:00'), lastChangeAt: at('10:55'), unsavedSince: null });
    expect(reminder).toEqual({ live: true, due: false });
  });

  it('stays quiet while postponed', () => {
    const activity = { lastChangeAt: at('10:50'), unsavedSince: at('10:00'), postponedUntil: at('11:00') };
    expect(getBackupReminder(state, { now: at('10:59'), ...activity }).due).toBe(false);
    expect(getBackupReminder(state, { now: at('11:00'), ...activity }).due).toBe(true);
  });

  it('can use a different interval', () => {
    const activity = { lastChangeAt: at('10:10'), unsavedSince: at('10:00'), intervalMinutes: 10 };
    expect(getBackupReminder(state, { now: at('10:10'), ...activity }).due).toBe(true);
  });
});
