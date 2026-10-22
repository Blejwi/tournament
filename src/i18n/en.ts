import type { EngineErrorCode } from '@/engine';

/** English strings: the source of truth for translation keys. Polish (pl.ts) must have the same keys. */
export const en = {
  app: {
    title: 'Tournament manager',
    language: 'Language',
  },
  languages: {
    en: 'English',
    pl: 'Polski',
  },
  pwa: {
    offlineReady: 'The app is ready to work offline.',
    updateAvailable: 'A new version of the app is available. Your tournaments are kept.',
    reload: 'Update now',
    later: 'Later',
  },
  common: {
    add: 'Add',
    save: 'Save',
    cancel: 'Cancel',
    edit: 'Edit',
    delete: 'Delete',
    remove: 'Remove',
    actions: 'Actions',
    optional: 'optional',
    close: 'Close',
  },
  tournaments: {
    heading: 'Tournaments',
    new: 'New tournament',
    empty: 'No tournaments yet. Create one to get started.',
    name: 'Name',
    date: 'Date',
    venue: 'Venue',
    create: 'Create tournament',
    open: 'Open',
    deleteTitle: 'Delete tournament?',
    deleteBody: '“{{name}}” and all its data will be removed from this browser. This cannot be undone.',
    notFound: 'This tournament is not stored in this browser.',
    backToList: 'All tournaments',
  },
  importFile: {
    heading: 'Import tournament',
    intro: 'Restore a tournament from a backup file (.json).',
    file: 'Backup file',
    found: 'File contains “{{name}}” ({{date}}).',
    asNew: 'Import as new',
    replaceTarget: 'Tournament to replace',
    replace: 'Replace',
    replaceTitle: 'Replace “{{name}}”?',
    replaceBody: 'Everything stored for “{{name}}” in this browser will be replaced by the tournament from the file. This cannot be undone.',
  },
  backup: {
    download: 'Download backup',
    reminderTitle: 'Time to download a backup',
    reminderBody: 'Your recent changes are stored only in this browser. Download a backup file in case browser data is lost.',
    later: 'Later',
  },
  nav: {
    tables: 'Tables',
    players: 'Players',
  },
  tables: {
    heading: 'Tables',
    add: 'Add table',
    edit: 'Edit table',
    number: 'Number',
    name: 'Name',
    status: 'Status',
    active: 'Active',
    inactive: 'Inactive',
    empty: 'No tables yet.',
    removeTitle: 'Remove table {{number}}?',
    removeBody: 'The table will be removed from this tournament.',
  },
  players: {
    heading: 'Players',
    add: 'Register player',
    edit: 'Edit player',
    firstName: 'First name',
    lastName: 'Last name',
    club: 'Club',
    rating: 'Rating',
    birthYear: 'Birth year',
    empty: 'No players registered yet.',
  },
  errors: {
    required: 'Please fill in this field.',
    invalidDate: 'Enter a valid date.',
    invalidTableNumber: 'The table number must be a whole number of 1 or more.',
    tableNumberTaken: 'Table {{number}} already exists.',
    tableNotFound: 'This table no longer exists.',
    invalidRating: 'The rating must be a number of 0 or more.',
    invalidBirthYear: 'Enter a birth year between 1900 and 2100.',
    playerNotFound: 'This player no longer exists.',
    importNotJson: 'This file can’t be read: it is not a JSON file.',
    importNotTournamentFile: 'This file is not a tournament backup.',
    importNewerVersion: 'This file was made by a newer version of the app (file format {{version}}). Update the app to import it.',
    importInvalidData: 'This file is damaged or incomplete (problem at “{{path}}”). Nothing was imported.',
  } satisfies Record<EngineErrorCode, string>,
};

type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The shape every language must match exactly. */
export type Translations = Strings<typeof en>;
