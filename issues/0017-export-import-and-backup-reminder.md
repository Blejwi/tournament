---
id: 17
title: Export/import and backup reminder
status: in-progress
labels: [ready-for-agent]
created: 2026-10-22
---

# 0017: Export/import and backup reminder

## Parent

#0001

## What to build

- **Export:** a tournament becomes a single JSON file with a `schemaVersion`, the tournament state and the change log.
- **Import:** the file is validated with Zod and migrated if it uses an older schema. It can be imported as a new tournament or replace an existing one after confirmation.
- **Backup reminder:** while a tournament is live, a non-blocking reminder asks the operator to download a backup periodically (default every 30 minutes).

## Acceptance criteria

- [ ] An export followed by an import gives an identical tournament (round-trip test through the engine interface).
- [ ] Invalid files are rejected with a readable error and existing data is left untouched.
- [ ] Migrations run for older schema versions. Add a fixture with an older version so the migration path is tested.
- [ ] The import UI offers "import as new" and "replace", the latter after confirming.
- [ ] The backup reminder appears during a live tournament and stays quiet otherwise.

## Blocked by

- #0002
