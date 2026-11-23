---
id: 31
title: Add new players one after another
status: open
labels: [ready-for-agent]
created: 2026-11-23
---

# 0031: Add new players one after another

## Problem Statement

Registering new players into a competition is slow at the desk. The "Add player" dialog closes after every save, so each player means reopening it. The dialog also doesn't say which competition the player is going into.

## Solution

Keep the existing `PlayerDialog`, and in add mode (not edit) leave it open after a successful add:

1. Its title names the competition: "Add player to {{competition}}".
2. After a successful `registerPlayer`, all fields clear (club included) and focus goes back to First name. Enter submits, so the operator can type a name, press Enter and type the next one.
3. A confirmation line above the fields shows the last player added and how many have been added since the dialog opened, e.g. "✓ Jan Kowalski added (3 added so far)". Plurals are done the i18n way (EN `_one`/`_other`, PL `_one`/`_few`/`_many`).
4. The secondary button reads "Done" in add mode; Done, Esc and the close button close the dialog. The Entries list behind it updates live.
5. A failed add keeps what the operator typed and shows the error as it does today; the confirmation line stays as it was.
6. Edit mode is unchanged: the title is "Edit player" and the dialog closes after Save.

```
┌ Add player to Men's Open ─────────────────┐
│ ✓ Jan Kowalski added (3 added so far)      │
│ First name [_______]  Last name [_______]  │
│ Club [__________]                          │
│ Rating [____]         Birth year [____]    │
│                         [Done]  [Add]      │
└────────────────────────────────────────────┘
```

## Approaches

- **Chosen: keep the dialog open after each add.** This is what the operator asked for. It reuses the existing layout and error handling, and it's a UI-only change.
- An inline add row in the Entries card: also fast, but it isn't the popup the operator asked for, and it would duplicate the form's layout and validation display.
- Bulk paste or file import: out of scope. The operator types players by hand.

## Out of scope

- Engine changes (it stays one `registerPlayer` per player).
- The "existing player" picker.
- Keeping the club between players. The operator approved clearing it; revisit if it turns out the same club often comes in a row.

## Notes for the builder

- `src/ui/components/PlayerDialog.tsx` gets the competition's name (pass `CompetitionView` or its name from `EntriesCard` in `src/ui/screens/CompetitionScreen.tsx`).
- New i18n keys go in `en.ts` and `pl.ts` (title with competition, the added line with plurals, "Done").
- No engine tests are affected. Verify in the browser: add three players with Enter only, check focus, the count and the title, then trigger an error (empty last name).
