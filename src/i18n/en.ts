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
    invalidGamesToWin: 'Games to win must be 2, 3 or 4.',
    competitionNotFound: 'This competition no longer exists.',
    entryNotFound: 'This entry no longer exists.',
    alreadyEntered: 'This player is already entered in the competition.',
    invalidSeed: 'The seed must be a whole number of 1 or more.',
    seedTaken: 'Seed {{seed}} is already given to another entry.',
    invalidGrouping: 'Choose at least 1 group, or a group size of at least 2.',
    unsupportedStageChain: 'This stage format is not available yet.',
    stageNotFound: 'This stage no longer exists.',
    stageNotDrawn: 'Generate the draw first.',
    stageConfirmed: 'The draw is already confirmed and can no longer be changed.',
    notEnoughEntries: 'Not enough entries: this needs at least {{needed}}.',
    matchNotFound: 'This match no longer exists.',
  } satisfies Record<EngineErrorCode, string>,
};

type Strings<T> = { [K in keyof T]: T[K] extends string ? string : Strings<T[K]> };

/** The shape every language must match exactly. */
export type Translations = Strings<typeof en>;
